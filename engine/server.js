/* QuantView server engine (vc654) — runs the SAME app engine (assets/www/index.html) 24/7 in headless Chromium,
   controlled from the phone app over HTTPS with a secret token. One trading host at a time:
   the key qe_trade_off="1" (QEJob gate) disables every trading job on the side that must not trade.
   © Daniel Saricov · Sarik Danikov */
"use strict";
const http=require("http"), fs=require("fs"), path=require("path");
const { chromium }=require("playwright");
const TOKEN=String(process.env.QV_TOKEN||"").trim(), PORT=+process.env.PORT||8787;
const DATA=process.env.DATA_DIR||path.join(__dirname,"data"), WWW=process.env.WWW_DIR||path.join(__dirname,"app");
const EXE=process.env.CHROME_PATH||undefined;
if(TOKEN.length<16){ console.error("QV_TOKEN must be set (>=16 chars)"); process.exit(1); }
fs.mkdirSync(DATA,{recursive:true});
const CTL=path.join(DATA,"control.json");
let ctl={on:false,phone:null,since:0}; try{ ctl=Object.assign(ctl,JSON.parse(fs.readFileSync(CTL,"utf8"))); }catch(e){}
const saveCtl=()=>{ try{ fs.writeFileSync(CTL,JSON.stringify(ctl)); }catch(e){} };
let ctx=null, page=null, info={startedAt:0,beat:0,restarts:0,lastErr:"",loading:false};
const log=(...a)=>console.log(new Date().toISOString(),...a);

async function launch(){
  if(info.loading) return; info.loading=true;
  try{
    if(ctx){ try{ await ctx.close(); }catch(e){} ctx=null; page=null; }
    ctx=await chromium.launchPersistentContext(path.join(DATA,"profile"),{headless:true,executablePath:EXE,viewport:{width:412,height:900},
      args:["--no-sandbox","--disable-dev-shm-usage","--disable-background-timer-throttling","--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows","--allow-file-access-from-files"]});
    await ctx.addInitScript("window.__QE_SERVER=1;");
    page=ctx.pages()[0]||await ctx.newPage();
    page.on("crash",()=>{ info.lastErr="page crash"; log("page crash → relaunch"); info.restarts++; setTimeout(launch,3000); });
    page.on("pageerror",e=>{ info.lastErr=String(e).slice(0,300); });
    await page.goto("file://"+path.resolve(WWW,"index.html"),{waitUntil:"load",timeout:60000});
    await page.waitForTimeout(3000);
    await applyCtl(); if(ctl.on){ await page.reload({waitUntil:"load",timeout:60000}); await page.waitForTimeout(2500); await applyCtl(); }
    info.startedAt=Date.now(); log("engine loaded");
  }catch(e){ info.lastErr=String(e).slice(0,300); log("launch failed",e); setTimeout(launch,15000); }
  finally{ info.loading=false; }
}
async function ev(fn,arg){ if(!page) throw new Error("engine_not_ready"); return page.evaluate(fn,arg); }
/* trading on/off on the server side = the same gate key the phone uses */
async function applyCtl(){
  await ev(c=>{ localStorage.setItem("qe_trade_off",c.on?"0":"1"); try{ const a=JSON.parse(localStorage.getItem("qe_auth")||"null"); if(a&&a.phone) localStorage.setItem("qe_vx_auto_"+a.phone,c.on?"1":"0"); }catch(e){} },{on:ctl.on});
}
async function reload(){ await applyCtl(); await page.reload({waitUntil:"load",timeout:60000}); await page.waitForTimeout(2500); await applyCtl(); }   /* flags set BEFORE the app boots (it reads them on mount) */
async function waitIdle(ms){ const t0=Date.now(); while(Date.now()-t0<ms){ const s=await ev(()=>{ try{ return QEJob.state(); }catch(e){ return {running:null}; } }); if(!s.running) return true; await new Promise(r=>setTimeout(r,1000)); } return false; }
const EXCL_IN=/^qe_(trade_off|srv_|night)/;            /* never accept these from the phone */
const LOCAL_ONLY_OUT=/^qe_(trade_off|srv_)/;           /* never send these back */

/* native-style heartbeat: wakes the engine every 15 s exactly like the Android foreground service */
setInterval(async()=>{ try{ if(page&&!info.loading){ await page.evaluate("try{window.__qeBgTick&&window.__qeBgTick()}catch(e){}"); info.beat=Date.now(); } }catch(e){} },15000);
/* memory hygiene: reload the page every 12 h (state is in localStorage, nothing is lost) */
setInterval(async()=>{ try{ if(page&&!info.loading){ await waitIdle(120000); await reload(); log("12h reload"); } }catch(e){} },12*3600e3);

function send(res,code,obj){ const b=typeof obj==="string"?obj:JSON.stringify(obj); res.writeHead(code,{"content-type":typeof obj==="string"?"text/plain; charset=utf-8":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS","cache-control":"no-store"}); res.end(b); }
function body(req){ return new Promise((ok,bad)=>{ let n=0; const ch=[]; req.on("data",c=>{ n+=c.length; if(n>25e6){ bad(new Error("too_large")); req.destroy(); } else ch.push(c); }); req.on("end",()=>{ try{ ok(ch.length?JSON.parse(Buffer.concat(ch).toString("utf8")):{}); }catch(e){ bad(e); } }); }); }
function authed(req){ const h=String(req.headers.authorization||""); const t=h.startsWith("Bearer ")?h.slice(7).trim():""; if(t.length!==TOKEN.length) return false; let d=0; for(let i=0;i<t.length;i++) d|=t.charCodeAt(i)^TOKEN.charCodeAt(i); return d===0; }

http.createServer(async(req,res)=>{
  try{
    if(req.method==="OPTIONS") return send(res,204,"");
    const u=new URL(req.url,"http://x"), p=u.pathname;
    if(p==="/health") return send(res,200,{ok:true});
    if(!authed(req)) return send(res,401,{error:"bad_token"});
    if(!page) return send(res,503,{error:"engine_starting",lastErr:info.lastErr});
    if(p==="/status"&&req.method==="GET"){
      const st=await ev(()=>{ const o={}; try{ o.version=typeof QE_VERSION!=="undefined"?QE_VERSION:null; }catch(e){}
        try{ const a=JSON.parse(localStorage.getItem("qe_auth")||"null"); o.phone=a&&a.phone?("…"+String(a.phone).slice(-4)):null;
          const acc=a&&a.phone?JSON.parse(localStorage.getItem("qe_vexchange_"+a.phone)||"null"):null;
          if(acc){ o.cash=Math.round(acc.cash||0); o.positions=(acc.positions||[]).length; o.trades=(acc.history||[]).length; o.realized=Math.round(acc.realized||0); o.last=(acc.history||[]).slice(-3).map(h=>({tk:h.ticker,net:h.net!=null?+(+h.net).toFixed(2):null,ts:h.ts})); } }catch(e){}
        try{ o.jobs=QEJob.state(); o.lastJobs=QEJob.hist().slice(-6).map(h=>h.name); }catch(e){}
        try{ o.tradeOff=localStorage.getItem("qe_trade_off")==="1"; }catch(e){}
        try{ const L=window.QEVXLog.read(); const arr=Array.isArray(L)?L:(L.entries||[]); o.logN=arr.length; o.lastLine=String(arr[arr.length-1]||"").slice(0,160); }catch(e){}
        try{ o.hostsDown=window.QVHostsDown?window.QVHostsDown():[]; }catch(e){}
        return o; });
      return send(res,200,Object.assign({on:ctl.on,since:ctl.since,beat:info.beat,startedAt:info.startedAt,restarts:info.restarts,lastErr:info.lastErr,server:true},st));
    }
    if(p==="/handover"&&req.method==="POST"){
      const b=await body(req); const keys=b&&b.keys; if(!keys||typeof keys!=="object") return send(res,400,{error:"no_keys"});
      const clean={}; Object.keys(keys).forEach(k=>{ if(/^qe_/.test(k)&&!EXCL_IN.test(k)&&typeof keys[k]==="string") clean[k]=keys[k]; });
      ctl.on=false; saveCtl(); await applyCtl(); await waitIdle(90000);
      const n=await ev(kv=>{ let n=0; for(const k in kv){ try{ localStorage.setItem(k,kv[k]); n++; }catch(e){} } return n; },clean);
      ctl.on=true; ctl.since=Date.now(); try{ ctl.phone=JSON.parse(clean.qe_auth||"null").phone||null; }catch(e){} saveCtl();
      await reload(); log("handover",n,"keys → trading ON");
      return send(res,200,{ok:true,keys:n,on:true});
    }
    if(p==="/start"&&req.method==="POST"){ ctl.on=true; ctl.since=Date.now(); saveCtl(); await reload(); return send(res,200,{ok:true,on:true}); }
    if(p==="/stop"&&req.method==="POST"){ ctl.on=false; saveCtl(); await applyCtl(); const idle=await waitIdle(90000); await reload(); return send(res,200,{ok:true,on:false,idle:idle}); }
    if(p==="/state"&&req.method==="GET"){
      const big=u.searchParams.get("full")==="1";
      const keys=await ev(o=>{ const re=new RegExp(o.re); const out={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(!/^qe_/.test(k)||re.test(k)) continue; const v=localStorage.getItem(k); if(o.big||v.length<400000) out[k]=v; } return out; },{big:big,re:LOCAL_ONLY_OUT.source});
      return send(res,200,{ok:true,on:ctl.on,keys:keys});
    }
    if(p==="/log"&&req.method==="GET"){ const n=Math.min(2000,+u.searchParams.get("n")||300); const L=await ev(n=>{ const L=window.QEVXLog.read(); const a=Array.isArray(L)?L:(L.entries||[]); return a.slice(-n); },n); return send(res,200,{ok:true,lines:L}); }
    return send(res,404,{error:"not_found"});
  }catch(e){ log("api error",e); return send(res,500,{error:String(e&&e.message||e).slice(0,200)}); }
}).listen(PORT,()=>{ log("QuantView server on :"+PORT); launch(); });
process.on("SIGTERM",async()=>{ try{ if(ctx) await ctx.close(); }catch(e){} process.exit(0); });
