// QuantView CORS relay — Cloudflare Worker (v2).
//
// Why this exists: the app runs from file:// inside a WebView, so every source that does
// not send Access-Control-Allow-Origin has to be reached through a relay. It used to rely
// on two public relays (corsproxy.io, api.allorigins.win); when both went down on
// 2026-09-05 the app lost Yahoo, Google News, Finviz and Wikipedia at once and fell back
// to Stooq alone. A private relay removes that dependency.
//
// IMPORTANT — this is deliberately NOT an open proxy. Only the hosts the app actually
// needs are allowed. An unrestricted relay on your own domain will be discovered and used
// by strangers to launder traffic, and the bill and the abuse reports arrive at your door.
//
// v2 adds (all allow-listed, per-host policy):
//   • Binance spot REST (live, NOT cached) + a WebSocket pass-through  GET /ws/binance
//     so the app can still get prices when the phone's network/region blocks Binance;
//   • analyst-research sources used by the Analyst panel (Nasdaq, StockAnalysis, Finnhub,
//     FMP, Eastmoney, T-Bank Invest) — Authorization is forwarded ONLY to the T-Bank host;
//   • per-host cache TTL (quotes must not be cached for a minute) and per-host headers.
// Usage:  GET  https://<relay>/?url=<encoded https url>      GET /health      WS /ws/binance

const VERSION = "2.1";   // 2.1: also serves the static site (./site) on non-relay hosts

// host → policy.  ttl: edge cache seconds (0 = never cache).  ref: Referer to send.  auth: forward Authorization.
const POLICY = {
  // --- market data / news (as in v1) ---
  "query1.finance.yahoo.com":  { ttl: 15 },
  "query2.finance.yahoo.com":  { ttl: 15 },
  "query1.finance.yahoo.com.": { ttl: 15 },   // trailing-dot variants some resolvers produce
  "news.google.com":           { ttl: 60 },
  "finviz.com":                { ttl: 60 },
  "en.wikipedia.org":          { ttl: 300 },
  "stooq.com":                 { ttl: 30 },
  "www.sec.gov":               { ttl: 300 },
  "data.sec.gov":              { ttl: 300 },
  "efts.sec.gov":              { ttl: 300 },
  "nfs.faireconomy.media":     { ttl: 300 },   // Forex Factory weekly macro calendar
  "cdn-nfs.faireconomy.media": { ttl: 300 },
  // --- crypto: Binance public spot data (live → never cached) ---
  "data-api.binance.vision":   { ttl: 0 },
  "api.binance.com":           { ttl: 0 },
  "api.binance.us":            { ttl: 0 },
  // --- analyst research sources ---
  "api.nasdaq.com":            { ttl: 300, ref: "https://www.nasdaq.com/" },
  "stockanalysis.com":         { ttl: 600 },
  "finnhub.io":                { ttl: 120 },
  "financialmodelingprep.com": { ttl: 300 },
  "reportapi.eastmoney.com":   { ttl: 600, ref: "https://data.eastmoney.com/" },
  "invest-public-api.tinkoff.ru": { ttl: 0, auth: true },
  "invest-public-api.tbank.ru":   { ttl: 0, auth: true },
};

// WebSocket pass-through targets (443 only — Workers cannot dial :9443).
const WS_ROUTES = {
  "/ws/binance": "https://data-stream.binance.vision/ws",
};

const UPSTREAM_TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Safari/537.36";

function withCors(body, init) {
  const h = new Headers((init && init.headers) || {});
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "*");
  h.set("Access-Control-Max-Age", "86400");
  h.delete("set-cookie");             // never relay upstream cookies back to the client
  return new Response(body, { ...(init || {}), headers: h });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The same Worker serves the website (./site, via the ASSETS binding) on every host that is not the relay:
    //   relay.<domain>, any ?url= call and the /ws/* routes stay relay-only; everything else is a static file.
    const isRelay = url.hostname.startsWith("relay.") || url.searchParams.has("url") || !!WS_ROUTES[url.pathname]
      || (request.method === "OPTIONS");
    if (!isRelay && url.pathname !== "/health" && env && env.ASSETS) return env.ASSETS.fetch(request);

    if (request.method === "OPTIONS") return withCors(null, { status: 204 });

    // health / capability probe (used by the app's relay tester)
    if (url.pathname === "/health") {
      return withCors(JSON.stringify({ ok: true, v: VERSION, hosts: Object.keys(POLICY).length, ws: Object.keys(WS_ROUTES) }),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    // WebSocket pass-through (Binance streams)
    if (WS_ROUTES[url.pathname]) {
      if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket")
        return withCors("expected websocket upgrade", { status: 426 });
      try {
        return await fetch(new Request(WS_ROUTES[url.pathname], request));
      } catch (e) {
        return withCors("ws upstream failed: " + String(e), { status: 502 });
      }
    }

    const target = url.searchParams.get("url");
    if (!target) return withCors("missing ?url=", { status: 400 });

    let t;
    try { t = new URL(target); } catch { return withCors("malformed url", { status: 400 }); }
    if (t.protocol !== "https:") return withCors("https only", { status: 400 });
    if (t.port && t.port !== "443") return withCors("port not allowed", { status: 403 });
    const pol = POLICY[t.hostname];
    if (!pol) return withCors("host not allowed: " + t.hostname, { status: 403 });

    const headers = {
      // Yahoo rejects requests without a browser-shaped UA.
      "User-Agent": UA,
      "Accept": request.headers.get("accept") || "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (pol.ref) headers["Referer"] = pol.ref;
    if (pol.auth) { const a = request.headers.get("authorization"); if (a) headers["Authorization"] = a; }   // only for hosts that need a token

    const init = {
      method: request.method,
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    };
    if (pol.ttl > 0) init.cf = { cacheTtl: pol.ttl, cacheEverything: true };
    else init.cf = { cacheTtl: 0 };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
      const ct = request.headers.get("content-type");
      if (ct) init.headers["Content-Type"] = ct;
    }

    let res;
    try {
      res = await fetch(t.toString(), init);
    } catch (e) {
      // Surface the real reason so the app can tell a dead upstream from a dead relay.
      return withCors("upstream failed: " + (e && e.name === "TimeoutError" ? "timeout" : String(e)),
        { status: 502 });
    }

    const h = new Headers(res.headers);
    h.delete("set-cookie");
    h.set("X-QV-Relay", VERSION);
    if (pol.ttl === 0) h.set("Cache-Control", "no-store");
    return withCors(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },
};
