// Invitation-only access to the web app (/app/*) + owner API used by the in-app "Invite" screen.
// Privacy: the server stores ONLY the invite record (random id, the owner's own label, expiry, use counter).
// Nothing about invitees (no name, e-mail, IP) is stored. Session = signed cookie, no tracking.
//
// Secrets/bindings:  ADMIN_KEY (Worker secret, the owner's password)  ·  INVITES (KV namespace)
const enc = new TextEncoder();
const MAX_DAYS = 365, SESSION_MAX_S = 30 * 86400;
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg))));
}
function safeEq(a, b) {          // constant-time compare
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Max-Age": "86400" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const newId = () => b64u(crypto.getRandomValues(new Uint8Array(16)));
const siteOrigin = (url) => url.protocol + "//" + url.host.replace(/^relay\./, "");
const cookieOf = (req, name) => { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)")); return m ? m[1] : ""; };
const cache = new Map();         // id -> {ok, t}  (30 s, per isolate) so assets do not each hit KV

async function isAdmin(req, env) {
  if (!env.ADMIN_KEY) return "nokey";
  const a = req.headers.get("authorization") || "";
  const m = /^Bearer (.+)$/.exec(a);
  if (!m || !safeEq(m[1], env.ADMIN_KEY)) { await new Promise((r) => setTimeout(r, 400)); return false; }
  return true;
}

// ---- API (any host): POST /api/invite · GET /api/invites · DELETE /api/invite/<id>
export async function inviteApi(req, env, url) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!env.INVITES) return json({ ok: false, error: "kv_missing" }, 503);
  const adm = await isAdmin(req, env);
  if (adm === "nokey") return json({ ok: false, error: "admin_key_not_set" }, 503);
  if (!adm) return json({ ok: false, error: "unauthorized" }, 401);
  const p = url.pathname;
  if (p === "/api/invite" && req.method === "POST") {
    let b = {}; try { b = await req.json(); } catch (e) {}
    const days = Math.min(MAX_DAYS, Math.max(1, parseInt(b.days, 10) || 30));
    const max = Math.min(100, Math.max(1, parseInt(b.max, 10) || 3));
    const label = String(b.label || "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 60);
    const id = newId(), now = Date.now(), exp = now + days * 86400e3;
    const meta = { label, created: now, exp, max, used: 0 };
    await env.INVITES.put("inv:" + id, JSON.stringify(meta), { metadata: meta, expirationTtl: days * 86400 + 86400 });
    return json({ ok: true, id, exp, max, url: siteOrigin(url) + "/join/" + id });
  }
  if (p === "/api/invites" && req.method === "GET") {
    const l = await env.INVITES.list({ prefix: "inv:", limit: 200 });
    const items = l.keys.map((k) => ({ id: k.name.slice(4), ...(k.metadata || {}) })).sort((a, b) => (b.created || 0) - (a.created || 0));
    return json({ ok: true, items });
  }
  const m = /^\/api\/invite\/([A-Za-z0-9_-]{10,40})$/.exec(p);
  if (m && req.method === "DELETE") { await env.INVITES.delete("inv:" + m[1]); cache.delete(m[1]); return json({ ok: true }); }
  return json({ ok: false, error: "not_found" }, 404);
}

// ---- /join/<id>: GET = confirmation page (link-preview bots only GET, so they cannot burn a use); POST = enter
const PAGE = (body) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QuantView</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1220;color:#e8eefc;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Hebrew",Arial,sans-serif}
@media(prefers-color-scheme:light){body{background:#f6f8fc;color:#0f1a30}}main{max-width:460px;margin:16px;padding:26px;border:1px solid #23324f;border-radius:16px;background:rgba(127,127,127,.08);text-align:center}
h1{font-size:22px;margin:0 0 10px}p{margin:0 0 14px;opacity:.85}button,a.b{display:inline-block;padding:11px 20px;border-radius:10px;border:0;background:#2dd4bf;color:#04201c;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer}
.l{display:none}.l.on{display:block}small{opacity:.6}</style></head><body><main>${body}<p><small>© Daniel Saricov · <a href="mailto:dsaricov@gmail.com" style="color:inherit">dsaricov@gmail.com</a></small></p></main>
<script>(function(){var n=(navigator.language||"en").slice(0,2).toLowerCase(),l=n==="he"||n==="iw"?"he":n==="ru"?"ru":"en";document.documentElement.lang=l;document.documentElement.dir=l==="he"?"rtl":"ltr";document.querySelectorAll(".l").forEach(function(e){if(e.dataset.l===l)e.classList.add("on")})})()</script></body></html>`;
const T3 = (ru, he, en) => `<div class="l" data-l="ru">${ru}</div><div class="l" data-l="he">${he}</div><div class="l" data-l="en">${en}</div>`;
const html = (body, status = 200, extra = {}) => new Response(PAGE(body), { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...extra } });

export const closedPage = () => html(T3(
  "<h1>Вход по приглашению</h1><p>Веб-версия QuantView закрыта и открывается только по личной ссылке-приглашению. Если у вас есть ссылка, откройте её.</p><p><a class=\"b\" href=\"/\">На главную</a></p>",
  "<h1>כניסה בהזמנה</h1><p>גרסת הווב של QuantView סגורה ונפתחת רק בקישור הזמנה אישי. אם יש לכם קישור, פתחו אותו.</p><p><a class=\"b\" href=\"/\">לדף הבית</a></p>",
  "<h1>Invitation only</h1><p>The QuantView web app is closed and opens only through a personal invitation link. If you have one, open it.</p><p><a class=\"b\" href=\"/\">Home</a></p>"), 401);
const badInvite = () => html(T3(
  "<h1>Приглашение недействительно</h1><p>Ссылка истекла, использована или отозвана. Попросите владельца прислать новую.</p>",
  "<h1>ההזמנה אינה תקפה</h1><p>הקישור פג, נוצל או בוטל. בקשו מהבעלים קישור חדש.</p>",
  "<h1>Invitation not valid</h1><p>The link has expired, was used up or revoked. Ask the owner for a new one.</p>"), 403);

export async function joinPage(req, env, url) {
  const m = /^\/join\/([A-Za-z0-9_-]{10,40})\/?$/.exec(url.pathname);
  if (!m || !env.INVITES || !env.ADMIN_KEY) return badInvite();
  const id = m[1], raw = await env.INVITES.get("inv:" + id);
  let inv = null; try { inv = raw && JSON.parse(raw); } catch (e) {}
  if (!inv || inv.exp < Date.now() || (inv.max && inv.used >= inv.max)) return badInvite();
  if (req.method !== "POST") {
    return html(T3(
      "<h1>Вас пригласили в QuantView</h1><p>Нажмите, чтобы открыть веб-версию. Приложение для анализа рынка и виртуальная биржа (демо). Не инвестиционная рекомендация.</p><form method=\"post\"><button>Войти</button></form>",
      "<h1>הוזמנתם ל-QuantView</h1><p>לחצו כדי לפתוח את גרסת הווב. אפליקציה לניתוח שוק ובורסה וירטואלית (דמו). לא המלצת השקעה.</p><form method=\"post\"><button>כניסה</button></form>",
      "<h1>You are invited to QuantView</h1><p>Press to open the web app. A market-analysis app with a virtual (demo) exchange. Not investment advice.</p><form method=\"post\"><button>Enter</button></form>"));
  }
  inv.used = (inv.used || 0) + 1;
  const ttl = Math.max(60, Math.floor((inv.exp - Date.now()) / 1000));
  await env.INVITES.put("inv:" + id, JSON.stringify(inv), { metadata: inv, expirationTtl: ttl + 86400 });
  const maxAge = Math.min(SESSION_MAX_S, ttl), exp = Math.floor(Date.now() / 1000) + maxAge;
  const sig = await hmac(env.ADMIN_KEY + "|session", id + "." + exp);
  return new Response(null, { status: 303, headers: { Location: "/app/", "Cache-Control": "no-store",
    "Set-Cookie": `qv_s=${id}.${exp}.${sig}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax` } });
}

// ---- gate for /app/*: valid signed cookie AND the invite still exists (revocation works)
export async function hasAccess(req, env) {
  if (!env.ADMIN_KEY || !env.INVITES) return false;
  const c = cookieOf(req, "qv_s"); const m = /^([A-Za-z0-9_-]{10,40})\.(\d{9,12})\.([A-Za-z0-9_-]+)$/.exec(c);
  if (!m) return false;
  const [, id, exp, sig] = m;
  if (+exp * 1000 < Date.now()) return false;
  if (!safeEq(sig, await hmac(env.ADMIN_KEY + "|session", id + "." + exp))) return false;
  const hit = cache.get(id); if (hit && Date.now() - hit.t < 30000) return hit.ok;
  const ok = !!(await env.INVITES.get("inv:" + id));
  cache.set(id, { ok, t: Date.now() }); if (cache.size > 500) cache.clear();
  return ok;
}
