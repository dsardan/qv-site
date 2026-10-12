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
`/` landing (ru/he/en), `/me/` author, `/privacy/`, `/app/` web version of QuantView (**invitation only**, see below).
Custom domains to attach to the Worker: `futuretrainingnow.com` (site) and `relay.futuretrainingnow.com` (relay).
Update the web app: copy the new files into `site/app/`. The APK is intentionally NOT published on the site.


## Invitations (web app closed)
`/app/*` opens only with a signed cookie issued by `/join/<id>` (confirm page, POST to enter). Storage: KV `INVITES`
(`inv:<id>` -> label, created, exp, max, used). Nothing about invitees is stored.
One-time setup: Cloudflare -> Workers -> qv-site -> Settings -> Variables and Secrets -> add secret `ADMIN_KEY` (your password, 24+ chars).
Owner API (`Authorization: Bearer <ADMIN_KEY>`): `POST /api/invite {label,days,max}`, `GET /api/invites`, `DELETE /api/invite/<id>`.
The Android app (Σ panel -> Invitations) calls this API. Until `ADMIN_KEY` is set, `/app/` stays closed for everyone.
