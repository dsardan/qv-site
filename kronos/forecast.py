#!/usr/bin/env python3
"""Daily Kronos forecast for QuantView (runs in GitHub Actions, free tier, CPU).

Reads daily candles (Binance public market-data mirror), asks Kronos-small for N independent
7-day close paths per coin, writes site/data/kronos.json (+ rolling history for a live track record).
Kronos = shiyu-coder/Kronos (MIT, arXiv 2508.02739). Output is a *signal*, not advice.

  python kronos/forecast.py            # real model (needs torch + Kronos checkout in ./Kronos-src)
  python kronos/forecast.py --stub     # random-walk stand-in + synthetic candles (pipeline test, no network/model)
"""
import json, os, sys, time, math, random, datetime as dt, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "data", "kronos.json")
HIST = os.path.join(ROOT, "site", "data", "kronos-hist.json")
H = 7              # forecast horizon, days
LOOK = 400         # context candles (model max_context=512)
NS = int(os.environ.get("KRONOS_SAMPLES", "30"))   # independent sampled paths per coin
STABLE = {"USDC","FDUSD","TUSD","USDP","DAI","BUSD","USDE","USD1","EUR","EURI","AEUR","PYUSD","XUSD","RLUSD","BFUSD","USDT"}
HOSTS = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com", "https://api.binance.us"]
STUB = "--stub" in sys.argv

def http(path):
    last = None
    for h in HOSTS:
        try:
            req = urllib.request.Request(h + path, headers={"User-Agent": "qv-kronos/1"})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode()), h
        except Exception as e:
            last = e
    raise RuntimeError("all hosts failed: %s" % last)

def universe():
    if STUB:
        return ["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "ADA", "TRX"]
    t, _ = http("/api/v3/ticker/24hr")
    rows = []
    for x in t:
        s = x["symbol"]
        if not s.endswith("USDT"): continue
        b = s[:-4]
        if b in STABLE or b.endswith(("UP", "DOWN", "BULL", "BEAR")): continue
        rows.append((float(x["quoteVolume"]), b))
    rows.sort(reverse=True)
    uni = ["BTC", "ETH"]
    for _, b in rows:
        if b not in uni and len(uni) < 8: uni.append(b)
    return uni

def candles(b):
    """closed daily candles, oldest first: [open_ms, o,h,l,c,vol,quote_vol]"""
    if STUB:
        rnd = random.Random(hash(b) & 0xffff); p = 100.0; out = []
        t0 = int((time.time() // 86400) * 86400 * 1000) - 600 * 86400000
        for i in range(600):
            r = rnd.gauss(0.0004, 0.03); o = p; p = p * math.exp(r)
            out.append([t0 + i * 86400000, o, max(o, p) * 1.01, min(o, p) * 0.99, p, 1000 + rnd.random() * 100, 1e5])
        return out
    k, _ = http("/api/v3/klines?symbol=%sUSDT&interval=1d&limit=1000" % b)
    now = time.time() * 1000
    k = [x for x in k if x[6] < now]                        # drop the still-open candle
    return [[x[0], float(x[1]), float(x[2]), float(x[3]), float(x[4]), float(x[5]), float(x[7])] for x in k]

class StubPredictor:
    def predict_batch(self, df_list, x_timestamp_list, y_timestamp_list, pred_len, **kw):
        import pandas as pd
        out = []
        for df, yt in zip(df_list, y_timestamp_list):
            p = float(df["close"].iloc[-1]); rows = []
            for _ in range(pred_len):
                p *= math.exp(random.gauss(0, 0.03)); rows.append({"open": p, "high": p, "low": p, "close": p, "volume": 0, "amount": 0})
            out.append(pd.DataFrame(rows, index=yt))
        return out

def load_predictor():
    if STUB: return StubPredictor()
    sys.path.insert(0, os.path.join(ROOT, "Kronos-src"))
    from model import Kronos, KronosTokenizer, KronosPredictor
    tok = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
    mdl = Kronos.from_pretrained("NeoQuasar/Kronos-small")
    return KronosPredictor(mdl, tok, device="cpu", max_context=512)

def q(a, p):
    a = sorted(a); i = (len(a) - 1) * p; lo = int(math.floor(i)); hi = int(math.ceil(i))
    return a[lo] + (a[hi] - a[lo]) * (i - lo)

def load(path, dflt):
    try:
        with open(path) as f: return json.load(f)
    except Exception: return dflt

def main():
    import pandas as pd
    uni = universe(); data = {}
    for b in uni:
        try:
            c = candles(b)
            if len(c) >= LOOK + 1: data[b] = c
            else: print("skip %s: only %d candles" % (b, len(c)))
        except Exception as e:
            print("skip %s: %s" % (b, e))
    if not data: raise SystemExit("no data")
    # all series must share the same last candle
    last = max(v[-1][0] for v in data.values()); data = {b: v for b, v in data.items() if v[-1][0] == last}
    coins = list(data)
    pred = load_predictor()
    dfs, xts, yts = [], [], []
    ylist = pd.Series(pd.to_datetime([last + (i + 1) * 86400000 for i in range(H)], unit="ms"))
    for b in coins:
        w = data[b][-LOOK:]
        dfs.append(pd.DataFrame([{"open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5], "amount": r[6]} for r in w]))
        xts.append(pd.Series(pd.to_datetime([r[0] for r in w], unit="ms"))); yts.append(ylist)
    paths = {b: [] for b in coins}
    t0 = time.time()
    for s in range(NS):                      # sample_count=1 per call -> every call is one independent path
        res = pred.predict_batch(df_list=dfs, x_timestamp_list=xts, y_timestamp_list=yts, pred_len=H, T=1.0, top_p=0.9, sample_count=1, verbose=False)
        for b, r in zip(coins, res): paths[b].append([float(x) for x in r["close"].values])
        if s == 0: print("first batch %.1fs" % (time.time() - t0))
    asof = dt.datetime.utcfromtimestamp(last / 1000).strftime("%Y-%m-%d")      # open date of the last closed candle
    out_c = {}
    for b in coins:
        l0 = data[b][-1][4]; fin = [p[-1] / l0 - 1 for p in paths[b]]
        d1 = [p[0] / l0 - 1 for p in paths[b]]
        out_c[b + "-USD"] = {"p": round(sum(1 for x in fin if x > 0) / len(fin), 3), "med": round(q(fin, .5), 4), "q10": round(q(fin, .1), 4), "q90": round(q(fin, .9), 4),
                             "p1": round(sum(1 for x in d1 if x > 0) / len(d1), 3), "last": l0}
    # live track record: score forecasts whose horizon has been reached
    hist = load(HIST, [])
    closes = {b: {dt.datetime.utcfromtimestamp(r[0] / 1000).strftime("%Y-%m-%d"): r[4] for r in data[b]} for b in coins}
    for h in hist:
        if h.get("res") is None:
            d = (dt.datetime.strptime(h["d"], "%Y-%m-%d") + dt.timedelta(days=H)).strftime("%Y-%m-%d"); b = h["tk"].replace("-USD", "")
            if b in closes and d in closes[b]: h["res"] = round(closes[b][d] / h["last"] - 1, 4)
    for tk, v in out_c.items():
        if not any(h["d"] == asof and h["tk"] == tk for h in hist): hist.append({"d": asof, "tk": tk, "p": v["p"], "med": v["med"], "last": v["last"], "res": None})
    cut = (dt.datetime.utcnow() - dt.timedelta(days=200)).strftime("%Y-%m-%d"); hist = [h for h in hist if h["d"] >= cut]
    done = [h for h in hist if h.get("res") is not None and abs(h["p"] - 0.5) > 1e-9]
    n = len(done); hit = sum(1 for h in done if (h["p"] > 0.5) == (h["res"] > 0)) / n if n else None
    up = sum(1 for h in done if h["res"] > 0) / n if n else None
    track = {"n": n, "hit": None if hit is None else round(hit, 3), "base": None if up is None else round(max(up, 1 - up), 3),
             "days": len({h["d"] for h in done})}
    doc = {"v": 1, "model": "NeoQuasar/Kronos-small" if not STUB else "STUB", "stub": STUB, "asof": asof, "gen": int(time.time()), "h": H, "ns": NS, "look": LOOK, "coins": out_c, "track": track}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f: json.dump(doc, f, separators=(",", ":"))
    with open(HIST, "w") as f: json.dump(hist, f, separators=(",", ":"))
    print(json.dumps(doc)[:600])

if __name__ == "__main__":
    main()
