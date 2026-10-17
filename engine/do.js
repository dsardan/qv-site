// QuantView engine — Durable Object that owns the 24/7 container (Cloudflare Containers).
// The container disk is ephemeral, so the account/settings snapshot lives HERE (Durable Object SQLite storage)
// and is pushed back into a fresh container automatically. Clients authenticate with a token they "claim" once.
import { DurableObject } from "cloudflare:workers";

const PORT = 8787;
const KEEP_MS = 6 * 3600 * 1000;           // max inactivity timeout (6 h); the alarm renews it every 2 min while ON
const TICK_MS = 2 * 60 * 1000;
const CHUNK = 100 * 1024;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS", "cache-control": "no-store" };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...cors } });
const rnd = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[b % 56]).join(""); };
const same = (a, b) => { a = String(a || ""); b = String(b || ""); if (a.length !== b.length || !a.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export class QVEngine extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const c = ctx.container;
    if (c && c.running) void ctx.blockConcurrencyWhile(() => c.setInactivityTimeout(KEEP_MS).catch(() => {}));
  }
  async kv(k, d) { const v = await this.ctx.storage.get(k); return v === undefined ? d : v; }
  async put(k, v) { await this.ctx.storage.put(k, v); }
  async saveSnap(str) { const n = Math.ceil(str.length / CHUNK); const o = {}; for (let i = 0; i < n; i++) o["snap:" + i] = str.slice(i * CHUNK, (i + 1) * CHUNK); const old = await this.kv("snap:n", 0); for (let i = 0; i < n; i += 100) { const part = {}; Object.keys(o).slice(i, i + 100).forEach(k => part[k] = o[k]); await this.ctx.storage.put(part); } const del = []; for (let i = n; i < old; i++) del.push("snap:" + i); if (del.length) await this.ctx.storage.delete(del); await this.ctx.storage.put({ "snap:n": n, "snap:ts": Date.now() }); }
  async loadSnap() { const n = await this.kv("snap:n", 0); if (!n) return null; const keys = []; for (let i = 0; i < n; i++) keys.push("snap:" + i); let s = ""; for (let i = 0; i < keys.length; i += 100) { const m = await this.ctx.storage.get(keys.slice(i, i + 100)); keys.slice(i, i + 100).forEach(k => s += (m.get(k) || "")); } return s; }
  async itok() { let t = await this.kv("itok", ""); if (!t) { t = rnd(40); await this.put("itok", t); } return t; }

  async ensure() {
    const c = this.ctx.container;
    if (!c.running) {
      c.start({ env: { QV_TOKEN: await this.itok(), PORT: String(PORT), DATA_DIR: "/tmp/qvdata" }, enableInternet: true });
      await this.put("startedAt", Date.now());
    }
    try { await c.setInactivityTimeout(KEEP_MS); } catch (e) {}
    const port = c.getTcpPort(PORT); let last;
    for (let i = 0; i < 300; i++) {   // headless Chromium needs time on a cold start
      try { const r = await port.fetch("http://container/health", { signal: AbortSignal.timeout(2000) }); await r.body?.cancel(); if (r.ok) return; } catch (e) { last = e; }
      await scheduler.wait(500);
    }
    throw new Error("engine container not ready: " + (last && last.message));
  }
  async cf(path, init) {   // call the container with the internal token
    await this.ensure();
    const h = new Headers((init && init.headers) || {}); h.set("authorization", "Bearer " + (await this.itok())); h.set("content-type", "application/json");
    return this.ctx.container.getTcpPort(PORT).fetch("http://container" + path, { ...(init || {}), headers: h });
  }
  async cfJson(path, init) { const r = await this.cf(path, init); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {} if (!r.ok) throw new Error((j && j.error) || ("container " + r.status)); return j; }

  /* restore a fresh container (ephemeral disk) from the stored snapshot, keep it alive, snapshot periodically */
  async alarm() {
    const on = await this.kv("on", false);
    try {
      if (on) {
        const st = await this.cfJson("/status", { method: "GET" });
        const snap = await this.loadSnap();
        if (snap && (!st.phone || !st.on)) { await this.cfJson("/handover", { method: "POST", body: snap }); await this.put("restoredAt", Date.now()); }
        else if (Date.now() - (await this.kv("snap:ts", 0)) > 10 * 60 * 1000) { const s = await this.cfJson("/state?full=1", { method: "GET" }); await this.saveSnap(JSON.stringify({ keys: s.keys })); }
      }
    } catch (e) { await this.put("lastErr", String(e && e.message || e).slice(0, 300)); }
    if (on) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const u = new URL(req.url); const p = u.pathname.replace(/^\/engine/, "") || "/";
    if (p === "/health") return J({ ok: true, claimed: !!(await this.kv("tok", "")), on: await this.kv("on", false) });
    if (p === "/claim" && req.method === "POST") {   // first client to claim sets the token (owner does it right after deploy)
      if (await this.kv("tok", "")) return J({ error: "already_claimed" }, 409);
      let b = {}; try { b = await req.json(); } catch (e) {}
      const t = String(b.token || ""); if (t.length < 24) return J({ error: "token_too_short" }, 400);
      await this.put("tok", t); return J({ ok: true });
    }
    if (p === "/unclaim" && req.method === "POST") {  // owner-only reset (e.g. new phone): needs the site's ADMIN_KEY secret
      if (!same(req.headers.get("x-admin-key") || "", this.env.ADMIN_KEY || "")) return J({ error: "bad_admin_key" }, 401);
      await this.ctx.storage.delete("tok"); return J({ ok: true });
    }
    const h = req.headers.get("authorization") || ""; if (!same(h.startsWith("Bearer ") ? h.slice(7).trim() : "", (await this.kv("tok", "")))) return J({ error: "bad_token" }, 401);
    try {
      if (p === "/status") { const s = await this.cfJson("/status", { method: "GET" }); return J({ ...s, cloud: true, snapTs: await this.kv("snap:ts", 0), restoredAt: await this.kv("restoredAt", 0), doErr: await this.kv("lastErr", "") }); }
      if (p === "/handover" && req.method === "POST") { const body = await req.text(); const j = await this.cfJson("/handover", { method: "POST", body }); await this.saveSnap(body); await this.put("on", true); await this.ctx.storage.setAlarm(Date.now() + TICK_MS); return J(j); }
      if (p === "/start" && req.method === "POST") { const j = await this.cfJson("/start", { method: "POST" }); await this.put("on", true); await this.ctx.storage.setAlarm(Date.now() + TICK_MS); return J(j); }
      if (p === "/stop" && req.method === "POST") { const j = await this.cfJson("/stop", { method: "POST" }); await this.put("on", false); try { const s = await this.cfJson("/state?full=1", { method: "GET" }); await this.saveSnap(JSON.stringify({ keys: s.keys })); } catch (e) {} try { await this.ctx.container.setInactivityTimeout(30 * 60 * 1000); } catch (e) {} return J(j); }
      if (p === "/state" || p === "/log") { const r = await this.cf(p + u.search, { method: "GET" }); return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", ...cors } }); }
      return J({ error: "not_found" }, 404);
    } catch (e) { return J({ error: String(e && e.message || e).slice(0, 200) }, 502); }
  }
}
