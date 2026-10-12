# qv-relay

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dsardan/qv-relay)

Cloudflare Worker relay for the QuantView / QuantEdge app (CORS + allow-list, **not** an open proxy).

- `GET /?url=<encoded https url>` — fetch an allow-listed host (see `POLICY` in `index.js`; per-host cache TTL, Referer, Authorization only for T-Bank).
- `GET /health` — `{ok, v, hosts, ws}`.
- `WS /ws/binance` — WebSocket pass-through to `wss://data-stream.binance.vision/ws` (Binance trade streams, SUBSCRIBE messages).
- Binance REST hosts are never cached (live prices).

Deploy: Cloudflare → Workers → import this repo (`wrangler.jsonc`, main `index.js`). Test offline: `node test.mjs`.
In the app: Σ-panel → relay address (`qe_relay`), default `https://relay.futuretrainingnow.com`.
Caveat: Binance may still refuse some Cloudflare egress regions (HTTP 451); the app then falls back to Yahoo.

## Website (v2.1)
`site/` is served by the same Worker on every host except `relay.*` (static assets binding `ASSETS`, `run_worker_first`):
`/` landing (ru/he/en), `/me/` author, `/privacy/`, `/app/` web version of QuantView, `/download/quantview.apk`.
Custom domains to attach to the Worker: `futuretrainingnow.com` (site) and `relay.futuretrainingnow.com` (relay).
Update the APK/web app: copy the new files into `site/download/` and `site/app/`, bump `QV_META` and the SHA-256 in `site/index.html`.
