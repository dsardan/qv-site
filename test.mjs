// node test.mjs — offline unit test of the relay (stubs global fetch)
import w from "./index.js";
const calls=[]; globalThis.fetch=async(u,init)=>{ calls.push({u:String(u&&u.url||u),init}); return new Response("{}",{status:200,headers:{"set-cookie":"a=b","x":"1"}}); };
const R=(path,opt)=>w.fetch(new Request("https://relay.test"+path,opt));
let ok=0,bad=0; const T=(n,c)=>{ c?ok++:(bad++,console.log("FAIL",n)); };
let r=await R("/?url="+encodeURIComponent("https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT"));
T("binance allowed",r.status===200); T("no-store",r.headers.get("cache-control")==="no-store"); T("no cacheEverything",!calls.at(-1).init.cf.cacheEverything); T("cors",r.headers.get("access-control-allow-origin")==="*"); T("cookie stripped",!r.headers.get("set-cookie")); T("version header",r.headers.get("x-qv-relay")==="2.1");
r=await R("/?url="+encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/AAPL")); T("yahoo cached 15s",calls.at(-1).init.cf.cacheTtl===15&&calls.at(-1).init.cf.cacheEverything);
r=await R("/?url="+encodeURIComponent("https://evil.example.com/x")); T("deny host",r.status===403);
r=await R("/?url="+encodeURIComponent("http://api.binance.com/x")); T("https only",r.status===400);
r=await R("/?url="+encodeURIComponent("https://api.binance.com:9443/x")); T("port denied",r.status===403);
r=await R("/?url="+encodeURIComponent("https://reportapi.eastmoney.com/x")); T("eastmoney referer",calls.at(-1).init.headers.Referer==="https://data.eastmoney.com/");
r=await R("/?url="+encodeURIComponent("https://invest-public-api.tinkoff.ru/rest/x"),{method:"POST",body:"{}",headers:{authorization:"Bearer T","content-type":"application/json"}}); T("tbank auth forwarded",calls.at(-1).init.headers.Authorization==="Bearer T"&&calls.at(-1).init.headers["Content-Type"]==="application/json");
r=await R("/?url="+encodeURIComponent("https://finnhub.io/api/v1/x"),{headers:{authorization:"Bearer SECRET"}}); T("auth NOT forwarded elsewhere",!calls.at(-1).init.headers.Authorization);
r=await R("/health"); const j=await r.json(); T("health",j.ok&&j.v==="2.1");
r=await R("/ws/binance"); T("ws needs upgrade",r.status===426);
r=await R("/ws/binance",{headers:{Upgrade:"websocket"}}); T("ws proxied",calls.at(-1).u==="https://data-stream.binance.vision/ws");
r=await R("/",{method:"OPTIONS"}); T("options",r.status===204);
r=await R("/"); T("missing url",r.status===400);
// --- static site routing (ASSETS binding mocked)
const env={ASSETS:{fetch:async(rq)=>new Response("ASSET:"+new URL(rq.url).pathname)}};
const RS=(base,path,opt)=>w.fetch(new Request(base+path,opt),env);
r=await RS("https://futuretrainingnow.com","/"); T("site root -> assets",(await r.text())==="ASSET:/");
r=await RS("https://futuretrainingnow.com","/app/"); T("site app -> assets",(await r.text())==="ASSET:/app/");
r=await RS("https://futuretrainingnow.com","/?url="+encodeURIComponent("https://api.binance.com/api/v3/ping")); T("relay call on main host still relays",r.headers.get("x-qv-relay")==="2.1");
r=await RS("https://relay.futuretrainingnow.com","/"); T("relay host root = relay (400 missing url)",r.status===400);
r=await RS("https://futuretrainingnow.com","/health"); T("health on main host",(await r.json()).ok===true);
r=await RS("https://futuretrainingnow.com","/ws/binance"); T("ws route on main host = relay",r.status===426);
console.log("relay tests",ok,"ok",bad,"fail"); process.exit(bad?1:0);
