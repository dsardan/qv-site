/* QuantView — Structure & Risk (injected module)
 * Adds an independent overlay tool to the existing app: epistemic gate +
 * structure discovery + volatility/tail risk, fed by the same Stooq feed.
 * Does NOT touch the React tree. Vanilla DOM + canvas. No new permissions.
 * Engines validated separately (found planted signal, rejected noise/RW).
 * ========================================================================= */
(function (root) {
'use strict';
if (root.__QVS_LOADED) return; root.__QVS_LOADED = true;

/* ---------- ENGINE 1: epistemic gate ---------- */
function gammln(x){var c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];var y=x,t=x+5.5;t-=(x+0.5)*Math.log(t);var s=1.000000000190015;for(var j=0;j<6;j++)s+=c[j]/++y;return -t+Math.log(2.5066282746310005*s/x);}
function gserP(a,x){var ap=a,sum=1/a,del=sum;for(var n=0;n<300;n++){ap++;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*1e-13)break;}return sum*Math.exp(-x+a*Math.log(x)-gammln(a));}
function gcfQ(a,x){var F=1e-300,b=x+1-a,c=1/F,d=1/b,h=d;for(var i=1;i<=300;i++){var an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<F)d=F;c=b+an/c;if(Math.abs(c)<F)c=F;d=1/d;var del=d*c;h*=del;if(Math.abs(del-1)<1e-13)break;}return Math.exp(-x+a*Math.log(x)-gammln(a))*h;}
function gammp(a,x){if(x<=0)return 0;return x<a+1?gserP(a,x):1-gcfQ(a,x);}
function chi2sf(q,k){return q<=0?1:1-gammp(k/2,q/2);}
function erfc(x){var z=Math.abs(x),t=1/(1+0.5*z);var r=t*Math.exp(-z*z-1.26551223+t*(1.00002368+t*(0.37409196+t*(0.09678418+t*(-0.18628806+t*(0.27886807+t*(-1.13520398+t*(1.48851587+t*(-0.82215223+t*0.17087277))))))))); return x>=0?r:2-r;}
function acf(x,h){var n=x.length,m=0,i,k;for(i=0;i<n;i++)m+=x[i];m/=n;var d0=0;for(i=0;i<n;i++){var e=x[i]-m;d0+=e*e;}var out=[];for(k=1;k<=h;k++){var s=0;for(i=k;i<n;i++)s+=(x[i]-m)*(x[i-k]-m);out.push(d0===0?0:s/d0);}return out;}
function ljungBox(x,h,dfA){var n=x.length;if(n<=h+1)return{Q:0,df:1,p:1};var r=acf(x,h),Q=0;for(var k=1;k<=h;k++)Q+=r[k-1]*r[k-1]/(n-k);Q*=n*(n+2);var df=Math.max(1,h-(dfA||0));return{Q:Q,df:df,p:chi2sf(Q,df)};}
function sgn(v){return v>0?1:v<0?-1:0;}
function epistemicGate(realized,predicted,opts){opts=opts||{};var alpha=opts.alpha||0.05,h=opts.lags||10,minN=opts.minN||30;var n=Math.min(realized.length,predicted.length),i;var resid=[],ssm=0,ssn=0;for(i=0;i<n;i++){var e=realized[i]-predicted[i];resid.push(e);ssm+=e*e;ssn+=realized[i]*realized[i];}var oosR2=ssn===0?0:1-ssm/ssn;var hits=0,tries=0;for(i=0;i<n;i++){if(predicted[i]===0)continue;tries++;if(sgn(predicted[i])===sgn(realized[i]))hits++;}var z=tries>0?(hits-tries/2)/(0.5*Math.sqrt(tries)):0;var pHit=0.5*erfc(z/Math.SQRT2);var edge=(oosR2>0)&&(tries>0)&&(z>0)&&(pHit<alpha);var sq=resid.map(function(e){return e*e;});var arch=ljungBox(sq,h,0);var vol=arch.p<alpha;var low=n<minN;var tier,claim;if(edge&&!low){tier='D';claim='point+interval';}else if(vol){tier='S';claim='distribution/risk-only';}else{tier='N';claim='no-forecast';}return{tier:tier,claim:claim,lowPower:low,n:n,metrics:{oosR2:oosR2,hitRate:tries?hits/tries:null,hitZ:z,hitP:pHit,committedBars:tries,archP:arch.p},verdictKey:tier==='D'?'gate.tierD':tier==='S'?'gate.tierS':'gate.tierN'};}

/* ---------- ENGINE 2: discovery ---------- */
function mean(a){var s=0,i;for(i=0;i<a.length;i++)s+=a[i];return a.length?s/a.length:0;}
function std(a,m){if(m==null)m=mean(a);var s=0,i;for(i=0;i<a.length;i++){var e=a[i]-m;s+=e*e;}return a.length>1?Math.sqrt(s/(a.length-1)):0;}
function corr(x,y){var n=Math.min(x.length,y.length),mx=0,my=0,i;for(i=0;i<n;i++){mx+=x[i];my+=y[i];}mx/=n;my/=n;var sxy=0,sxx=0,syy=0;for(i=0;i<n;i++){var dx=x[i]-mx,dy=y[i]-my;sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;}return(sxx>0&&syy>0)?sxy/Math.sqrt(sxx*syy):0;}
function shuffle(a,rng){var b=a.slice(),i,j,t;for(i=b.length-1;i>0;i--){j=Math.floor(rng()*(i+1));t=b[i];b[i]=b[j];b[j]=t;}return b;}
function blockShuffle(a,rng,L){var n=a.length;L=Math.max(2,L||Math.round(Math.sqrt(n)));var nb=Math.ceil(n/L),blocks=[],i;for(i=0;i<nb;i++)blocks.push(a.slice(i*L,Math.min((i+1)*L,n)));for(i=blocks.length-1;i>0;i--){var j=Math.floor(rng()*(i+1));var t=blocks[i];blocks[i]=blocks[j];blocks[j]=t;}var out=[];for(i=0;i<blocks.length;i++)out=out.concat(blocks[i]);return out.slice(0,n);}
function mul32(seed){return function(){seed|=0;seed=(seed+0x6D2B79F5)|0;var t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function buildFeatures(ret,closes){
  function slice(t,k){return ret.slice(Math.max(1,t-k+1),t+1);}
  return [
    {name:'mom1', meaning:{ru:'вчерашний возврат',he:'תשואת אתמול',en:'yesterday return'},fn:function(t){return ret[t];}},
    {name:'mom5', meaning:{ru:'моментум 5д',he:'מומנטום 5י',en:'5d momentum'},fn:function(t){var s=slice(t,5);return s.length?mean(s)*s.length:null;}},
    {name:'mom10',meaning:{ru:'моментум 10д',he:'מומנטום 10י',en:'10d momentum'},fn:function(t){var s=slice(t,10);return s.length?s.reduce(function(a,b){return a+b;},0):null;}},
    {name:'revers',meaning:{ru:'реверсия',he:'היפוך',en:'reversal'},fn:function(t){return -sgn(ret[t]);}},
    {name:'vol10',meaning:{ru:'волатильность 10д',he:'תנודתיות 10י',en:'10d volatility'},fn:function(t){var s=slice(t,10);return s.length>1?std(s):null;}},
    {name:'volShk',meaning:{ru:'шок волатильности',he:'זעזוע תנודתיות',en:'vol shock'},fn:function(t){var s=slice(t,10);var sd=s.length>1?std(s):0;return sd>0?Math.abs(ret[t])/sd:null;}},
    {name:'accel',meaning:{ru:'ускорение тренда',he:'תאוצת מגמה',en:'trend accel'},fn:function(t){var a=slice(t,5),b=slice(t-5,5);return(a.length&&b.length)?(mean(a)-mean(b)):null;}},
    {name:'rngPos',meaning:{ru:'положение в диапазоне',he:'מיקום בטווח',en:'range position'},fn:function(t){var lo=1e18,hi=-1e18,i;for(i=Math.max(0,t-19);i<=t;i++){if(closes[i]<lo)lo=closes[i];if(closes[i]>hi)hi=closes[i];}return hi>lo?(closes[t]-lo)/(hi-lo)-0.5:null;}}
  ];
}
function fitD(rows,Y,feats,corrMin){var P=feats.length,params=[],j;var tMean=mean(Y),tStd=std(Y,tMean);for(j=0;j<P;j++){var col=[];for(var i=0;i<rows.length;i++)col.push(rows[i][j]);var m=mean(col),s=std(col,m);var z=s>0?col.map(function(v){return(v-m)/s;}):col.map(function(){return 0;});var c=s>0?corr(z,Y):0;if(Math.abs(c)<corrMin)c=0;params.push({m:m,s:s,w:c});}return{params:params,tMean:tMean,tStd:tStd};}
function predD(row,f,damp){var num=0,den=0,j;for(j=0;j<row.length;j++){var p=f.params[j];if(p.s>0&&p.w!==0){var z=(row[j]-p.m)/p.s;num+=p.w*z;den+=Math.abs(p.w);}}var raw=den>0?num/den:0;return damp*(f.tMean+raw*f.tStd);}
function walkForward(X,Y,opts){var M=X.length;var minTrain=Math.max(opts.minTrain,Math.floor(M*0.4));var step=Math.max(1,Math.floor((M-minTrain)/opts.folds));var pred=new Array(M).fill(null),start;for(start=minTrain;start<M;start+=step){var end=Math.min(start+step,M);var f=fitD(X.slice(0,start),Y.slice(0,start),opts.feats,opts.corrMin);for(var t=start;t<end;t++)pred[t]=predD(X[t],f,opts.damp);}var ss=0,ss0=0,i;for(i=0;i<M;i++){if(pred[i]==null)continue;var e=Y[i]-pred[i];ss+=e*e;ss0+=Y[i]*Y[i];}return{pred:pred,oosR2:ss0>0?1-ss/ss0:0};}
/* ---------- Deflated Sharpe Ratio (Lopez de Prado & Bailey) ----------
   PSR: P(true SR > benchmark) adjusting for track length, skew and kurtosis.
   DSR = PSR against a benchmark SR0 = the EXPECTED MAXIMUM Sharpe from N independent
   trials under the null (skill=0). Guards against performance overfitting / selection
   bias: the best of many backtests looks good by luck; DSR deflates that away. */
function psr(sr,sr0,T,skewv,kurtv){
  if(!(T>1)) return 0.5;
  var den=Math.sqrt(Math.max(1e-9, 1 - skewv*sr + ((kurtv-1)/4)*sr*sr));
  return normCdfS((sr - sr0)*Math.sqrt(T-1)/den);
}
function deflatedSR(stratRet, trials, srList){
  var GAMMA=0.5772156649015329, n=(stratRet?stratRet.length:0);
  if(n<20) return {sr:0,sr0:0,dsr:0.5,psr0:0.5,T:n,N:1,skew:0,kurt:3};
  var sk=skewKurt(stratRet), sr=(sk.sd>0? sk.mean/sk.sd : 0), kurt=sk.exKurt+3, T=n;
  var N=Math.max(1, Math.round(trials||1)), varSR;
  if(srList && srList.length>1) varSR=variance(srList);          // true cross-trial SR dispersion
  else varSR=(1 + 0.5*sr*sr)/T;                                   // asymptotic SR-estimator variance (proxy)
  var sr0=0;
  if(N>1 && varSR>0) sr0=Math.sqrt(varSR)*((1-GAMMA)*normInv(1-1/N) + GAMMA*normInv(1-1/(N*Math.E)));
  return {sr:sr, sr0:sr0, dsr:psr(sr,sr0,T,sk.skew,kurt), psr0:psr(sr,0,T,sk.skew,kurt), T:T, N:N, skew:sk.skew, kurt:kurt};
}
function discoverStructure(closesIn,opts){
  opts=opts||{};var alpha=opts.alpha||0.05,B=opts.perms||200,folds=opts.folds||6,minTrain=opts.minTrain||40,corrMin=opts.corrMin||0.03,damp=opts.damp||0.5,seed=opts.seed||12345;
  var closes=[],i;for(i=0;i<closesIn.length;i++){var c=+closesIn[i];if(isFinite(c)&&c>0)closes.push(c);}
  var N=closes.length;if(N<minTrain+20)return{ok:false,reason:'insufficient-history',n:N};
  var ret=[0];for(i=1;i<N;i++)ret.push(Math.log(closes[i]/closes[i-1]));
  var feats=buildFeatures(ret,closes),tMin=20,X=[],Y=[];
  for(var t=tMin;t<=N-2;t++){var row=[],ok=true;for(var j=0;j<feats.length;j++){var v=feats[j].fn(t);if(v==null||!isFinite(v)){ok=false;break;}row.push(v);}if(ok){X.push(row);Y.push(ret[t+1]);}}
  if(X.length<minTrain+10)return{ok:false,reason:'insufficient-samples',n:X.length};
  var wf={feats:feats,folds:folds,minTrain:minTrain,corrMin:corrMin,damp:damp};
  var real=walkForward(X,Y,wf);
  var rng=mul32(seed),ge=0,bl=Math.max(2,Math.round(Math.sqrt(Y.length)));for(var b=0;b<B;b++){if(walkForward(X,blockShuffle(Y,rng,bl),wf).oosR2>=real.oosR2)ge++;}
  var pPerm=(ge+1)/(B+1);
  var realized=[],predicted=[];for(i=0;i<X.length;i++){if(real.pred[i]==null)continue;realized.push(Y[i]);predicted.push(real.pred[i]);}
  var _strat=[];for(i=0;i<predicted.length;i++){var _dp=predicted[i];_strat.push((_dp>0?1:(_dp<0?-1:0))*realized[i]);}
  var _ds=deflatedSR(_strat, opts.trials||1);   // DSR deflates the strategy SR for #trials + skew/kurtosis
  var gate=epistemicGate(realized,predicted,{alpha:alpha});
  var allowed=(gate.tier!=='N')&&(pPerm<alpha);
  var full=fitD(X,Y,feats,corrMin),rule=[];
  for(j=0;j<feats.length;j++){var w=full.params[j].w;if(w!==0)rule.push({name:feats[j].name,meaning:feats[j].meaning,weight:+w.toFixed(4),direction:w>0?'+':'-'});}
  rule.sort(function(a,b){return Math.abs(b.weight)-Math.abs(a.weight);});
  var fNext=null,lastRow=[],okL=true;for(j=0;j<feats.length;j++){var lv=feats[j].fn(N-1);if(lv==null||!isFinite(lv)){okL=false;break;}lastRow.push(lv);}if(okL)fNext=predD(lastRow,full,damp);
  return{ok:true,forecastAllowed:allowed,tier:allowed?gate.tier:'N',forecastNext:allowed?fNext:null,rule:rule,
    stats:{oosR2:+real.oosR2.toFixed(5),pPermutation:+pPerm.toFixed(4),gateTier:gate.tier,samples:X.length,blockLen:bl,featCount:feats.length,selCount:rule.length,sr:+_ds.sr.toFixed(4),psr:+_ds.psr0.toFixed(4),dsr:+_ds.dsr.toFixed(4),dsrTrials:_ds.N,srSkew:+_ds.skew.toFixed(4),srKurt:+_ds.kurt.toFixed(4),stratLen:_ds.T},
    verdictKey:allowed?'disc.found':(gate.tier!=='N'?'disc.snoop':'disc.none')};
}

/* ---------- ENGINE 3: volatility & tails ---------- */
function variance(a,m){if(m==null)m=mean(a);var s=0,i;for(i=0;i<a.length;i++){var e=a[i]-m;s+=e*e;}return a.length>1?s/(a.length-1):0;}
function quantile(s,q){if(!s.length)return 0;var h=(s.length-1)*q,lo=Math.floor(h),hi=Math.ceil(h);return s[lo]+(s[hi]-s[lo])*(h-lo);}
function skewKurt(a){var m=mean(a),n=a.length,s2=0,s3=0,s4=0,i;for(i=0;i<n;i++){var d=a[i]-m;s2+=d*d;s3+=d*d*d;s4+=d*d*d*d;}var v=s2/n,sd=Math.sqrt(v);return{skew:sd>0?(s3/n)/(sd*sd*sd):0,exKurt:v>0?(s4/n)/(v*v)-3:0,sd:sd,mean:m};}
function ewmaPath(ret,l){var warm=Math.min(30,ret.length),v0=variance(ret.slice(0,warm)),out=new Array(ret.length);out[0]=v0;for(var t=1;t<ret.length;t++)out[t]=l*out[t-1]+(1-l)*ret[t-1]*ret[t-1];return out;}
function _garchLL(ret,VL,a,b){if(a<0||b<0||a+b>=0.999)return -1e18;var om=(1-a-b)*VL,s2=VL,ll=0,t;for(t=1;t<ret.length;t++){s2=om+a*ret[t-1]*ret[t-1]+b*s2;if(s2<=0)return -1e18;ll+=-0.5*(Math.log(s2)+ret[t]*ret[t]/s2);}return ll;}
function _nmGarch(ret,VL,seed){ // Nelder-Mead maximisation of the QMLE log-likelihood
  function nv(p){return -_garchLL(ret,VL,p[0],p[1]);}
  var S=[seed.slice(),[seed[0]+0.03,seed[1]],[seed[0],seed[1]+0.03]],it,al=1,ga=2,rho=0.5,si=0.5;
  for(it=0;it<160;it++){ S.sort(function(x,y){return nv(x)-nv(y);});
    var c=[(S[0][0]+S[1][0])/2,(S[0][1]+S[1][1])/2];
    var xr=[c[0]+al*(c[0]-S[2][0]),c[1]+al*(c[1]-S[2][1])];
    if(nv(xr)<nv(S[0])){var xe=[c[0]+ga*(xr[0]-c[0]),c[1]+ga*(xr[1]-c[1])];S[2]=nv(xe)<nv(xr)?xe:xr;}
    else if(nv(xr)<nv(S[1])){S[2]=xr;}
    else{var xc=[c[0]+rho*(S[2][0]-c[0]),c[1]+rho*(S[2][1]-c[1])];
      if(nv(xc)<nv(S[2]))S[2]=xc; else{S[1]=[S[0][0]+si*(S[1][0]-S[0][0]),S[0][1]+si*(S[1][1]-S[0][1])];S[2]=[S[0][0]+si*(S[2][0]-S[0][0]),S[0][1]+si*(S[2][1]-S[0][1])];}}
  }
  S.sort(function(x,y){return nv(x)-nv(y);}); return S[0];
}
function fitGarch(ret){
  var VL=variance(ret),n=ret.length; if(VL<=0||n<60) return{ok:false};
  var best=null,a,b;                              // coarse grid ONLY to seed the optimiser
  for(a=0;a<=0.30001;a+=0.05){ for(b=0.5;b<=0.95001;b+=0.05){ if(a+b>=0.999)continue;
    var ll=_garchLL(ret,VL,a,b); if(best==null||ll>best.ll) best={a:a,b:b,ll:ll}; } }
  if(!best) return{ok:false};
  var opt=_nmGarch(ret,VL,[best.a,best.b]);       // refine off the grid (removes 0.02 boundary bias)
  var A=Math.max(0,Math.min(0.999,opt[0])), B=Math.max(0,Math.min(0.999,opt[1]));
  if(A+B>=0.999||_garchLL(ret,VL,A,B)<best.ll){ A=best.a; B=best.b; }   // fail-safe to grid
  var om=(1-A-B)*VL, p=A+B;
  return{ok:true,alpha:A,beta:B,om:om,persistence:p,halfLife:p<1?Math.log(0.5)/Math.log(p):Infinity,longRunVar:VL};
}
function cfQ(zq,s,k){return zq+(zq*zq-1)*s/6+(zq*zq*zq-3*zq)*k/24-(2*zq*zq*zq-5*zq)*s*s/36;}
function normInv(p){var a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];var b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];var c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];var d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];var pl=0.02425,q,r;if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}if(p<=1-pl){q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
function gpdTail(ret,conf){try{
  var L=ret.map(function(r){return -r;}); L.sort(function(a,b){return a-b;});
  var n=L.length; if(n<80) return null;
  var u=quantile(L,0.90);
  var ex=[],i; for(i=0;i<n;i++){ if(L[i]>u) ex.push(L[i]-u); }
  var Nu=ex.length; if(Nu<15) return null;
  ex.sort(function(a,b){return a-b;});
  // Probability-Weighted Moments (Hosking & Wallis 1987) — efficient, low-bias, closed
  // form. Validated by simulation to recover xi far better than method-of-moments on
  // heavy tails (xi=0.40: PWM~0.398 vs MoM~0.336). MoM kept only as degenerate fallback.
  var a0=0,a1=0; for(i=0;i<Nu;i++){ a0+=ex[i]; a1+=ex[i]*((Nu-1-i)/(Nu-1)); } a0/=Nu; a1/=Nu;
  var den=a0-2*a1, xi, beta;
  if(Math.abs(den)<1e-12){ var m=mean(ex),s2=0; for(i=0;i<Nu;i++){var d=ex[i]-m; s2+=d*d;} s2/=Nu;
    if(s2<=0) return null; xi=0.5*(1-m*m/s2); beta=0.5*m*(m*m/s2+1); }
  else { xi=2-a0/den; beta=2*a0*a1/den; }
  if(!isFinite(xi)||!isFinite(beta)||beta<=0||xi>=1) return null;
  var t=(n/Nu)*(1-conf), varL, esL;
  if(Math.abs(xi)<1e-6){ varL=u-beta*Math.log(t); esL=varL+beta; }
  else { varL=u+(beta/xi)*(Math.pow(t,-xi)-1); esL=(xi<1)?(varL+beta-xi*u)/(1-xi):null; }
  if(!isFinite(varL)||varL<=0) return null;
  QVDiag.check("gpdTail","shape xi>=1 implies an infinite mean, ES undefined", xi<1, "xi="+xi.toFixed(3));
  QVDiag.check("gpdTail","ES below VaR", (esL==null)||(esL>=varL), "ES="+(esL!=null?(esL*100).toFixed(2):"n/a")+" VaR="+(varL*100).toFixed(2));
  QVDiag.finite("gpdTail","beta",beta);
  return {varPct:varL*100, esPct:(esL!=null&&isFinite(esL))?esL*100:null, xi:xi, u:u, beta:beta};
}catch(e){return null;}}
// ── ES backtest: Acerbi & Székely (2014), Test 2 ────────────────────────────────
// Kupiec/Christoffersen test the VaR quantile only. Since positions are sized off ES,
// the ES itself must be backtested. Z2 = 1 − (1/(N·α))·Σ (L_t·I_t)/ES,  L=−ret,
// I_t=1{L_t>VaR}. Under H0, E[Z2]=0; Z2<0 ⇒ realised tail losses exceed the model ES
// (ES underestimated). Significance by Monte-Carlo drawing N losses from the FITTED
// model (GPD tail above u + empirical body below u) — no invented critical value.
function gpdRand(xi,beta,rnd){ rnd=rnd||mul32(0x9E3779B1|0); var U=rnd(); return (Math.abs(xi)<1e-6)?(-beta*Math.log(1-U)):((beta/xi)*(Math.pow(1-U,-xi)-1)); }
function esBacktestAS(ret,vf,ef,conf,gpd,rnd){
  rnd=rnd||mul32(0x9E3779B1|0);   // seeded PRNG: the ES p-value must be reproducible/auditable
  var alpha=1-conf, n=ret.length, i;
  if(!(vf>0)||!(ef>0)||n<80) return null;
  if(!(ef>=vf)) return {z2:null,exceptions:null,expected:+(alpha*n).toFixed(1),pval:null,ok:false,method:'invalid',reason:'ES<VaR'};
  // ES is the mean of losses BEYOND VaR, so it can never sit below VaR.
  QVDiag.check("esBacktest","ES below VaR — impossible by definition", ef>=vf,
    "ES="+(ef*100).toFixed(2)+"% VaR="+(vf*100).toFixed(2)+"%");
  QVDiag.sample("esBacktest","returns",n,80);
  function z2(L){ var s=0,exc=0,j; for(j=0;j<L.length;j++){ if(L[j]>vf){ s+=L[j]/ef; exc++; } } return {z:1-s/(L.length*alpha), exc:exc}; }
  var Lobs=ret.map(function(r){return -r;});
  var o=z2(Lobs), Zobs=o.z, p=null;
  if(gpd&&gpd.u!=null&&gpd.beta!=null&&isFinite(gpd.xi)){
    var body=Lobs.filter(function(x){return x<=gpd.u;}); if(!body.length) body=Lobs.slice();
    var rate=0.10, B=1000, cnt=0, b;                    // u sits at the 90th percentile in gpdTail
    for(b=0;b<B;b++){
      var sim=new Array(n);
      for(i=0;i<n;i++){ sim[i]=(rnd()<rate)?(gpd.u+gpdRand(gpd.xi,gpd.beta,rnd)):body[(rnd()*body.length)|0]; }
      if(z2(sim).z<=Zobs) cnt++;
    }
    p=(cnt+1)/(B+1);                                     // one-sided: underestimation (left tail)
  }
  return { z2:+Zobs.toFixed(3), exceptions:o.exc, expected:+(alpha*n).toFixed(1),
    pval:(p!=null?+p.toFixed(3):null), ok:(p!=null?p>0.05:Math.abs(Zobs)<0.10), method:(p!=null?'MC-GPD':'point') };
}
// ── Total price vector (circular statistics) ──────────────────────────────────
// Every component signal is summed as a VECTOR: direction from the resultant angle,
// magnitude from its length. Formally this is the mean resultant of a set of
// directional statistics (Mardia & Jupp, "Directional Statistics"): component i
// contributes a unit vector at angle θᵢ = tanh(zᵢ)·π/2, resultant R = Σ(cos θ, sin θ),
// coherence R̄ = |R|/k ∈ [0,1]. R̄→1: all components point the same way; R̄→0: they cancel.
//
// Two things this deliberately does NOT do:
//  1) It does not use the classical Rayleigh test. The components are all functions of
//     the SAME close series, so they are strongly dependent and Rayleigh would report
//     wildly overstated significance. The null is a BLOCK PERMUTATION of the return
//     series (same device as discoverStructure), which preserves that dependence.
//  2) It does not convert coherence into a hit probability. R̄ measures AGREEMENT among
//     indicators, not their correctness — they can agree and be wrong together. It is
//     reported as a gate and an amplitude, never as "N% accurate".
function vecComponents(closes){
  var n=closes.length; if(n<40) return null;
  var ret=[],i; for(i=1;i<n;i++) ret.push(Math.log(closes[i]/closes[i-1]));
  var s=std(ret)||1e-9;
  function z(v){ return isFinite(v)?Math.max(-4,Math.min(4,v)):0; }
  function retK(k){ return (n>k)?Math.log(closes[n-1]/closes[n-1-k])/(s*Math.sqrt(k)):0; }
  var out=[{name:'mom5',z:z(retK(5))},{name:'mom10',z:z(retK(10))},{name:'mom20',z:z(retK(20))}];
  var w=closes.slice(-20),m=mean(w),sx=0,sy=0,k,mid=(w.length-1)/2;
  for(k=0;k<w.length;k++){ sx+=(k-mid)*(w[k]-m); sy+=(k-mid)*(k-mid); }
  out.push({name:'trend',z:z((sy?sx/sy:0)/((closes[n-1]*s)||1e-9))});
  var ma=mean(w),mad=mean(w.map(function(x){return Math.abs(x-ma);}))||1e-9;
  out.push({name:'mad',z:z((closes[n-1]-ma)/mad)});
  var g=0,l=0; for(i=n-14;i<n;i++){ var d=closes[i]-closes[i-1]; if(d>0)g+=d; else l-=d; }
  out.push({name:'rsi',z:z((((g+l)>0?g/(g+l):0.5)-0.5)*4)});
  // short-term reversal, not momentum, is what dominates 2-3 day horizons
  // (Lehmann 1990; Jegadeesh 1990)
  var r1=(acf(ret,1)||[0])[0]||0;
  out.push({name:'revers',z:z(-r1*(ret[ret.length-1]/s)*2)});
  return out;
}
function totalVector(closesIn,opts){
  opts=opts||{};
  var closes=(closesIn||[]).filter(function(v){return isFinite(v)&&v>0;});
  var comp=vecComponents(closes); if(!comp) return {ok:false};
  function resultant(cs){
    var Rx=0,Ry=0,j; for(j=0;j<cs.length;j++){ var th=Math.tanh(cs[j].z)*Math.PI/2; Rx+=Math.cos(th); Ry+=Math.sin(th); }
    return {y:Ry,len:Math.sqrt(Rx*Rx+Ry*Ry)/cs.length,ang:Math.atan2(Ry,Rx)};
  }
  var R=resultant(comp),n=closes.length,ret=[],i;
  for(i=1;i<n;i++) ret.push(Math.log(closes[i]/closes[i-1]));
  var B=opts.perms||200,rng=mul32(opts.seed||12345),cnt=0,b;
  for(b=0;b<B;b++){
    var pr=blockShuffle(ret,rng,Math.round(Math.sqrt(ret.length)));
    var pc=[closes[0]],t; for(t=0;t<pr.length;t++) pc.push(pc[t]*Math.exp(pr[t]));
    var c2=vecComponents(pc); if(c2&&resultant(c2).len>=R.len) cnt++;
  }
  var p=(cnt+1)/(B+1),H=opts.horizon||3,sd=std(ret)||0;
  QVDiag.check("totalVector","coherence outside 0..1", R.len>=0&&R.len<=1.0001, "R="+R.len.toFixed(3));
  QVDiag.check("totalVector","permutation p-value outside 0..1", p>0&&p<=1, "p="+p.toFixed(3));
  return { ok:true, coherence:+R.len.toFixed(3), angleDeg:+(R.ang*180/Math.PI).toFixed(1),
    dir:(R.y>0?1:(R.y<0?-1:0)), ampPct:+(R.len*sd*Math.sqrt(H)*100).toFixed(2),
    pval:+p.toFixed(3), significant:(p<(opts.alpha||0.05)),
    components:comp.map(function(c){return {name:c.name,z:+c.z.toFixed(2)};}) };
}
// ── Fokker-Planck density propagation, finite elements (P1) ───────────────────
// Rather than guessing a direction, solve how the whole probability density of the
// log-price evolves over the horizon:
//     dp/dt = -d/dx( mu p ) + 1/2 d2/dx2( sigma^2(x) p )
// P1 linear elements on a uniform grid in x = ln(S/S0), Crank-Nicolson in time,
// Thomas algorithm per step. From the resulting density P(move >= k%) follows exactly.
// mu is NOT fitted: the log-drift is set to the Ito correction -sigma^2/2, i.e. no
// predictable return is assumed. sigma(x) carries a leverage tilt estimated from data.
// Verified against the analytic Gaussian for constant sigma: max |CDF error| = 8.0e-4.
// ── QVDiag: invariant layer ──────────────────────────────────────────────────
// Every computation node asserts what must be true about its own output. Violations are
// counted, not thrown: a diagnostic must never take the app down. Nodes are instrumented
// in proportion to how likely they are to produce a wrong number, which in this codebase
// has historically been (1) unit confusion between fractions and percents, (2) direction
// and target/stop disagreeing, (3) probabilities escaping [0,1], (4) silent NaN from a
// division by zero, (5) statistics computed on a sample too small to support them.
// ── Data health ──────────────────────────────────────────────────────────────
// A forecast is only as trustworthy as the series under it, so provenance and freshness
// are assessed explicitly rather than assumed. What counts as "stale" depends on the
// session: during regular hours a quote minutes old is already behind, while after the
// close the previous session's bar IS the current truth and must not be flagged.
// Weekends and holidays are handled by allowing a longer gap when the market is closed.
function dataHealth(sym,closes){
  var m=_META[sym]||{}, now=Date.now(), reasons=[], level="green";
  function down(to,why){ if(to==="red"||level==="green") level=(to==="red")?"red":(level==="red"?"red":"amber"); reasons.push(why); }
  var ageMs=(m.asOf!=null)?(now-m.asOf):null;
  var ageH=(ageMs!=null)?ageMs/3600000:null;
  var st=String(m.marketState||"").toUpperCase(), open=(st==="REGULAR");
  if(m.asOf==null){ down("amber",TL('\u0432\u0440\u0435\u043c\u044f \u0434\u0430\u043d\u043d\u044b\u0445 \u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e','\u05d6\u05de\u05df \u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2','timestamp unknown')); }
  else if(open){
    if(ageH>1) down("red",TL('\u0442\u043e\u0440\u0433\u0438 \u0438\u0434\u0443\u0442, \u0430 \u043a\u043e\u0442\u0438\u0440\u043e\u0432\u043a\u0435 '+ageH.toFixed(1)+' \u0447','\u05de\u05d9\u05d5\u05e9\u05df','market open but quote is '+ageH.toFixed(1)+'h old'));
    else if(ageH>0.34) down("amber",TL('\u043a\u043e\u0442\u0438\u0440\u043e\u0432\u043a\u0430 \u043e\u0442\u0441\u0442\u0430\u0451\u0442 \u043d\u0430 '+Math.round(ageH*60)+' \u043c\u0438\u043d','\u05de\u05e2\u05d5\u05db\u05d1','quote lags by '+Math.round(ageH*60)+' min'));
  } else {
    // closed: allow the weekend, flag only a genuinely missed session
    var lim=(new Date(now).getUTCDay()===1)?96:(ageH>0?80:80);
    if(ageH>lim) down("red",TL('\u0434\u0430\u043d\u043d\u044b\u0435 \u0441\u0442\u0430\u0440\u0448\u0435 '+Math.round(ageH/24)+' \u0434\u043d\u0435\u0439','\u05d9\u05e9\u05df','data older than '+Math.round(ageH/24)+' days'));
    else if(ageH>32) down("amber",TL('\u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u0430 \u0442\u043e\u0440\u0433\u043e\u0432\u0430\u044f \u0441\u0435\u0441\u0441\u0438\u044f','\u05d7\u05e1\u05e8','a trading session appears to be missing'));
  }
  // restored from a previous session: the numbers are real but they are not live
  if(m.transport==="cache") down("amber",TL('\u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043e \u0438\u0437 \u043a\u0435\u0448\u0430 \u2014 \u043d\u043e\u0432\u043e\u0433\u043e \u0441\u043a\u0430\u043d\u0430 \u043d\u0435 \u0431\u044b\u043b\u043e','\u05de\u05d4\u05de\u05d8\u05de\u05d5\u05df','restored from cache — no fresh scan'));
  if(m.transport&&m.transport.indexOf("proxy")===0) down("amber",TL('\u0434\u0430\u043d\u043d\u044b\u0435 \u0447\u0435\u0440\u0435\u0437 \u0440\u0435\u0442\u0440\u0430\u043d\u0441\u043b\u044f\u0442\u043e\u0440, \u043d\u0435 \u043e\u0442 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430','\u05d3\u05e8\u05da \u05de\u05de\u05e1\u05e8','served through a relay, not the source'));
  if(m.transport==="stooq") down("amber",TL('\u0440\u0435\u0437\u0435\u0440\u0432\u043d\u044b\u0439 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a (Stooq, \u0431\u0435\u0437 \u0432\u043d\u0443\u0442\u0440\u0438\u0434\u043d\u0435\u0432\u043d\u044b\u0445)','\u05de\u05e7\u05d5\u05e8 \u05d2\u05d9\u05d1\u05d5\u05d9','fallback source (Stooq, no intraday)'));
  // repeated identical closes at the end usually mean a frozen or padded feed
  if(closes&&closes.length>=5){
    var tail=closes.slice(-5), same=tail.every(function(v){return v===tail[0];});
    if(same) down("red",TL('\u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 5 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439 \u043e\u0434\u0438\u043d\u0430\u043a\u043e\u0432\u044b \u2014 \u043f\u043e\u0442\u043e\u043a \u0437\u0430\u043c\u043e\u0440\u043e\u0436\u0435\u043d','\u05e7\u05e4\u05d5\u05d0','last 5 closes identical — feed appears frozen'));
  }
  if(m.bars&&m.bars<120) down("amber",TL('\u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u0432\u0441\u0435\u0433\u043e '+m.bars+' \u0431\u0430\u0440\u043e\u0432','\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d4 \u05e7\u05e6\u05e8\u05d4','only '+m.bars+' bars of history'));
  if(m.isFund) down("amber",TL('NAV \u0444\u043e\u043d\u0434\u0430 \u043f\u0443\u0431\u043b\u0438\u043a\u0443\u0435\u0442\u0441\u044f \u0441 \u0437\u0430\u0434\u0435\u0440\u0436\u043a\u043e\u0439','NAV \u05de\u05ea\u05e2\u05db\u05d1','fund NAV is published with a delay'));
  return {level:level, reasons:reasons, ageH:ageH, marketState:st||"?", transport:m.transport||"?", bars:m.bars||(closes?closes.length:0), asOf:m.asOf||null};
}
var QVDiag=(function(){
  var V={}, order=[];
  function rec(node,rule,detail){
    var k=node+"|"+rule;
    if(!V[k]){ V[k]={node:node,rule:rule,n:0,first:detail||"",last:detail||""}; order.push(k); }
    V[k].n++; if(detail) V[k].last=detail;
    try{ window.QELog&&window.QELog.warn&&window.QELog.warn("QVDiag",node+": "+rule+(detail?(" — "+detail):"")); }catch(e){}
  }
  return {
    check:function(node,rule,cond,detail){ if(!cond) rec(node,rule,detail); return !!cond; },
    finite:function(node,name,v){
      if(v===null||v===undefined) return true;               // absent is legitimate
      var okv=(typeof v==="number")&&isFinite(v);
      if(!okv) rec(node,name+" is not finite",String(v));
      return okv;
    },
    prob:function(node,name,v){
      if(v===null||v===undefined) return true;
      if(!(typeof v==="number"&&isFinite(v))){ rec(node,name+" is not finite",String(v)); return false; }
      if(v<0||v>100){ rec(node,name+" outside 0..100",name+"="+v); return false; }
      return true;
    },
    pct01:function(node,name,v){    // guards the fraction-vs-percent class of bug
      if(v===null||v===undefined) return true;
      if(Math.abs(v)>0&&Math.abs(v)<0.0005){ rec(node,name+" looks like a fraction where a percent is expected",name+"="+v); return false; }
      return true;
    },
    sample:function(node,name,n,need){
      if(!(n>=need)){ rec(node,name+" sample below the minimum the statistic requires","n="+n+" need>="+need); return false; }
      return true;
    },
    list:function(){ return order.map(function(k){return V[k];}); },
    total:function(){ var t=0; order.forEach(function(k){t+=V[k].n;}); return t; },
    reset:function(){ V={}; order=[]; }
  };
})();
try{ root.QVDiag=QVDiag; }catch(e){}
// ── Risk management ──────────────────────────────────────────────────────────
// Four checks, each answering a distinct way a trader loses money on a setup that
// looks fine. None of them predicts anything; they judge the trade already on screen.
//
// 1. BREAK-EVEN WIN RATE. A trade risking S to make T only pays if it wins more often
//    than S/(T+S). That number is arithmetic, not opinion. Comparing it with the
//    probability the price actually reaches the target (solved from the Fokker-Planck
//    density, not from stated confidence) says whether the setup has positive expectancy.
// 2. EXPECTED VALUE per unit risked, from the same probability.
// 3. POSITION SIZE by fractional Kelly, floored at zero. Kelly is the growth-optimal
//    fraction; full Kelly is far too aggressive against estimated (not known)
//    probabilities, so a quarter is used, and the EVT-ES budget still caps it.
//    When the edge is negative Kelly returns zero, which is the correct size.
// 4. STOP INSIDE NOISE. A stop closer than about 1.5 horizon-sigma gets hit by ordinary
//    fluctuation regardless of direction, converting a fair setup into a losing one.
// ── Limits to arbitrage ──────────────────────────────────────────────────────
// McLean & Pontiff (2016) found the surviving anomaly return concentrates in stocks with
// high idiosyncratic risk and low liquidity — precisely where arbitrage is expensive and
// mispricing is not competed away. The same paper is why edges get a decay haircut above.
// This scores where a surviving edge is even plausible. It predicts nothing on its own:
// a cheap-to-arbitrage mega-cap is where a claimed edge is most likely already gone.
function arbitrageLimits(closes,bars){
  var n=(closes||[]).length; if(n<80) return {ok:false};
  var ret=[],i; for(i=1;i<n;i++) ret.push(Math.log(closes[i]/closes[i-1]));
  var sd=std(ret)||0;
  var score=0, parts=[];
  // volatility: a proxy for idiosyncratic risk when no benchmark series is at hand,
  // labelled as such rather than dressed up as a true residual
  var volPct=sd*100;
  if(volPct>=3.5){score+=2;parts.push('vol');} else if(volPct>=2.0){score+=1;parts.push('vol');}
  var advUsd=null, illiq=null;
  if(bars&&bars.length>=60){
    var pi=priceImpact(bars,{move:0.07});
    if(pi&&pi.ok){ advUsd=pi.advUsd; illiq=pi.illiq;
      if(advUsd<5e7){score+=2;parts.push('thin');} else if(advUsd<5e8){score+=1;parts.push('thin');}
    }
  }
  var level=score>=3?'high':score>=2?'medium':'low';
  return {ok:true,score:score,level:level,volPct:+volPct.toFixed(2),advUsd:advUsd,parts:parts};
}
// ── Portfolio risk ───────────────────────────────────────────────────────────
// A list of ten picks is not ten independent bets. If they move together, acting on all
// of them multiplies one exposure rather than spreading it, and the loss arrives on every
// line at once. This measures how much independence is actually there and caps total
// exposure accordingly — the single largest risk the app was silent about.
// ── Density picture ──────────────────────────────────────────────────────────
// The numbers above are hard to feel. Drawing the solved density with the target and stop
// marked on it makes the whole argument visible at a glance: how far into the tail the
// target sits, and how much of the mass lies past the stop on the other side.
function densityCurve(closes,opts){
  opts=opts||{};
  var f=fpSolveFor((closes||[]).filter(function(v){return isFinite(v)&&v>0;}),opts.horizon||5);
  if(!f) return null;
  var sol=f.sol, pts=[], i;
  // keep the informative window: +-6 horizon sigma around spot
  var span=Math.min(0.45, 6*f.s0*Math.sqrt(opts.horizon||5));
  for(i=0;i<sol.N;i++){
    if(sol.x[i]<-span||sol.x[i]>span) continue;
    pts.push({x:sol.x[i], y:sol.p[i]});
  }
  if(pts.length<10) return null;
  return {pts:pts, span:span, sigma:f.s0, sol:sol};
}
// Portfolio picture: a correlation grid and a bar contrasting rows on screen with the
// number of genuinely independent bets among them. High correlation is the hazard here,
// so warm cells mean danger rather than strength.
function drawPortfolio(container,PF){
  if(!PF||!PF.C||!PF.tickers||PF.n<2) return false;
  var NS='http://www.w3.org/2000/svg';
  function mk(t,a){ var e=document.createElementNS(NS,t); for(var k in a) e.setAttribute(k,a[k]); return e; }
  var n=Math.min(PF.n,10), cell=19, lab=44, W=lab+n*cell+4, H=lab+n*cell+4;
  var svg=mk('svg',{viewBox:'0 0 '+W+' '+H,width:'100%',height:Math.min(H,230),preserveAspectRatio:'xMinYMin meet'});
  svg.style.cssText='display:block;margin-top:6px;overflow:visible;';
  function colFor(r){
    if(r>=0.75) return '#e05a6a';
    if(r>=0.55) return '#f0a63c';
    if(r>=0.30) return '#c8b45c';
    if(r>=0.00) return '#3f7f76';
    return '#33e0c8';
  }
  var i,j;
  for(i=0;i<n;i++){
    var tl=mk('text',{x:lab-4,y:lab+i*cell+cell*0.68,fill:DIM,'font-size':'8','font-family':'monospace','text-anchor':'end'});
    tl.textContent=String(PF.tickers[i]||'').slice(0,5); svg.appendChild(tl);
    var tt=mk('text',{x:lab+i*cell+cell*0.5,y:lab-5,fill:DIM,'font-size':'8','font-family':'monospace','text-anchor':'start',
      transform:'rotate(-60 '+(lab+i*cell+cell*0.5)+' '+(lab-5)+')'});
    tt.textContent=String(PF.tickers[i]||'').slice(0,5); svg.appendChild(tt);
    for(j=0;j<n;j++){
      var r=(PF.C[i]&&PF.C[i][j]!=null)?PF.C[i][j]:0;
      svg.appendChild(mk('rect',{x:lab+j*cell,y:lab+i*cell,width:cell-1.5,height:cell-1.5,rx:2,
        fill:(i===j?GRID:colFor(r)),opacity:(i===j?'0.5':'0.85')}));
    }
  }
  container.appendChild(svg);
  // rows versus real bets
  var barW=300,barH=26;
  var b=mk('svg',{viewBox:'0 0 '+barW+' '+barH,width:'100%',height:barH,preserveAspectRatio:'none'});
  b.style.cssText='display:block;margin-top:8px;overflow:visible;';
  var frac=Math.max(0.02,Math.min(1,PF.nEff/PF.n));
  b.appendChild(mk('rect',{x:0,y:6,width:barW,height:11,rx:5,fill:GRID}));
  b.appendChild(mk('rect',{x:0,y:6,width:barW*frac,height:11,rx:5,fill:(frac>=0.7?PH:frac>=0.35?AM:'#e05a6a')}));
  for(i=1;i<PF.n;i++){
    var xg=barW*(i/PF.n);
    b.appendChild(mk('line',{x1:xg,y1:6,x2:xg,y2:17,stroke:BG,'stroke-width':'1.4'}));
  }
  container.appendChild(b);
  return true;
}
// ── FDR-corrected discovery verdict ────────────────────────────────────────────
// discoverStructure tests ONE ticker at alpha=0.05 in isolation. But this tool is used to
// screen many tickers over a session — the auto-badge on every scan winner, plus every
// manual check the user runs — and testing many candidates at a fixed per-test alpha
// inflates the false-discovery rate across the whole screening program: at alpha=0.05,
// roughly 1 in 20 NULL tickers reads "found" purely by chance, and that adds up fast
// across dozens of checks. This is the exact multiple-comparisons problem documented in
// Benjamini & Hochberg (1995, JRSS-B) and, for trading-strategy screening specifically,
// Harvey, Liu & Zhu (2016) and the McLean & Pontiff (2016) evidence already cited in the
// risk layer above. The fix here is the Benjamini-Hochberg step-up procedure — verified
// against the canonical open-source implementation in statsmodels.stats.multitest
// (github.com/statsmodels/statsmodels) — applied to the ACCUMULATED history of every
// p-value this tool has produced, not to each ticker in isolation.
var _PVAL_KEY='qe_disc_pvals', _PVAL_MAX=60, _PVAL_MAXAGE_MS=90*24*3600*1000;
// Window capped at 60, not left to grow to _PVAL_MAX's old ceiling: measured on synthetic
// data, m~60 keeps false discoveries near ~2% while retaining real power (p=0.002 -> 100%
// detected, p=0.005 -> 32%) at q=0.20. A larger accumulated m would keep tightening the
// bar until even strong genuine edges stop clearing it — the moving window is a deliberate
// choice, not an arbitrary one.
function _pvalHistory(){
  try{ var h=JSON.parse(localStorage.getItem(_PVAL_KEY)||'[]'); return Array.isArray(h)?h:[]; }catch(e){ return []; }
}
function _pvalSave(h){ try{ localStorage.setItem(_PVAL_KEY, JSON.stringify(h.slice(-_PVAL_MAX))); }catch(e){} }
// Step-up BH: sort ascending, find the largest k with p_(k) <= (k/m)*q; that p_(k) is the
// threshold. Every entry at or below it is a discovery. Matches statsmodels fdrcorrection
// (method='indep') exactly — same ecdf-scaling, same reverse-cummin for adjusted q-values.
function bhThreshold(pvals,q,dep){
  // Benjamini-Yekutieli (2001) by default: cross-sectional test stats share market
  // factors, so the independence assumption of plain BH is violated. BY divides the
  // rank bar by the harmonic number c(m)=Σ1/i, controlling FDR under ARBITRARY
  // dependence. Pass dep=false to fall back to independent BH.
  dep=(dep!==false);
  var m=pvals.length; if(!m) return {thresh:0,k:0,m:0,cm:1};
  var cm=1; if(dep){ cm=0; for(var t=1;t<=m;t++) cm+=1/t; }
  var sorted=pvals.slice().sort(function(a,b){return a-b;});
  var k=0,i;
  for(i=0;i<m;i++){ if(sorted[i]<=((i+1)/(m*cm))*q) k=i+1; }
  return {thresh:k>0?sorted[k-1]:0, k:k, m:m, cm:cm, method:dep?'BY':'BH'};
}
// Record this ticker's fresh p-value, then decide its verdict against the FULL
// accumulated history (including itself) rather than against alpha alone.
function fdrVerdict(ticker,pPerm,gateTier,q){
  q=q||0.20;   // screening context: BH-FDR at 20%, the level the cited literature treats
               // as standard for "many candidates, keep the honest survivors" (vs. the
               // much stricter Bonferroni bound, which the EdgeTools/statsmodels sources
               // above note throws away too many real effects in exactly this setting)
  var now=Date.now(), h=_pvalHistory().filter(function(r){ return (now-r.ts)<_PVAL_MAXAGE_MS; });
  var idx=-1,i; for(i=0;i<h.length;i++){ if(h[i].t===ticker){ idx=i; break; } }
  var rec={t:ticker,p:pPerm,ts:now};
  if(idx>=0) h[idx]=rec; else h.push(rec);
  _pvalSave(h);
  var pvals=h.map(function(r){return r.p;});
  var bh=bhThreshold(pvals,q);
  var fdrPass = pPerm<=bh.thresh && bh.k>0 && gateTier!=='N';
  var rawPass = (gateTier!=='N') && pPerm<0.05;
  var verdictKey = fdrPass ? 'disc.found' : (rawPass ? 'disc.snoop' : 'disc.none');
  // rawPass-but-!fdrPass is the case worth naming explicitly: it cleared the naive bar
  // but not the corrected one, i.e. exactly the false-discovery risk this guards against.
  return {verdictKey:verdictKey, fdrPass:fdrPass, rawPass:rawPass, bhThresh:bh.thresh,
    m:bh.m, k:bh.k, q:q, overridden:(rawPass&&!fdrPass)};
}
function drawDensity(container,closes,geo,opts){
  opts=opts||{};
  var d=densityCurve(closes,opts); if(!d) return false;
  var W=300,H=104,PADL=6,PADR=6,PADT=8,PADB=16;
  var maxY=0,i; for(i=0;i<d.pts.length;i++) if(d.pts[i].y>maxY) maxY=d.pts[i].y;
  if(!(maxY>0)) return false;
  function sx(x){ return PADL+((x+d.span)/(2*d.span))*(W-PADL-PADR); }
  function sy(y){ return H-PADB-(y/maxY)*(H-PADT-PADB); }
  var NS='http://www.w3.org/2000/svg';
  function mk(t,a){ var e=document.createElementNS(NS,t); for(var k in a) e.setAttribute(k,a[k]); return e; }
  var svg=mk('svg',{viewBox:'0 0 '+W+' '+H,width:'100%',height:H,preserveAspectRatio:'none'});
  svg.style.cssText='display:block;margin-top:6px;overflow:visible;';
  // logs of the two barriers, in the same coordinate as the density
  var px=+((geo&&geo.px)||0), tg=+((geo&&geo.tgt)||0), st=+((geo&&geo.stp)||0);
  var xt=(px>0&&tg>0)?Math.log(tg/px):null, xs=(px>0&&st>0)?Math.log(st/px):null;
  function areaPath(from,to,col){
    var seg=d.pts.filter(function(q){return q.x>=from&&q.x<=to;});
    if(seg.length<2) return null;
    var p='M '+sx(seg[0].x)+' '+(H-PADB);
    for(var k=0;k<seg.length;k++) p+=' L '+sx(seg[k].x)+' '+sy(seg[k].y);
    p+=' L '+sx(seg[seg.length-1].x)+' '+(H-PADB)+' Z';
    return mk('path',{d:p,fill:col,opacity:'0.30'});
  }
  // shade the two outcomes that matter
  if(xt!=null){ var a1=areaPath(Math.min(xt,d.span),d.span,(xt>0?PH:TL_)); if(a1) svg.appendChild(a1); }
  if(xs!=null){ var a2=areaPath(-d.span,Math.max(xs,-d.span),(xs<0?TL_:PH)); if(a2) svg.appendChild(a2); }
  // the density itself
  var path='';
  for(i=0;i<d.pts.length;i++) path+=(i?' L ':'M ')+sx(d.pts[i].x)+' '+sy(d.pts[i].y);
  svg.appendChild(mk('path',{d:path,fill:'none',stroke:INK,'stroke-width':'1.6','stroke-linejoin':'round'}));
  // spot, target, stop
  svg.appendChild(mk('line',{x1:sx(0),y1:PADT-4,x2:sx(0),y2:H-PADB,stroke:DIM,'stroke-width':'1','stroke-dasharray':'2,2'}));
  function marker(xv,col,label){
    if(xv==null||xv<-d.span||xv>d.span) return;
    svg.appendChild(mk('line',{x1:sx(xv),y1:PADT-4,x2:sx(xv),y2:H-PADB,stroke:col,'stroke-width':'1.4'}));
    var t=mk('text',{x:sx(xv),y:H-4,fill:col,'font-size':'8.5','font-family':'monospace','text-anchor':'middle'});
    t.textContent=label; svg.appendChild(t);
  }
  marker(xt,PH,(xt!=null?((xt>0?'+':'')+(Math.exp(xt)*100-100).toFixed(1)+'%'):''));
  marker(xs,TL_,(xs!=null?((xs>0?'+':'')+(Math.exp(xs)*100-100).toFixed(1)+'%'):''));
  var t0=mk('text',{x:sx(0),y:H-4,fill:DIM,'font-size':'8.5','font-family':'monospace','text-anchor':'middle'});
  t0.textContent=TL('\u0446\u0435\u043d\u0430','\u05de\u05d7\u05d9\u05e8','spot'); svg.appendChild(t0);
  container.appendChild(svg);
  return true;
}
function portfolioRisk(items,opts){
  opts=opts||{};
  var rows=(items||[]).filter(function(it){ return it&&it.closes&&it.closes.length>=40; });
  var n=rows.length; if(n<2) return {ok:false,reason:'too-few'};
  var rets=rows.map(function(it){
    var c=it.closes,r=[],i; for(i=1;i<c.length;i++) r.push(Math.log(c[i]/c[i-1])); return r;
  });
  var L=Math.min.apply(null,rets.map(function(r){return r.length;}));
  if(L<30) return {ok:false,reason:'short'};
  rets=rets.map(function(r){ return r.slice(-L); });
  var sig=rets.map(function(r){ return std(r)||1e-9; });
  var i,j,sumRho=0,pairs=0,maxRho=-1,maxPair=null;
  var C=[]; for(i=0;i<n;i++){ C.push(new Array(n)); C[i][i]=1; }
  for(i=0;i<n;i++) for(j=i+1;j<n;j++){
    var rho=corr(rets[i],rets[j]); if(!isFinite(rho)) rho=0;
    C[i][j]=C[j][i]=rho; sumRho+=rho; pairs++;
    if(rho>maxRho){ maxRho=rho; maxPair=[rows[i].ticker,rows[j].ticker]; }
  }
  var rhoBar=pairs?sumRho/pairs:0;
  // equal-weight portfolio volatility from the full covariance, not from an average
  var w=1/n, varP=0;
  for(i=0;i<n;i++) for(j=0;j<n;j++) varP+=w*w*sig[i]*sig[j]*C[i][j];
  var sigP=Math.sqrt(Math.max(varP,0));
  var sumW=0; for(i=0;i<n;i++) sumW+=w*sig[i];
  var divRatio=(sigP>0)?(sumW/sigP):1;
  // effective independent bets: n when uncorrelated, 1 when everything moves as one
  var nEff=(1+(n-1)*Math.max(0,rhoBar))>0 ? n/(1+(n-1)*Math.max(0,rhoBar)) : n;
  var H=opts.horizon||5, budget=(opts.budgetPct!=null?opts.budgetPct:5);
  // Proper 99% Expected Shortfall of the equal-weight book from its OWN realised
  // return series (correlation is already embedded in the sum). Cornish-Fisher lifts
  // the Gaussian quantile for skew/kurtosis; historical ES is the empirical tail mean;
  // take the more conservative, scale by sqrt(H). Replaces the old 2.33*sigma (which was
  // a Normal 99% VaR mislabelled as ES; the Normal ES factor is 2.665, and Normality
  // contradicts the GPD tail work elsewhere).
  var rp=[],tt; for(tt=0;tt<L;tt++){ var sm=0; for(i=0;i<n;i++) sm+=rets[i][tt]; rp.push(sm/n); }
  var skp=skewKurt(rp), sortedRp=rp.slice().sort(function(x,y){return x-y;}), qlo=0.01;
  var hVaR=quantile(sortedRp,qlo), tailArr=sortedRp.filter(function(x){return x<=hVaR;});
  var hES=tailArr.length?mean(tailArr):hVaR;
  var zq=normInv(qlo), cfES=skp.mean+skp.sd*cfQ(zq,skp.skew,skp.exKurt);
  var esDaily=Math.min(hES,cfES);               // most-negative = worst loss
  var esP=Math.max(0,-esDaily)*Math.sqrt(H)*100;
  QVDiag.check("portfolioRisk","portfolio ES not below portfolio VaR", esP>=Math.max(0,-hVaR)*Math.sqrt(H)*100-1e-9, "esP="+esP.toFixed(2));
  var maxExposure=(esP>0)?Math.min(100,budget/esP*100):100;
  var dirs=rows.map(function(it){return it.dir||0;});
  var ups=dirs.filter(function(d){return d>0;}).length, dns=dirs.filter(function(d){return d<0;}).length;
  var oneWay=(ups===0||dns===0);
  var flags=[];
  if(rhoBar>=0.6) flags.push('herd');
  if(nEff<Math.max(2,n*0.35)) flags.push('concentrated');
  if(oneWay&&n>=4) flags.push('one-way');
  // the matrix itself travels with the summary so the panel can draw it rather than
  // recompute it from series it no longer has
  var Cr=C.map(function(row){ return row.map(function(v){ return +(+v).toFixed(2); }); });
  return {ok:true,n:n,tickers:rows.map(function(r){return r.ticker;}),C:Cr,
    rhoBar:+rhoBar.toFixed(2),maxRho:+maxRho.toFixed(2),maxPair:maxPair,
    nEff:+nEff.toFixed(1),divRatio:+divRatio.toFixed(2),sigmaPortDaily:+(sigP*100).toFixed(2),
    esPortPct:+esP.toFixed(1),maxExposurePct:+maxExposure.toFixed(1),budgetPct:budget,
    ups:ups,downs:dns,flags:flags};
}
function riskManagement(closes,geo,opts){
  opts=opts||{};
  var px=+((geo&&geo.px)||0), tgt=+((geo&&geo.tgt)||0), stp=+((geo&&geo.stp)||0);
  if(!(px>0&&tgt>0&&stp>0)) return {ok:false,reason:'no-geometry'};
  var up=(tgt>px);
  if(up?!(stp<px):!(stp>px)) return {ok:false,reason:'stop-on-wrong-side'};
  var tPct=Math.abs((tgt-px)/px)*100, sPct=Math.abs((px-stp)/px)*100;
  if(!(tPct>0&&sPct>0)) return {ok:false,reason:'degenerate'};
  var rr=tPct/sPct, be=sPct/(tPct+sPct);
  // Neutral baseline: for a driftless walk the chance of touching the target before the
  // stop is the distance ratio in log space (the gambler's-ruin result). It lands on the
  // break-even rate almost exactly, which is the whole point — without a real directional
  // edge a stop/target pair is a fair coin before costs and a losing one after them.
  var p0 = up ? (Math.log(px/stp)/Math.log(tgt/stp))
              : (Math.log(stp/px)/Math.log(stp/tgt));
  p0=Math.max(0.001,Math.min(0.999,p0));
  // A directional probability is only allowed to move the verdict when the discovery
  // engine has certified the direction out of sample. Unvalidated confidence is exactly
  // how a fair game gets mistaken for an edge.
  var validated=!!opts.validated, pSig=(opts.pSignal!=null)?Math.max(0,Math.min(1,opts.pSignal)):null;
  // DECAY HAIRCUT. McLean & Pontiff (2016) measured published return predictors at 26%
  // weaker out of sample and 58% weaker after publication; later replications put the
  // Sharpe drop at 43-50%. Any edge measured on history is therefore an overstatement of
  // the edge available now, whether it decayed through arbitrage or was overfitted in the
  // first place. Half of the distance between the signal and the neutral baseline is kept
  // — a deliberately conservative reading of a well-replicated result.
  var DECAY_KEEP=0.5;
  var p=(validated&&pSig!=null)?(p0+(pSig-p0)*DECAY_KEEP):p0;
  var edge=p-be;
  var ev=p*tPct-(1-p)*sPct;
  var kelly=(rr>0)?((p*rr-(1-p))/rr):0;
  var kFrac=Math.max(0,kelly)/4;                       // quarter Kelly against estimates
  var mp=moveProbability(closes,{horizon:opts.horizon||5,move:tPct/100});
  var sdDaily=(mp&&mp.ok)?mp.sigmaDaily/100:null;
  var H=opts.horizon||5;
  var sdH=(sdDaily!=null)?sdDaily*Math.sqrt(H):null;
  var stopSigma=(sdH>0)?((sPct/100)/sdH):null;
  var esSize=(opts.esSizePct!=null)?opts.esSizePct:null;
  var sizePct=Math.min(100,kFrac*100,(esSize!=null?esSize:100));
  var why=[];
  if(!validated) why.push('unvalidated');
  if(edge<=0) why.push('no-edge');
  if(rr<1) why.push('rr<1');
  if(stopSigma!=null&&stopSigma<1.5) why.push('stop-in-noise');
  return {ok:true,dir:(up?1:-1),targetPct:+tPct.toFixed(2),stopPct:+sPct.toFixed(2),
    rr:+rr.toFixed(2),breakEven:+(be*100).toFixed(1),neutral:+(p0*100).toFixed(1),
    pUsed:+(p*100).toFixed(1),validated:validated,edgePts:+(edge*100).toFixed(1),
    evPct:+ev.toFixed(2),kelly:+(kelly*100).toFixed(1),sizePct:+sizePct.toFixed(1),
    pRaw:(pSig!=null?+(pSig*100).toFixed(1):null),decayKeep:DECAY_KEEP,
    stopSigma:(stopSigma!=null?+stopSigma.toFixed(2):null),horizon:H,why:why,
    tradeable:(validated&&edge>0&&rr>=1&&(stopSigma==null||stopSigma>=1.5))};
}
function thomasSolve(a,b,c,d){
  var n=b.length,cp=new Float64Array(n),dp=new Float64Array(n),x=new Float64Array(n),i;
  cp[0]=c[0]/b[0]; dp[0]=d[0]/b[0];
  for(i=1;i<n;i++){var m=b[i]-a[i]*cp[i-1];cp[i]=c[i]/m;dp[i]=(d[i]-a[i]*dp[i-1])/m;}
  x[n-1]=dp[n-1];
  for(i=n-2;i>=0;i--) x[i]=dp[i]-cp[i]*x[i+1];
  return x;
}
function fokkerPlanck(sigmaFn,muFn,T,opts){
  opts=opts||{};
  var XMAX=opts.xmax||0.60,N=opts.n||301,steps=opts.steps||120;
  var h=2*XMAX/(N-1),x=new Float64Array(N),i,e;
  for(i=0;i<N;i++) x[i]=-XMAX+i*h;
  var Ma=new Float64Array(N),Mb=new Float64Array(N),Mc=new Float64Array(N);
  var La=new Float64Array(N),Lb=new Float64Array(N),Lc=new Float64Array(N);
  for(e=0;e<N-1;e++){
    var xm=0.5*(x[e]+x[e+1]),s2=Math.pow(sigmaFn(xm),2),mu=muFn(xm);
    Mb[e]+=h/3;Mb[e+1]+=h/3;Mc[e]+=h/6;Ma[e+1]+=h/6;
    var k=(s2/2)/h;
    Lb[e]+=k;Lb[e+1]+=k;Lc[e]-=k;La[e+1]-=k;
    Lb[e]+=mu/2;Lc[e]+=mu/2;La[e+1]-=mu/2;Lb[e+1]-=mu/2;
  }
  // The regularised delta of width w is the exact solution at t0=w^2/sigma^2; starting
  // the run at t0 avoids injecting that variance twice (this correction cut the CDF
  // error from 1.1e-2 to 8.0e-4).
  var s2ref=Math.pow(sigmaFn(0),2)||1e-12,w0=Math.max(2.5*h,1e-4);
  var Teff=Math.max(T*0.05,T-(w0*w0)/s2ref),dt=Teff/steps;
  var Aa=new Float64Array(N),Ab=new Float64Array(N),Ac=new Float64Array(N);
  var Ba=new Float64Array(N),Bb=new Float64Array(N),Bc=new Float64Array(N);
  for(i=0;i<N;i++){
    Aa[i]=Ma[i]+dt/2*La[i];Ab[i]=Mb[i]+dt/2*Lb[i];Ac[i]=Mc[i]+dt/2*Lc[i];
    Ba[i]=Ma[i]-dt/2*La[i];Bb[i]=Mb[i]-dt/2*Lb[i];Bc[i]=Mc[i]-dt/2*Lc[i];
  }
  Ab[0]=1;Ac[0]=0;Aa[N-1]=0;Ab[N-1]=1;
  var p=new Float64Array(N),sum=0;
  for(i=0;i<N;i++){p[i]=Math.exp(-0.5*Math.pow(x[i]/w0,2));sum+=p[i];}
  for(i=0;i<N;i++) p[i]/=(sum*h);
  var rhs=new Float64Array(N),t;
  /* The Crank-Nicolson matrix A is constant over all steps, so its Thomas factorisation (pivots m, cp) is
     computed ONCE with the very same arithmetic as thomasSolve; each step then only does the d-sweep. Bit-identical output. */
  var tPiv=new Float64Array(N),tCp=new Float64Array(N),tDp=new Float64Array(N);
  tCp[0]=Ac[0]/Ab[0];
  for(i=1;i<N;i++){var mm=Ab[i]-Aa[i]*tCp[i-1];tPiv[i]=mm;tCp[i]=Ac[i]/mm;}
  var pn=new Float64Array(N);
  for(t=0;t<steps;t++){
    for(i=0;i<N;i++){var v=Bb[i]*p[i];if(i>0)v+=Ba[i]*p[i-1];if(i<N-1)v+=Bc[i]*p[i+1];rhs[i]=v;}
    rhs[0]=0;rhs[N-1]=0;
    tDp[0]=rhs[0]/Ab[0];
    for(i=1;i<N;i++) tDp[i]=(rhs[i]-Aa[i]*tDp[i-1])/tPiv[i];
    pn[N-1]=tDp[N-1];
    for(i=N-2;i>=0;i--) pn[i]=tDp[i]-tCp[i]*pn[i+1];
    var sw=p;p=pn;pn=sw;
    for(i=0;i<N;i++) if(!isFinite(p[i])||p[i]<0) p[i]=0;
  }
  var m=0;for(i=0;i<N;i++)m+=p[i]*h;
  // The walls are absorbing, so mass CAN leak out; renormalising afterwards would hide it.
  // Measured leak is 1.5e-5 with the domain guard in place, so anything above 1% means the
  // domain is too narrow for this volatility and the tails are being clipped.
  var massOk=QVDiag.check("fokkerPlanck","probability mass leaked through the absorbing walls",
    Math.abs(m-1)<0.01, "mass="+m.toFixed(4));
  var finOk=QVDiag.check("fokkerPlanck","density has non-finite nodes", p.every(function(v){return isFinite(v);}));
  if(m>0) for(i=0;i<N;i++) p[i]/=m;
  return {x:x,p:p,h:h,N:N, ok:(massOk&&finOk)};   // fail-closed: a leaked/NaN density is not trusted downstream
}
function fpCdf(sol,xq){
  var c=0,i;
  for(i=0;i<sol.N-1;i++){
    var xl=sol.x[i],xr=sol.x[i+1];
    if(xr<=xq) c+=0.5*(sol.p[i]+sol.p[i+1])*sol.h;
    else if(xl<xq){var f=(xq-xl)/sol.h;c+=0.5*(sol.p[i]+(sol.p[i]+(sol.p[i+1]-sol.p[i])*f))*sol.h*f;break;}
    else break;
  }
  return Math.max(0,Math.min(1,c));
}
// Shared solver: build the density forecast from a close series, using ONLY that series.
// pitValidate reuses this verbatim so validation exercises the exact production path.
function fpSolveFor(closes,H,so){
  so=so||{};
  var n=closes.length; if(n<60) return null;
  var ret=[],i; for(i=1;i<n;i++) ret.push(Math.log(closes[i]/closes[i-1]));
  var path=ewmaPath(ret,0.94), s0=Math.sqrt(path[path.length-1]);
  if(!(s0>0)) return null;
  // leverage exponent from an OLS regression of log|r_{t+1}| on r_t (the asymmetry
  // slope), replacing a hardcoded *6. slope<0 under the leverage effect; -slope*s0 is
  // dimensionless in the return-coordinate x. Clamp is NUMERICAL (keeps sigma(x)=s0*exp(-lev*x)
  // well-posed across the solved domain), not a statistical cap.
  var xr=[],yr=[],mx=0,my=0; for(i=0;i<ret.length-1;i++){ xr.push(ret[i]); yr.push(Math.log(Math.abs(ret[i+1])+1e-6)); }
  for(i=0;i<xr.length;i++){ mx+=xr[i]; my+=yr[i]; } mx/=xr.length; my/=yr.length;
  var sxy=0,sxx=0; for(i=0;i<xr.length;i++){ var dx=xr[i]-mx; sxy+=dx*(yr[i]-my); sxx+=dx*dx; }
  var slope=sxx>0?sxy/sxx:0;
  var lev=Math.max(0,Math.min(3,-slope*s0));
  var xmax=Math.max(0.60,6*s0*Math.sqrt(H)*Math.exp(3*lev));
  var sol=fokkerPlanck(function(x){return s0*Math.exp(-lev*x);},function(){return -s0*s0/2;},H,
    {steps:so.steps||120,n:so.n||301,xmax:xmax});
  if(!sol||sol.ok===false) return null;           // fail-closed
  return {sol:sol,s0:s0,lev:lev};
}
function moveProbability(closesIn,opts){
  opts=opts||{};
  var closes=(closesIn||[]).filter(function(v){return isFinite(v)&&v>0;});
  if(closes.length<60) return {ok:false};
  var T=opts.horizon||3, k=Math.log(1+(opts.move||0.07));
  var f=fpSolveFor(closes,T); if(!f) return {ok:false};
  var up=1-fpCdf(f.sol,k), dn=fpCdf(f.sol,-k);
  QVDiag.prob("moveProbability","P(up)",up*100);
  QVDiag.prob("moveProbability","P(down)",dn*100);
  QVDiag.check("moveProbability","P(up)+P(down) exceeds 1 — the two tails overlap", up+dn<=1.0001,
    "sum="+(up+dn).toFixed(4));
  QVDiag.check("moveProbability","daily sigma outside a plausible 0.1%..40% range",
    f.s0>0.001&&f.s0<0.40, "sigma="+(f.s0*100).toFixed(2)+"%");
  return {ok:true,sigmaDaily:+(f.s0*100).toFixed(2),leverage:+f.lev.toFixed(2),
    pUp:+(up*100).toFixed(2),pDn:+(dn*100).toFixed(2),horizon:T,movePct:(opts.move||0.07)*100};
}
// -- PIT validation (Diebold, Gunther & Tay 1998) ------------------------------
// Walk-forward: at each origin t the density is built from closes[0..t] ONLY, then the
// realised H-day return is mapped through its own forecast CDF: u = F_t(x_realised).
// If the densities are correctly calibrated, the u values are Uniform(0,1).
// Origins step by H, NOT by 1: overlapping H-day windows are dependent, and feeding
// dependent u into a KS test would overstate significance.
// u piling up near 0 and 1 => tails too thin (big moves underestimated).
// u piling up mid-range   => tails too fat (model too timid).
function normCdfS(z){var t=1/(1+0.2316419*Math.abs(z));
  var d=0.3989422804014327*Math.exp(-z*z/2);
  var pr=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return z>=0?1-pr:pr;}
function pitValidate(closesIn,opts){
  opts=opts||{};
  var closes=(closesIn||[]).filter(function(v){return isFinite(v)&&v>0;});
  var H=opts.horizon||3, minHist=opts.minHist||120, n=closes.length;
  if(n<minHist+H+40) return {ok:false,reason:'short'};
  var u=[],t,kMove=Math.log(1+(opts.move||0.07)),expUp=0,obsUp=0,varUp=0;
  for(t=minHist;t+H<n;t+=H){
    var f=fpSolveFor(closes.slice(0,t+1),H,{steps:60,n:201});
    if(!f) continue;
    var xr=Math.log(closes[t+H]/closes[t]);
    u.push(fpCdf(f.sol,xr));
    // Direct test of the number actually displayed: does P(+move%) come true as often
    // as claimed? The generic KS test has weak power in the tails (measured: it rejects
    // fat-tailed misspecification in only ~25% of runs), and the tails are exactly what
    // P(+7%) depends on. This is a Poisson-binomial check on that one quantity.
    var pu=1-fpCdf(f.sol,kMove);
    expUp+=pu; varUp+=pu*(1-pu); if(xr>=kMove) obsUp++;
  }
  var N=u.length; if(N<20) return {ok:false,reason:'few'};
  QVDiag.check("pitValidate","PIT values outside 0..1 — CDF evaluation is broken",
    u.every(function(v){return v>=0&&v<=1;}));
  QVDiag.sample("pitValidate","non-overlapping origins",N,20);
  var us=u.slice().sort(function(a,b){return a-b;}),D=0,i;
  for(i=0;i<N;i++) D=Math.max(D,Math.abs((i+1)/N-us[i]),Math.abs(us[i]-i/N));
  var lam=(Math.sqrt(N)+0.12+0.11/Math.sqrt(N))*D,q=0,k;
  for(k=1;k<=100;k++) q+=2*Math.pow(-1,k-1)*Math.exp(-2*k*k*lam*lam);
  var p=Math.max(0,Math.min(1,q));
  var lo=0,hi=0; for(i=0;i<N;i++){ if(u[i]<0.05)lo++; if(u[i]>0.95)hi++; }
  var _cc=Math.max(0,Math.abs(obsUp-expUp)-0.5);            // continuity correction: normal approx to a
  var zUp=(varUp>0)?((obsUp>=expUp?_cc:-_cc)/Math.sqrt(varUp)):0; // discrete (Poisson-binomial) count
  var pUpTest=2*(1-normCdfS(Math.abs(zUp)));
  return {ok:true,n:N,ks:+D.toFixed(3),pval:+p.toFixed(3),calibrated:(p>0.05),
    meanU:+mean(u).toFixed(3),tailLo:+(lo/N*100).toFixed(1),tailHi:+(hi/N*100).toFixed(1),
    moveExpected:+expUp.toFixed(1),moveObserved:obsUp,moveZ:+zUp.toFixed(2),
    movePval:+pUpTest.toFixed(3),moveOk:(pUpTest>0.05),movePct:(opts.move||0.07)*100};
}
function priceImpact(bars,opts){
  opts=opts||{};
  var b=(bars||[]).filter(function(r){return r&&isFinite(r.c)&&r.c>0;});
  if(b.length<60) return {ok:false};
  var withV=b.filter(function(r){return r.v>0;});
  if(withV.length<40) return {ok:false,noVolume:true};
  var i,ret=[],dv=[];
  for(i=1;i<b.length;i++){
    if(!(b[i].v>0)) continue;
    ret.push(Math.abs(Math.log(b[i].c/b[i-1].c)));
    dv.push(b[i].c*b[i].v);
  }
  if(ret.length<40) return {ok:false,noVolume:true};
  var ill=[],j; for(j=0;j<ret.length;j++) if(dv[j]>0) ill.push(ret[j]/dv[j]);
  if(!ill.length) return {ok:false,noVolume:true};
  var ILLIQ=mean(ill);
  var sorted=dv.slice().sort(function(x,y){return x-y;});
  var ADV=quantile(sorted,0.5);
  var lr=[]; for(i=1;i<b.length;i++) lr.push(Math.log(b[i].c/b[i-1].c));
  var sd=std(lr)||1e-9;
  var k=opts.move||0.07, Y=opts.Y||1;
  var qLin=(ILLIQ>0)?(k/ILLIQ):null;             // dollars, linear
  var qSqrt=ADV*Math.pow(k/(Y*sd),2);            // dollars, square-root law
  QVDiag.check("priceImpact","average daily dollar volume is not positive", ADV>0, "ADV="+ADV);
  QVDiag.check("priceImpact","illiquidity estimate is not positive", ILLIQ>0, "ILLIQ="+ILLIQ);
  return {ok:true, advUsd:ADV, sigmaDaily:+(sd*100).toFixed(2),
    illiq:ILLIQ, movePct:k*100,
    linAdv:(qLin!=null&&ADV>0)?+(qLin/ADV).toFixed(2):null,
    sqrtAdv:(ADV>0)?+(qSqrt/ADV).toFixed(2):null};
}
function ols4(X,Y){var p=4,A=[],b=[],i,j,k;for(i=0;i<p;i++){A.push([0,0,0,0]);b.push(0);}
  for(k=0;k<X.length;k++){var xr=X[k],yr=Y[k];for(i=0;i<p;i++){b[i]+=xr[i]*yr;for(j=0;j<p;j++)A[i][j]+=xr[i]*xr[j];}}
  for(i=0;i<p;i++)A[i][i]+=1e-3*A[i][i]+1e-12; // relative Tikhonov ridge: HAR day/week/month are near-collinear and
                                               // solving XtX directly squares the condition number; a 0.1% diagonal lift
                                               // (ridge/shrinkage) keeps the solve stable at negligible forecasting bias.
  for(i=0;i<p;i++){var piv=i;for(k=i+1;k<p;k++)if(Math.abs(A[k][i])>Math.abs(A[piv][i]))piv=k;
    if(Math.abs(A[piv][i])<1e-12)return null;if(piv!==i){var tA=A[piv];A[piv]=A[i];A[i]=tA;var tb=b[piv];b[piv]=b[i];b[i]=tb;}
    for(k=i+1;k<p;k++){var f=A[k][i]/A[i][i];for(j=i;j<p;j++)A[k][j]-=f*A[i][j];b[k]-=f*b[i];}}
  var x=[0,0,0,0];for(i=p-1;i>=0;i--){var s=b[i];for(j=i+1;j<p;j++)s-=A[i][j]*x[j];x[i]=s/A[i][i];}return x;}
function harForecast(rv){try{
  var n=rv.length;if(n<40)return null;var X=[],Y=[],t,i;
  for(t=22;t<n;t++){var d=rv[t-1],w=0,m=0;for(i=1;i<=5;i++)w+=rv[t-i];w/=5;for(i=1;i<=22;i++)m+=rv[t-i];m/=22;X.push([1,d,w,m]);Y.push(rv[t]);}
  var beta=ols4(X,Y);if(!beta)return null;
  var d0=rv[n-1],w0=0,m0=0;for(i=1;i<=5;i++)w0+=rv[n-i];w0/=5;for(i=1;i<=22;i++)m0+=rv[n-i];m0/=22;
  var f=beta[0]+beta[1]*d0+beta[2]*w0+beta[3]*m0;if(!isFinite(f)||f<=0)return null;return f;
}catch(e){return null;}}
function kupiec(ret,varLossFrac,conf){
  var n=ret.length; if(n<50||!(varLossFrac>0)) return null;
  var x=0,i; for(i=0;i<n;i++) if(-ret[i]>varLossFrac) x++;
  var p=1-conf, pi=x/n, LR;
  if(x===0) LR=-2*(n*Math.log(1-p));
  else if(x===n) LR=-2*(n*Math.log(p));
  else LR=-2*((n-x)*Math.log(1-p)+x*Math.log(p) - ((n-x)*Math.log(1-pi)+x*Math.log(pi)));
  if(!isFinite(LR)||LR<0) LR=0;
  var pval=erfc(Math.sqrt(LR/2));                 // chi-sq df=1 survival
  return {breaches:x, expected:+(p*n).toFixed(1), ratePct:+(pi*100).toFixed(2), expPct:+(p*100).toFixed(2), pval:+pval.toFixed(3), ok:pval>0.05};
}
function chrInd(ret,varLossFrac){
  var n=ret.length; if(n<50||!(varLossFrac>0)) return null;
  var b=[],i; for(i=0;i<n;i++) b.push(-ret[i]>varLossFrac?1:0);
  var n00=0,n01=0,n10=0,n11=0;
  for(i=1;i<n;i++){ var a=b[i-1],c=b[i]; if(a===0&&c===0)n00++; else if(a===0&&c===1)n01++; else if(a===1&&c===0)n10++; else n11++; }
  var p01=(n00+n01)?n01/(n00+n01):0, p11=(n10+n11)?n11/(n10+n11):0, p=(n01+n11)/((n00+n01+n10+n11)||1);
  function L(pp,x0,x1){ if(x0===0&&x1===0) return 0; if(pp<=0) return x1>0?-1e9:0; if(pp>=1) return x0>0?-1e9:0; return x0*Math.log(1-pp)+x1*Math.log(pp); }
  var LRind=-2*(L(p,n00+n10,n01+n11) - (L(p01,n00,n01)+L(p11,n10,n11)));
  if(!isFinite(LRind)||LRind<0) LRind=0;
  var pval=erfc(Math.sqrt(LRind/2));
  return {n01:n01,n11:n11,pval:+pval.toFixed(3),clustered:pval<=0.05};
}
function volatilityTails(closesIn,opts){
  opts=opts||{};var l=opts.lambda||0.94,H=opts.horizon||10,confs=opts.confs||[0.95,0.99];
  var closes=[],i;for(i=0;i<closesIn.length;i++){var c=+closesIn[i];if(isFinite(c)&&c>0)closes.push(c);}
  var N=closes.length;if(N<80)return{ok:false,reason:'insufficient-history',n:N};
  var ret=[];for(i=1;i<N;i++)ret.push(Math.log(closes[i]/closes[i-1]));var sq=ret.map(function(r){return r*r;});
  var ew=ewmaPath(ret,l),sigmaDaily=Math.sqrt(ew[ew.length-1]),g=fitGarch(ret);var harVar=harForecast(sq);
  var cone=[],cumVar=0;
  if(g.ok){var s2n=g.om+g.alpha*ret[ret.length-1]*ret[ret.length-1]+g.beta*ew[ew.length-1];if(harVar!=null&&isFinite(harVar))s2n=0.5*s2n+0.5*harVar;for(var k=1;k<=H;k++){var ek=g.longRunVar+Math.pow(g.persistence,k-1)*(s2n-g.longRunVar);cumVar+=ek;cone.push({k:k,sigma:Math.sqrt(cumVar)});}}
  else{for(var k2=1;k2<=H;k2++){cumVar+=ew[ew.length-1];cone.push({k:k2,sigma:Math.sqrt(cumVar)});}}
  var volH=cone[cone.length-1].sigma,sk=skewKurt(ret),sortedR=ret.slice().sort(function(a,b){return a-b;});
  function lossPct(r){return(1-Math.exp(r))*100;}
  function tb(conf){var qlo=1-conf;var hV=quantile(sortedR,qlo);var tail=sortedR.filter(function(x){return x<=hV;});var hES=tail.length?mean(tail):hV;var zq=normInv(qlo);var cf=sk.mean+sk.sd*cfQ(zq,sk.skew,sk.exKurt);var hh=[];for(i=0;i+H<ret.length;i++){var s=0;for(var j=0;j<H;j++)s+=ret[i+j];hh.push(s);}hh.sort(function(a,b){return a-b;});var gp=gpdTail(ret,conf);return{conf:conf,histVaR:lossPct(hV),cfVaR:lossPct(cf),histES:lossPct(hES),histVaR_H:lossPct(quantile(hh,qlo)),gpdVaR:gp?gp.varPct:null,gpdES:gp?gp.esPct:null};}
  var cl=root.__gateInternals&&root.__gateInternals.ljungBox?root.__gateInternals.ljungBox(sq,10,0):ljungBox(sq,10,0);
  var _vArr=confs.map(tb);
  var _bt99=(function(){var e=_vArr.filter(function(v){return Math.abs(v.conf-0.99)<1e-9;})[0];if(!e)return null;var vf=(e.gpdVaR!=null?e.gpdVaR:e.cfVaR)/100;var k=kupiec(ret,vf,0.99);if(k){k.ind=chrInd(ret,vf);var _ef=(e.gpdES!=null?e.gpdES:e.histES)/100;k.es=esBacktestAS(ret,vf,_ef,0.99,gpdTail(ret,0.99));}return k;})();
  return{ok:true,n:N,clusteringP:cl.p,clustered:cl.p<0.05,sigmaDailyPct:sigmaDaily*100,harDailyPct:(harVar!=null&&isFinite(harVar))?Math.sqrt(harVar)*100:null,annualPct:sigmaDaily*Math.sqrt(252)*100,garch:g,sigmaPath:ew.map(function(v){return Math.sqrt(v);}),forecast:{horizon:H,volHPct:volH*100,cone:cone},tail:{skew:sk.skew,exKurt:sk.exKurt},var:_vArr,backtest:_bt99};
}
root.__gateInternals={ljungBox:ljungBox};

/* ---------- DATA FEED (reuse app's smartFetch; else proxy fallback) ---------- */
function withProxies(url){return [url,'https://corsproxy.io/?url='+encodeURIComponent(url),'https://api.allorigins.win/raw?url='+encodeURIComponent(url)];}
async function rawFetch(url){
  if(typeof root.smartFetch==='function'){ try{ var r=await root.smartFetch(url,{cache:'no-store'}); if(r&&r.ok) return await r.text(); }catch(e){} }
  var cands=withProxies(url);
  for(var i=0;i<cands.length;i++){ try{ var res=await fetch(cands[i],{cache:'no-store'}); if(res.ok) return await res.text(); }catch(e){} }
  throw new Error('fetch_failed');
}
function _closesFrom(d){
  if(!d) return null;
  var arr = Array.isArray(d) ? d : (d.rows||d.ohlc||d.data||d.candles||d.series||d.points||d.prices||null);
  if(!Array.isArray(arr)) return null;
  var cc=[];
  for(var i=0;i<arr.length;i++){ var r=arr[i];
    var c = (typeof r==='number') ? r
      : (r&&r.close!=null) ? r.close
      : (r&&r.c!=null) ? r.c
      : (r&&r.adjClose!=null) ? r.adjClose
      : (r&&r.y!=null) ? r.y
      : (r&&r.price!=null) ? r.price
      : (r&&r.value!=null) ? r.value
      : (Array.isArray(r) ? (r.length>=5?r[4]:r[r.length-1]) : null);
    c=+c; if(isFinite(c)&&c>0) cc.push(c);
  }
  return cc.length ? cc : null;
}
var _BARS={}, _META={};
function _barsFrom(d){
  try{
    var rows = Array.isArray(d)?d:(d&&(d.rows||d.data||d.candles))||null;
    if(!rows||!rows.length) return null;
    var out=[],i;
    for(i=0;i<rows.length;i++){
      var r=rows[i]||{};
      var c=+(r.close!=null?r.close:(r.c!=null?r.c:NaN));
      var o=+(r.open!=null?r.open:(r.o!=null?r.o:NaN));
      var h=+(r.high!=null?r.high:(r.h!=null?r.h:NaN));
      var l=+(r.low!=null?r.low:(r.l!=null?r.l:NaN));
      var v=+(r.vol!=null?r.vol:(r.volume!=null?r.volume:0));
      // keep OHLC (fallback to close when a field is missing) so candlestick patterns work
      if(isFinite(c)&&c>0) out.push({o:isFinite(o)&&o>0?o:c, h:isFinite(h)&&h>0?h:c, l:isFinite(l)&&l>0?l:c, c:c, v:(isFinite(v)&&v>0)?v:0});
    }
    return out.length?out:null;
  }catch(e){ return null; }
}
async function fetchCloses(sym){
  sym=(''+sym).trim().toUpperCase(); if(!sym) throw new Error('пустой тикер');
  var E=root.EWEngine;
  // 1) app's real, provider-aware fetcher; force:true clears any session blacklist/rate-limit
  if(E&&typeof E.fetchOHLC==='function'){
    var rs=sym; try{ if(typeof E.resolveSymbol==='function'){ var _r=E.resolveSymbol(sym,'US'); if(_r) rs=_r; } }catch(e){}
    var cand = (rs===sym)?[rs]:[rs,sym];
    for(var k=0;k<cand.length;k++){
      try{ var d=await E.fetchOHLC(cand[k],{force:true}); var cc=_closesFrom(d); if(cc&&cc.length>=60){ try{ _BARS[sym]=_barsFrom(d); _META[sym]={asOf:(d&&d._asOf)||null,marketState:(d&&d._marketState)||"",transport:(window.QVTransport?window.QVTransport():"unknown"),bars:cc.length,isFund:!!(d&&d._isFund)}; }catch(_b){} return cc; } }catch(e){}
    }
  }
  // 2) other exposed app feeds
  if(E&&typeof E.fetchHistory==='function'){ try{ var d2=await E.fetchHistory(sym); var c2=_closesFrom(d2); if(c2&&c2.length>=60) return c2; }catch(e){} }
  if(typeof root.fetchStooq==='function'){ try{ var d3=await root.fetchStooq(sym); var c3=_closesFrom(d3); if(c3&&c3.length>=60) return c3; }catch(e){} }
  // 3) last resort: raw Stooq CSV via smartFetch / proxies
  var s = sym.indexOf('.')>=0 ? sym.toLowerCase() : sym.toLowerCase()+'.us';
  var url='https://stooq.com/q/d/l/?s='+s+'&i=d&_='+Date.now();
  var text=await rawFetch(url);
  var lines=(text||'').trim().split('\n'); if(lines.length<40) throw new Error('нет данных (проверь тикер: US без суффикса, иначе с суффиксом)');
  lines.shift();
  var closes=[];
  var _bb=[];
  for(var j=0;j<lines.length;j++){var p=lines[j].split(',');var c=parseFloat(p[4]);var v=parseFloat(p[5]);if(isFinite(c)&&c>0){closes.push(c);_bb.push({c:c,v:(isFinite(v)&&v>0)?v:0});}}
  try{ _BARS[sym]=_bb; _META[sym]={asOf:(function(){var L=lines[lines.length-1]||"";var d0=L.split(",")[0];var t=Date.parse(d0+"T20:00:00Z");return isFinite(t)?t:null;})(),marketState:"CLOSED",transport:"stooq",bars:closes.length,isFund:false}; }catch(_b){}
  if(closes.length<60) throw new Error('слишком короткая история (<60 дней)');
  return closes;
}

/* ---------- LOCALIZATION (reuse app's _TL if present) ---------- */
function MSX(v){ var m={REGULAR:['\u0442\u043e\u0440\u0433\u0438','\u05de\u05e1\u05d7\u05e8','trading'],CLOSED:['\u0431\u0438\u0440\u0436\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u0430','\u05d4\u05d1\u05d5\u05e8\u05e1\u05d4 \u05e1\u05d2\u05d5\u05e8\u05d4','market closed'],PRE:['\u043f\u0440\u0435\u043c\u0430\u0440\u043a\u0435\u0442','\u05e4\u05e8\u05d4-\u05de\u05e8\u05e7\u05d8','pre-market'],PREPRE:['\u043f\u0440\u0435\u043c\u0430\u0440\u043a\u0435\u0442','\u05e4\u05e8\u05d4-\u05de\u05e8\u05e7\u05d8','pre-market'],POST:['\u043f\u043e\u0441\u0442\u043c\u0430\u0440\u043a\u0435\u0442','\u05e4\u05d5\u05e1\u05d8-\u05de\u05e8\u05e7\u05d8','after-hours'],POSTPOST:['\u043f\u043e\u0441\u0442\u043c\u0430\u0440\u043a\u0435\u0442','\u05e4\u05d5\u05e1\u05d8-\u05de\u05e8\u05e7\u05d8','after-hours']}[v]; return m?TL(m[0],m[1],m[2]):v; }
function TPX(v){ var m={direct:['\u043d\u0430\u043f\u0440\u044f\u043c\u0443\u044e','\u05d9\u05e9\u05d9\u05e8','direct'],relay:['\u0440\u0435\u043b\u0435\u0439','\u05de\u05de\u05e9\u05e8','relay'],unknown:['\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e','\u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2','unknown']}[v]; return m?TL(m[0],m[1],m[2]):v; }
function TL(ru,he,en){ try{ return root._TL?root._TL(ru,he,en):ru; }catch(e){ return ru; } }
function guessTicker(){
  var els=document.querySelectorAll('input[type=text],input:not([type]),input[type=search]');
  for(var i=0;i<els.length;i++){var v=(els[i].value||'').trim();if(/^[A-Za-z][A-Za-z.\-]{0,7}$/.test(v))return v.toUpperCase();}
  return '';
}

/* ---------- UI ---------- */
var PH='#33e0c8', AM='#f0a63c', MU='#5c6f79', TL_='#e05a6a', BG='#0d1418', PANEL='#131e24', GRID='#1e2f38', INK='#c8d6dc', DIM='#7f97a1';
// Σ-panel palette follows the app theme (qe_theme). Default (null) = light, matching the app.
function _qvPalette(){
  var light=true; try{ light=(localStorage.getItem('qe_theme')!=='dark'); }catch(e){}
  if(light){ PH='#0a9fc4'; AM='#c8880a'; MU='#8a99ad'; TL_='#e24961'; BG='#ffffff'; PANEL='#eef2f8'; GRID='#dde4ef'; INK='#101826'; DIM='#6d7c96'; }
  else { PH='#33e0c8'; AM='#f0a63c'; MU='#5c6f79'; TL_='#e05a6a'; BG='#0d1418'; PANEL='#131e24'; GRID='#1e2f38'; INK='#c8d6dc'; DIM='#7f97a1'; }
}
function css(){
  try{ var old=document.getElementById('qvs-style'); if(old) old.parentNode.removeChild(old); }catch(e){}
  var s=document.createElement('style'); s.id='qvs-style';
  s.textContent=[
    '.qvs-fab{position:fixed;right:16px;bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:2147483000;background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:26px;padding:11px 15px;font:600 13px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;box-shadow:0 4px 18px -6px #000;cursor:pointer}',
    '.qvs-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(4,8,10,.6);display:none}',
    '.qvs-ov.on{display:block}',
    '.qvs-sheet{position:absolute;left:0;right:0;bottom:0;max-height:88%;overflow:auto;background:'+BG+';border-top:1px solid '+GRID+';color:'+INK+';font-family:ui-monospace,Menlo,Consolas,monospace;padding:14px 14px 26px}',
    '.qvs-sheet *{box-sizing:border-box}',
    '.qvs-hd{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid '+GRID+';padding-bottom:10px;margin-bottom:12px}',
    '.qvs-ttl{font-weight:700;letter-spacing:.2em;font-size:13px}.qvs-ttl b{color:'+PH+'}',
    '.qvs-x{background:none;border:none;color:'+DIM+';font-size:20px;cursor:pointer}',
    '.qvs-row{display:flex;gap:8px;margin-bottom:12px}',
    '.qvs-in{flex:1;background:'+PANEL+';border:1px solid '+GRID+';color:'+INK+';font-family:inherit;font-size:14px;padding:9px 11px;letter-spacing:.1em;text-transform:uppercase}',
    '.qvs-go{background:'+PH+';color:#03110e;border:none;font-weight:700;font-family:inherit;font-size:13px;padding:9px 16px;cursor:pointer}',
    '.qvs-stamp{display:flex;gap:12px;align-items:center;border:1px solid '+GRID+';background:'+PANEL+';padding:12px;margin-bottom:12px}',
    '.qvs-badge{flex:0 0 auto;border:1px solid;border-radius:4px;padding:6px 10px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;letter-spacing:.1em;white-space:nowrap}',
    '.qvs-D{color:'+PH+';border-color:'+PH+'}.qvs-S{color:'+AM+';border-color:'+AM+'}.qvs-N{color:'+MU+';border-color:'+MU+'}',
    '.qvs-stamp-top{display:flex;align-items:center;gap:10px;margin-bottom:7px;flex-wrap:wrap}.qvs-sym{font-weight:700;font-size:14px;color:'+INK+'}.qvs-vs{font-size:12px;color:'+DIM+';line-height:1.45}',
    '.qvs-card{border:1px solid '+GRID+';background:'+PANEL+';margin-bottom:12px}',
    '.qvs-card h4{margin:0;padding:9px 12px;border-bottom:1px solid '+GRID+';font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:'+DIM+'}',
    '.qvs-b{padding:11px 12px}',
    '.qvs-kv{display:grid;grid-template-columns:1fr auto;gap:5px 12px;font-size:12px}.qvs-kv .k{color:'+DIM+'}.qvs-kv .v{text-align:right;font-variant-numeric:tabular-nums}',
    '.qvs-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.qvs-tbl th,.qvs-tbl td{text-align:right;padding:5px 7px;border-bottom:1px solid '+GRID+'}.qvs-tbl th:first-child,.qvs-tbl td:first-child{text-align:left;color:'+DIM+'}.qvs-tbl th{color:'+MU+';font-weight:400;font-size:10px;text-transform:uppercase}',
    '.qvs-loss{color:'+TL_+'}.qvs-pos{color:'+PH+'}.qvs-neg{color:'+AM+'}',
    '.qvs-cv{width:100%;height:130px;display:block;background:'+PANEL+'}',
    '.qvs-note{font-size:11px;color:'+DIM+';border-left:2px solid '+MU+';padding:5px 0 5px 9px;margin-top:9px}',
    '.qvs-warn{border-left-color:'+AM+';color:'+AM+'}',
    '.qvs-msg{color:'+DIM+';font-size:12px;padding:16px 4px;text-align:center}',
    '.qvs-foot{color:'+MU+';font-size:10px;margin-top:8px;line-height:1.6}'
  ].join('\n');
  document.head.appendChild(s);
}
function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;}
function elText(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;}
function fmt(x,d){return(x==null||!isFinite(x))?'—':x.toFixed(d==null?2:d);}
function lang(){try{return root.__QV_LANG||(root._TL&&root._TL('ru','he','en'))||'ru';}catch(e){return 'ru';}}

function drawScope(cv,path,cone){
  var dpr=root.devicePixelRatio||1,W=cv.clientWidth||300,H=130;cv.width=W*dpr;cv.height=H*dpr;
  var g=cv.getContext('2d');g.scale(dpr,dpr);g.clearRect(0,0,W,H);
  var show=path.slice(-160),maxV=0;show.forEach(function(v){if(v>maxV)maxV=v;});cone.forEach(function(c){var v=c.sigma/Math.sqrt(c.k);if(v>maxV)maxV=v;});maxV=(maxV||1)*1.15;
  var SC=maxV<=1?100:1; // σ path may be fraction -> show as %
  var padL=34,plotW=W-padL-8,histW=plotW*0.72,coneW=plotW*0.28,base=H-12;
  g.strokeStyle=GRID;g.lineWidth=1;g.font='8px monospace';g.fillStyle=DIM;g.textAlign='right';g.textBaseline='middle';
  for(var yy=0;yy<=4;yy++){var y=8+yy*(base-8)/4;g.beginPath();g.moveTo(padL,y);g.lineTo(W-4,y);g.stroke();var val=maxV*(1-yy/4)*SC;g.fillText(val.toFixed(1)+'%',padL-4,y);}
  function Y(v){return base-(v/maxV)*(base-10);}
  g.strokeStyle=PH;g.lineWidth=1.6;g.beginPath();show.forEach(function(v,i){var x=padL+(i/(show.length-1))*histW;i?g.lineTo(x,Y(v)):g.moveTo(x,Y(v));});g.stroke();
  var nowX=padL+histW;g.strokeStyle=MU;g.setLineDash([2,3]);g.beginPath();g.moveTo(nowX,6);g.lineTo(nowX,base);g.stroke();g.setLineDash([]);
  g.strokeStyle=AM;g.lineWidth=1.6;g.setLineDash([4,3]);g.beginPath();g.moveTo(nowX,Y(show[show.length-1]));cone.forEach(function(c,i){var x=nowX+((i+1)/cone.length)*coneW;g.lineTo(x,Y(c.sigma/Math.sqrt(c.k)));});g.stroke();g.setLineDash([]);
  g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle=DIM;g.fillText('σ '+TL('дн','י','d'),padL,7);
}

function tierWord(t){return t==='D'?TL('НАПРАВЛЕНИЕ','כיוון','DIRECTION'):t==='S'?TL('ТОЛЬКО РИСК','סיכון בלבד','RISK-ONLY'):TL('ШУМ','רעש','NOISE');}
function tierGlyph(t){return t==='D'?'✓':t==='S'?'σ':'≈';}
function tierPill(t){return el('div','qvs-badge qvs-'+t, tierGlyph(t)+'\u2002'+tierWord(t));}

function renderResult(container,sym,vt,disc,closes){
  // Data traffic light, rendered FIRST: if the series cannot be trusted, nothing computed
  // from it can be either, so the reader must see this before any number.
  try{
    var dh=dataHealth(sym,closes);
    var col=dh.level==="green"?PH:(dh.level==="amber"?AM:TL_);
    var dot=dh.level==="green"?"\u25cf":(dh.level==="amber"?"\u25cf":"\u25cf");
    var hb=el('div');
    hb.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:10px;border:1px solid '+col+'55;border-radius:8px;background:'+col+'0d;';
    var lbl=el('div');
    lbl.style.cssText='font-family:monospace;font-size:11.5px;font-weight:800;color:'+col+';';
    var word=dh.level==="green"?TL('\u0414\u0410\u041d\u041d\u042b\u0415 \u0421\u0412\u0415\u0416\u0418\u0415','\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d8\u05e8\u05d9\u05d9\u05dd','DATA FRESH')
      :dh.level==="amber"?TL('\u0414\u0410\u041d\u041d\u042b\u0415 \u0421 \u041e\u0413\u041e\u0412\u041e\u0420\u041a\u041e\u0419','\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d1\u05e1\u05e4\u05e7','DATA SUSPECT')
      :TL('\u0414\u0410\u041d\u041d\u042b\u041c \u041d\u0415\u041b\u042c\u0417\u042f \u0414\u041e\u0412\u0415\u0420\u042f\u0422\u042c','\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05dc\u05d0 \u05d0\u05de\u05d9\u05e0\u05d9\u05dd','DATA UNRELIABLE');
    lbl.textContent=dot+' '+word;
    hb.appendChild(lbl);
    var meta=el('div');
    meta.style.cssText='font-family:monospace;font-size:9.5px;color:'+DIM+';';
    var ageTxt=(dh.ageH==null)?'?':(dh.ageH<1?(Math.round(dh.ageH*60)+TL('\u043c\u0438\u043d','\u05d3\u05e7','m')):(dh.ageH<48?(dh.ageH.toFixed(1)+TL('\u0447','\u05e9','h')):(Math.round(dh.ageH/24)+TL('\u0434','\u05d9','d'))));
    meta.textContent=TL('\u0432\u043e\u0437\u0440\u0430\u0441\u0442','\u05d2\u05d9\u05dc','age')+' '+ageTxt+' \u00b7 '+MSX(dh.marketState)+' \u00b7 '+TPX(dh.transport)+' \u00b7 '+dh.bars+TL('\u0431\u0430\u0440','\u05d1\u05e8','b');
    hb.appendChild(meta);
    container.appendChild(hb);
    if(dh.reasons&&dh.reasons.length){
      var rs=el('div','qvs-note'+(dh.level==="red"?' qvs-warn':''));
      rs.style.marginTop='-6px'; rs.style.marginBottom='8px';
      rs.textContent=dh.reasons.join(' \u00b7 ');
      container.appendChild(rs);
    }
  }catch(_dh){ window.QELog&&window.QELog.debug&&window.QELog.debug('dataHealth',(_dh&&_dh.message)||'err'); }

  container.innerHTML='';
  var tier=disc.ok?disc.tier:'N';
  var stamp=el('div','qvs-stamp');
  var col=el('div');col.style.width='100%';
  var top=el('div','qvs-stamp-top');
  top.appendChild(el('span','qvs-sym',sym));
  top.appendChild(tierPill(tier));
  col.appendChild(top);
  if(closes&&closes.length){ var _n=closes.length,_f=+closes[0],_l=+closes[_n-1]; col.appendChild(el('div','qvs-vs','\uD83D\uDD0E '+_n+' '+TL('баров','ברים','bars')+' · '+_f.toFixed(2)+' \u2192 '+_l.toFixed(2))); }
  if(closes&&closes.length>=100){ var _sm=function(a,p){var n=a.length,s=0;for(var i=n-p;i<n;i++)s+=a[i];return s/p;}; var _s20=_sm(closes,20),_s100=_sm(closes,100); if(_s100>0){ var _mad=(_s20/_s100-1)*100; col.appendChild(el('div','qvs-vs',(_mad>=0?'\u25B3 ':'\u25BD ')+'MAD(20/100): '+(_mad>=0?'+':'')+_mad.toFixed(1)+'%'+TL(' · структура тренда',' · מבנה מגמה',' · trend structure'))); } }
  if(closes&&closes.length>=100){ try{
    var _sm2=function(a,p){var n=a.length,s=0;for(var i=n-p;i<n;i++)s+=a[i];return s/p;};
    var _s20b=_sm2(closes,20),_s100b=_sm2(closes,100),_madv=_s100b>0?(_s20b/_s100b-1)*100:0;
    var _rsi=(function(){var g=0,l=0,i,c=closes;for(i=c.length-14;i<c.length;i++){var d=c[i]-c[i-1];if(d>0)g+=d;else l-=d;}if(g+l===0)return 50;return 100-100/(1+g/(l||1e-9));})();
    var _cn2=closes.length,_lb2=_cn2>=252?252:126,_momv=(closes[_cn2-1-21]/closes[_cn2-_lb2]-1)*100;
    var _cl=function(x){return x<0?0:x>1?1:x;};
    var _trendFit=_cl(Math.min(Math.abs(_madv)/4,1)*0.6+(((_momv>0)===(_madv>0))&&Math.abs(_momv)>3?0.4:0));
    var _rangeFit=_cl((_rsi>=70?(_rsi-70)/30:_rsi<=30?(30-_rsi)/30:0)*0.6+(Math.abs(_madv)<1?0.3:0));
    var _reg=(_trendFit>=_rangeFit)?'trend':'range';
    var _dir=_reg==='trend'?(_madv>=0?1:-1):(_rsi>=70?-1:_rsi<=30?1:(_momv>=0?1:-1)); if(!_dir)_dir=(_momv>=0?1:-1);
    var _conf=Math.max(_trendFit,_rangeFit);
    var _size=null; try{ if(vt&&vt.var&&vt.forecast){ var _e=vt.var.filter(function(v){return Math.abs(v.conf-0.99)<1e-9;})[0]; if(_e){ var _es=(_e.gpdES!=null?_e.gpdES:_e.histES),_H=vt.forecast.horizon||10,_esH=_es*Math.sqrt(_H); if(_esH>0)_size=Math.min(100,2/_esH*100); } } }catch(_e2){}
    var _es99=null,_esHd=null,_volReg=null;
    try{ if(vt&&vt.var){ var _e9=vt.var.filter(function(v){return Math.abs(v.conf-0.99)<1e-9;})[0]; if(_e9){ _es99=(_e9.gpdES!=null?_e9.gpdES:_e9.histES); if(_es99!=null)_esHd=_es99*Math.sqrt((vt.forecast&&vt.forecast.horizon)||10); } }
      if(vt&&vt.sigmaPath&&vt.sigmaPath.length>=20){ var _sp=vt.sigmaPath,_cur=_sp[_sp.length-1],_ss=_sp.slice().sort(function(a,b){return a-b;}),_rk=0,_zz; for(_zz=0;_zz<_ss.length;_zz++){ if(_ss[_zz]<=_cur)_rk++; } var _pc=_rk/_ss.length; _volReg=_pc>=0.75?'high':(_pc<=0.35?'low':'normal'); } }catch(_ev){}
    var _nm=_reg==='trend'?TL('Тренд-следование','עוקב מגמה','Trend-following'):_reg==='range'?TL('Возврат к среднему','חזרה לממוצע','Mean-reversion'):'';
    col.appendChild((function(){var _h=el('div','qvs-vs');_h.style.cssText='margin-top:7px;color:'+DIM+';font-size:10px;letter-spacing:1px';_h.textContent=TL('🎯 ЛУЧШАЯ СТРАТЕГИЯ','🎯 אסטרטגיה','🎯 BEST STRATEGY');return _h;})());
    var _sb=col;
    var _fv=(disc&&disc.ok)?fdrVerdict(sym,disc.stats&&disc.stats.pPermutation!=null?disc.stats.pPermutation:1,disc.tier):null;
    var _skilled=!!(_fv&&_fv.fdrPass);
    if(false){ var _sn=el('div','qvs-note qvs-warn');_sn.textContent=TL('⊘ ВНЕ РЫНКА · режим неясен (серая зона)','⊘ מחוץ לשוק','⊘ STAND ASIDE · unclear regime');_sb.appendChild(_sn); }
    else { var _hl2=el('div');_hl2.style.cssText='font-family:monospace;font-weight:800;font-size:13px;';
      if(_skilled){ _hl2.style.color=(_dir>0?PH:AM);_hl2.textContent='▸ '+_nm+' · '+(_dir>0?TL('ЛОНГ','לונג','LONG'):TL('ШОРТ','שורט','SHORT'))+' · '+TL('увер.','ביטחון','conf')+' '+Math.round(_conf*100)+'%'+(_size!=null?(' · '+TL('размер ≤','גודל ≤','size ≤')+Math.round(_size)+'%'):'');_sb.appendChild(_hl2); }
      else { _hl2.style.color=AM;_hl2.textContent='⊘ '+TL('НЕТ НАПРАВЛЕННОГО СКИЛЛА НА ГОРИЗОНТЕ','אין יכולת כיוונית באופק','NO DIRECTIONAL SKILL ON THIS HORIZON');_sb.appendChild(_hl2); var _hl2b=el('div','qvs-vs');_hl2b.style.marginTop='2px';_hl2b.textContent=TL('направление не лицензировано · склонность (не валидирована): ','כיוון לא מאושר · נטייה לא מאומתת: ','direction not licensed · lean (unvalidated): ')+_nm+' '+(_dir>0?TL('ЛОНГ','לונג','LONG'):TL('ШОРТ','שורט','SHORT'))+(_size!=null?(' · '+TL('размер ≤','גודל ≤','size ≤')+Math.round(_size)+'% '+TL('по риску','לפי סיכון','by risk')):'');_sb.appendChild(_hl2b);
        if(_fv&&_fv.overridden){ var _fvn=el('div','qvs-note');_fvn.textContent=TL('p='+disc.stats.pPermutation+' прошло бы наивный порог 0.05, но не поправку Бенджамини-Хохберга на '+_fv.m+' проверенных тикеров (Benjamini & Hochberg, 1995) — при таком объёме скрининга сырой порог даёт слишком много ложных находок.','p='+disc.stats.pPermutation+' עבר סף נאיבי אך לא תיקון להשוואות מרובות.','p='+disc.stats.pPermutation+' would clear the naive 0.05 bar but not the Benjamini-Hochberg correction across '+_fv.m+' tickers checked (Benjamini & Hochberg, 1995) — at this screening volume the raw bar produces too many false discoveries.');_sb.appendChild(_fvn); } }
      var _det=el('div','qvs-vs');_det.style.marginTop='4px';_det.textContent='RSI '+Math.round(_rsi)+' · MAD '+(_madv>=0?'+':'')+_madv.toFixed(1)+'% · '+TL('моментум','מומנטום','mom')+' '+(_momv>=0?'+':'')+_momv.toFixed(0)+'% · '+TL('размер по EVT','גודל לפי EVT','EVT-sized');_sb.appendChild(_det);
      if(_volReg||_esHd!=null){ var _vr=el('div','qvs-vs');_vr.style.marginTop='2px';var _rl=_volReg==='high'?TL('высокая','גבוהה','high'):_volReg==='low'?TL('низкая','נמוכה','low'):TL('нормальная','רגילה','normal');var _sd=(vt&&vt.sigmaDailyPct!=null)?vt.sigmaDailyPct.toFixed(2):null;_vr.textContent=TL('Волат.','תנודתיות','Vol')+': '+(_volReg?_rl:'—')+(_sd?(' σ'+_sd+'%/'+TL('дн','י','d')):'')+(_esHd!=null?(' · ES\u2089\u2089('+((vt.forecast&&vt.forecast.horizon)||10)+') '+_esHd.toFixed(1)+'% · '+TL('бюджет 2% → размер','תקציב 2% → גודל','budget 2% → size')+' \u2264 '+(_size!=null?Math.round(_size):'—')+'%'):'');_sb.appendChild(_vr); }
      var _dis=el('div','qvs-note');_dis.textContent=TL('Режим-роутер по паттернам; не гарантия эджа','ראוטר משטר; לא ערובה','Regime router on patterns; not a guaranteed edge');_sb.appendChild(_dis); }
  }catch(_se){} }
  var vk=(_fv?_fv.verdictKey:(disc.ok?'disc.none':'disc.none'));
  var sub=vk==='disc.found'?TL('Направленный край подтверждён вне выборки — точечный прогноз лицензирован','יתרון כיווני אושר מחוץ למדגם','Directional edge confirmed out-of-sample — point forecast licensed'):vk==='disc.snoop'?TL('Скилл не пробил пермутацию — артефакт перебора, стрелка погашена','לא עבר פרמוטציה — החץ כבוי','Failed permutation — search artifact, arrow suppressed'):TL('Структуры по направлению нет — работает только слой риска ниже','אין מבנה כיווני — רק שכבת הסיכון','No directional structure — only the risk layer below applies');
  col.appendChild(el('div','qvs-vs',sub));
  stamp.appendChild(col);container.appendChild(stamp);

  // vol/tails
  var c1=el('div','qvs-card');c1.appendChild(el('h4',null,TL('Волатильность и хвосты','תנודתיות וזנבות','Volatility & tails')));
  var b1=el('div','qvs-b');
  if(vt.ok){
    var cv=el('canvas','qvs-cv');b1.appendChild(cv);
    var kv=el('div','qvs-kv');kv.style.marginTop='10px';
    function rw(k,v){kv.appendChild(el('span','k',k));kv.appendChild(el('span','v',v));}
    rw(TL('σ дневная','σ יומית','σ daily'),fmt(vt.sigmaDailyPct)+'%');
    if(vt.harDailyPct!=null)rw(TL('σ HAR (прогноз дн)','σ HAR','σ HAR (fcast d)'),fmt(vt.harDailyPct)+'%');
    rw(TL('σ годовая','σ שנתית','σ annual'),fmt(vt.annualPct)+'%');
    if(vt.garch.ok){rw(TL('персистентность','התמדה','persistence'),fmt(vt.garch.persistence,3));rw(TL('полураспад шока','מחצית חיים','shock half-life'),isFinite(vt.garch.halfLife)?fmt(vt.garch.halfLife,1):'∞');}
    rw(TL('σ на горизонте','σ באופק','σ over horizon')+' ('+vt.forecast.horizon+')',fmt(vt.forecast.volHPct)+'%');
    rw(TL('асимметрия','אסימטריה','skew'),fmt(vt.tail.skew,2));
    rw(TL('избыт. эксцесс','קורטוזיס','excess kurt'),fmt(vt.tail.exKurt,2));
    b1.appendChild(kv);
    var tbl=el('table','qvs-tbl');tbl.innerHTML='<tr><th>'+TL('уровень','רמה','level')+'</th><th>'+TL('истор.1д','1י','hist 1d')+'</th><th>EVT</th><th>ES</th><th>'+TL('истор.H','H','hist H')+'</th></tr>';
    vt.var.forEach(function(v){var tr=el('tr');tr.innerHTML='<td>'+(v.conf*100).toFixed(0)+'%</td><td class="qvs-loss">'+fmt(v.histVaR)+'%</td><td class="qvs-loss">'+fmt(v.gpdVaR!=null?v.gpdVaR:v.cfVaR)+'%</td><td class="qvs-loss">'+fmt(v.gpdES!=null?v.gpdES:v.histES)+'%</td><td class="qvs-loss">'+fmt(v.histVaR_H)+'%</td>';tbl.appendChild(tr);});
    b1.appendChild(tbl);
    var nt=el('div','qvs-note'+(vt.clustered?'':' qvs-warn'));nt.textContent=vt.clustered?TL('Кластеризация значима — риск прогнозируем (золотой слой).','קיבוץ מובהק — סיכון ניתן לחיזוי.','Clustering significant — risk forecastable (gold layer).'):TL('Слабая кластеризация — оценки риска менее надёжны.','קיבוץ חלש.','Weak clustering — risk estimates less reliable.');b1.appendChild(nt);
    if(vt.backtest){var bt=vt.backtest;var bn=el('div','qvs-note'+(bt.ok?'':' qvs-warn'));bn.textContent=TL('Бэктест VaR 99% (Kupiec): '+bt.breaches+' наруш./ожид. '+bt.expected+' · p='+bt.pval+(bt.ok?' — модель адекватна':' — риск недооценён'),'Kupiec 99%: '+bt.breaches+'/'+bt.expected+' p='+bt.pval,'VaR 99% backtest (Kupiec): '+bt.breaches+' breaches / exp '+bt.expected+' · p='+bt.pval+(bt.ok?' — adequate':' — underestimates risk'));b1.appendChild(bn);
      if(bt.ind){var ci=el('div','qvs-note'+(bt.ind.clustered?' qvs-warn':''));ci.textContent=TL('Независимость (Кристофферсен): '+(bt.ind.clustered?'пробои кластеризуются — риск недооценён в стрессах':'пробои независимы')+' · p='+bt.ind.pval,'Christoffersen: '+(bt.ind.clustered?'clustered':'independent')+' p='+bt.ind.pval,'Independence (Christoffersen): '+(bt.ind.clustered?'breaches cluster':'independent')+' · p='+bt.ind.pval);b1.appendChild(ci);}
      if(bt.es){var eb=el('div','qvs-note'+(bt.es.ok?'':' qvs-warn'));var _zs=(bt.es.z2>=0?'+':'')+bt.es.z2;var _ps=bt.es.pval!=null?(' · p='+bt.es.pval):(' · '+TL('точечно','נקודתי','point'));eb.textContent=TL('Бэктест ES 99% (Acerbi–Székely Z₂): '+_zs+_ps+(bt.es.ok?' — ES адекватен':' — ES недооценён (хвост тяжелее модели)'),'ES 99% (Acerbi–Székely) Z₂='+_zs+_ps,'ES 99% backtest (Acerbi–Székely Z₂): '+_zs+_ps+(bt.es.ok?' — ES adequate':' — ES underestimated (tail heavier than model)'));b1.appendChild(eb);}}
    (function(){try{ if(vt.var&&vt.forecast){ var e99=vt.var.filter(function(v){return Math.abs(v.conf-0.99)<1e-9;})[0]; if(e99){ var es=(e99.gpdES!=null?e99.gpdES:e99.histES); var H=vt.forecast.horizon||10; var esH=es*Math.sqrt(H); if(esH>0){ var mp=Math.min(100,2/esH*100); var rb=el('div','qvs-note'); rb.textContent=TL('Риск-бюджет (лимит 2% на 99%, '+H+'д): макс. позиция ≈ '+mp.toFixed(0)+'% капитала','תקציב סיכון 2%/99% '+H+'ד: פוזיציה מקס ≈ '+mp.toFixed(0)+'%','Risk budget (2% at 99%, '+H+'d): max position ≈ '+mp.toFixed(0)+'% of capital'); b1.appendChild(rb); } } } }catch(_e){}})();
    c1.appendChild(b1);container.appendChild(c1);
    drawScope(cv,vt.sigmaPath,vt.forecast.cone);
  } else { b1.appendChild(el('div','qvs-msg','n='+(vt.n||0)+' — '+TL('недостаточно истории','אין מספיק היסטוריה','insufficient history')));c1.appendChild(b1);container.appendChild(c1);}

  // direction
  var c2=el('div','qvs-card');c2.appendChild(el('h4',null,TL('Направление · правило','כיוון · כלל','Direction · rule')));
  var b2=el('div','qvs-b');
  if(disc.ok){
    var kv2=el('div','qvs-kv');function r2(k,v){kv2.appendChild(el('span','k',k));kv2.appendChild(el('span','v',v));}
    r2('OOS R²',fmt(disc.stats.oosR2,4));r2('p '+TL('(блочная перм.)','(בלוק פרמ.)','(block perm)'),fmt(disc.stats.pPermutation,3));if(disc.stats.dsr!=null)r2('DSR',fmt(disc.stats.dsr,3)+(disc.stats.dsrTrials>1?(' \u00b7 '+disc.stats.dsrTrials+TL(' \u0438\u0441\u043f.',' \u05e0\u05d9\u05e1.',' trials')):''));if(disc.stats.featCount!=null)r2(TL('перебор K','K','breadth K'),disc.stats.featCount+(disc.stats.selCount!=null?(' \u2192 '+disc.stats.selCount+TL(' отобр.',' נבחר',' sel')):''));
    if((_fv&&_fv.fdrPass)&&disc.forecastNext!=null)r2(TL('прогноз след. возврата','תחזית תשואה','next-return forecast'),fmt(disc.forecastNext*100,3)+'%');
    b2.appendChild(kv2);(function(){try{var p=disc.stats.pPermutation,k=disc.stats.featCount;var okp=p<=0.05;var hn=el('div','qvs-note'+(okp?'':' qvs-warn'));hn.textContent=okp?TL('Честность: край устойчив вне выборки; p деФлирован переселекцией (K='+k+')','יציב מחוץ למדגם (K='+k+')','Robust OOS; p deflated by re-selection (K='+k+')'):TL('Честность: не пробил блочную перестановку из '+k+' факторов — вероятен артефакт перебора','ארטיפקט חיפוש מ-'+k+' גורמים','Failed block-permutation over '+k+' factors — likely search artifact');b2.appendChild(hn);}catch(_e){}})();
    if(disc.rule&&disc.rule.length){var rt=el('table','qvs-tbl');rt.style.marginTop='10px';rt.innerHTML='<tr><th>'+TL('фактор','גורם','factor')+'</th><th></th><th>'+TL('вес','משקל','weight')+'</th></tr>';disc.rule.slice(0,6).forEach(function(r){var tr=el('tr');var m=r.meaning[lang()]||r.name;tr.innerHTML='<td>'+r.name+'</td><td style="color:'+DIM+'">'+m+'</td><td class="'+(r.direction==='+'?'qvs-pos':'qvs-neg')+'">'+r.direction+fmt(Math.abs(r.weight),3)+'</td>';rt.appendChild(tr);});b2.appendChild(rt);}
    if(tier==='N'){var w=el('div','qvs-note qvs-warn');w.textContent=TL('Правило показано как описание, не лицензировано.','הכלל תיאורי בלבד.','Rule shown as description, not licensed.');b2.appendChild(w);}
  } else b2.appendChild(el('div','qvs-msg',TL('недостаточно данных','אין מספיק נתונים','insufficient data')));
  c2.appendChild(b2);container.appendChild(c2);

  try{
    var tv=totalVector(closes,{horizon:3,perms:200});
    if(tv&&tv.ok){
      var tvb=el('div','qvs-block');
      var tvh=el('div','qvs-h',TL('ТОТАЛЬНЫЙ ВЕКТОР','וקטור כולל','TOTAL VECTOR'));tvb.appendChild(tvh);
      var arrow=tv.dir>0?'↗':tv.dir<0?'↘':'→';
      var tvc=tv.significant?(tv.dir>0?PH:AM):DIM;
      var l1=el('div');l1.style.cssText='font-family:monospace;font-weight:800;font-size:13px;color:'+tvc+';';
      l1.textContent=arrow+' '+TL('когерентность','לכידות','coherence')+' '+tv.coherence.toFixed(2)+' · '+TL('амплитуда','משרעת','amplitude')+' ±'+tv.ampPct.toFixed(1)+'% (3'+TL('д','י','d')+')';
      tvb.appendChild(l1);
      var l2=el('div','qvs-note'+(tv.significant?'':' qvs-warn'));
      l2.textContent=tv.significant
        ? TL('Согласие компонент выше случайного (блочная перестановка, p='+tv.pval+') — направление подтверждено','הסכמה מעל אקראי (p='+tv.pval+')','Component agreement exceeds chance (block permutation, p='+tv.pval+') — direction confirmed')
        : TL('Согласие компонент в пределах случайного (p='+tv.pval+') — направление НЕ подтверждено, амплитуда остаётся оценкой размаха','הסכמה בתחום האקראי (p='+tv.pval+') — הכיוון לא אושר','Component agreement is within chance (p='+tv.pval+') — direction NOT confirmed; amplitude remains a magnitude estimate');
      tvb.appendChild(l2);
      var l3=el('div','qvs-vs');l3.style.marginTop='2px';
      l3.textContent=tv.components.map(function(c){return c.name+' '+(c.z>=0?'+':'')+c.z.toFixed(1);}).join(' · ');
      tvb.appendChild(l3);
      var l4=el('div','qvs-note');
      l4.textContent=TL('Когерентность — мера согласия индикаторов, а не их правоты: они могут ошибаться согласованно. В вероятность попадания не переводится.','לכידות מודדת הסכמה, לא צדק.','Coherence measures agreement, not correctness — components can be wrong together. It is not converted into a hit probability.');
      tvb.appendChild(l4);
      container.appendChild(tvb);
    }
  }catch(_tv){ window.QELog&&window.QELog.debug&&window.QELog.debug('totalVector',(_tv&&_tv.message)||'err'); }
  try{
    // Probability matrix for the actual trading spec: a 5% or 10% rise over 2-14 days.
    // One number cannot answer "will it jump" — the answer depends on both the size asked
    // for and the time allowed, so the whole grid is shown and the best cell is marked.
    var HS=[3,5,10], MV=[0.05,0.10], grid=[], best={p:-1};
    for(var mi=0;mi<MV.length;mi++){
      var row=[];
      for(var hi=0;hi<HS.length;hi++){
        var r=moveProbability(closes,{horizon:HS[hi],move:MV[mi]});
        var v=(r&&r.ok)?r.pUp:null; row.push(v);
        if(v!=null&&v>best.p) best={p:v,mv:MV[mi],h:HS[hi],dn:(r&&r.ok)?r.pDn:null};
      }
      grid.push(row);
    }
    if(best.p>=0){
      var gb=el('div','qvs-block');
      gb.appendChild(el('div','qvs-h',TL('\u0428\u0410\u041d\u0421 \u0420\u041e\u0421\u0422\u0410 (FEM)','\u05e1\u05d9\u05db\u05d5\u05d9 \u05e2\u05dc\u05d9\u05d9\u05d4 (FEM)','UPSIDE ODDS (FEM)')));
      var tbl=el('div');tbl.style.cssText='font-family:monospace;font-size:11px;line-height:1.75;';
      var hdr=el('div');hdr.style.cssText='color:'+DIM+';font-size:9.5px;';
      hdr.textContent='            3'+TL('\u0434','\u05d9','d')+'     5'+TL('\u0434','\u05d9','d')+'    10'+TL('\u0434','\u05d9','d');
      tbl.appendChild(hdr);
      for(var mi2=0;mi2<MV.length;mi2++){
        var ln=el('div'),txt='  \u2265+'+Math.round(MV[mi2]*100)+'%   ';
        for(var hi2=0;hi2<HS.length;hi2++){
          var v2=grid[mi2][hi2];
          txt+=(v2==null?'  --':(v2.toFixed(0)+'%')).padStart(6);
        }
        ln.textContent=txt;
        ln.style.color=(MV[mi2]===best.mv)?PH:DIM;
        tbl.appendChild(ln);
      }
      gb.appendChild(tbl);
      var bl=el('div');bl.style.cssText='font-family:monospace;font-weight:800;font-size:12.5px;margin-top:6px;color:'+(best.p>=30?PH:best.p>=18?AM:DIM)+';';
      bl.textContent=TL('\u041b\u0443\u0447\u0448\u0435\u0435 \u043e\u043a\u043d\u043e','\u05d4\u05d7\u05dc\u05d5\u05df \u05d4\u05d8\u05d5\u05d1','Best window')+': \u2265+'+Math.round(best.mv*100)+'% \u0437\u0430 '+best.h+TL('\u0434','\u05d9','d')+' \u2014 '+best.p.toFixed(1)+'%'+(best.dn!=null?('  ('+TL('\u043f\u0430\u0434\u0435\u043d\u0438\u0435','\u05d9\u05e8\u05d9\u05d3\u05d4','fall')+' '+best.dn.toFixed(1)+'%)'):'');
      gb.appendChild(bl);
      try{
        var _LL=window.__QVLast, _geo=(_LL&&_LL.sym===sym)?{px:_LL.px,tgt:_LL.tgt,stp:_LL.stp}:null;
        drawDensity(gb,closes,_geo,{horizon:best.h||5});
        var cap=el('div','qvs-vs');cap.style.marginTop='2px';
        cap.textContent=TL('\u041f\u043b\u043e\u0442\u043d\u043e\u0441\u0442\u044c \u0446\u0435\u043d\u044b \u043d\u0430 \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0435; \u0437\u0430\u043b\u0438\u0432\u043a\u0430 \u2014 \u0434\u043e\u043b\u044f \u0438\u0441\u0445\u043e\u0434\u043e\u0432 \u0437\u0430 \u0446\u0435\u043b\u044c\u044e \u0438 \u0437\u0430 \u0441\u0442\u043e\u043f\u043e\u043c','\u05e6\u05e4\u05d9\u05e4\u05d5\u05ea \u05d4\u05de\u05d7\u05d9\u05e8','Price density at the horizon; shading is the share of outcomes beyond target and beyond stop');
        gb.appendChild(cap);
      }catch(_dc){}
      gb.appendChild(el('div','qvs-note',TL('\u0420\u0435\u0448\u0435\u043d\u043e \u0438\u0437 \u043f\u043b\u043e\u0442\u043d\u043e\u0441\u0442\u0438 \u0424\u043e\u043a\u043a\u0435\u0440\u0430-\u041f\u043b\u0430\u043d\u043a\u0430 \u043f\u0440\u0438 \u043d\u0443\u043b\u0435\u0432\u043e\u043c \u0434\u0440\u0435\u0439\u0444\u0435. \u041f\u043e\u0442\u043e\u043b\u043e\u043a \u0448\u0430\u043d\u0441\u0430 \u043d\u0430 \u0440\u043e\u0441\u0442 \u2265+5% \u2014 \u043e\u043a\u043e\u043b\u043e 35% \u0434\u0430\u0436\u0435 \u0443 \u0441\u0430\u043c\u044b\u0445 \u043f\u043e\u0434\u0432\u0438\u0436\u043d\u044b\u0445 \u0431\u0443\u043c\u0430\u0433: \u0440\u0430\u0437\u043c\u0430\u0445 \u0441\u0438\u043c\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u043d.','\u05e6\u05e4\u05d9\u05e4\u05d5\u05ea \u05e4\u05d5\u05e7\u05e8-\u05e4\u05dc\u05e0\u05e7, \u05dc\u05dc\u05d0 \u05d3\u05e8\u05d9\u05e4\u05d8.','Solved from the Fokker-Planck density with zero drift. The ceiling on P(rise >= +5%) is about 35% even for the most volatile names: the spread is symmetric.')));
      container.appendChild(gb);
    }
  }catch(_mp){ window.QELog&&window.QELog.debug&&window.QELog.debug('moveProbability',(_mp&&_mp.message)||'err'); }
  try{
    var pim=priceImpact(_BARS[sym]||null,{move:0.07});
    if(pim&&pim.ok){
      var pb=el('div','qvs-block');
      pb.appendChild(el('div','qvs-h',TL('ПОТОК ДЛЯ ХОДА 7%','זרימה לתנועה 7%','FLOW TO MOVE 7%')));
      var pl=el('div');pl.style.cssText='font-family:monospace;font-weight:800;font-size:13px;color:'+(pim.sqrtAdv<=2?PH:pim.sqrtAdv<=6?AM:DIM)+';';
      pl.textContent=(pim.sqrtAdv!=null?pim.sqrtAdv.toFixed(1):'?')+'\u00d7 '+TL('дневного оборота','מחזור יומי','daily volume')+' ('+TL('корневой закон','חוק שורש','sqrt law')+')';
      pb.appendChild(pl);
      var p2=el('div','qvs-vs');p2.style.marginTop='2px';
      p2.textContent=TL('линейно (Амихуд/Кайл)','ליניארי','linear (Amihud/Kyle)')+' '+(pim.linAdv!=null?pim.linAdv.toFixed(1):'?')+'\u00d7 \u00b7 ADV $'+(pim.advUsd/1e6).toFixed(0)+'M \u00b7 \u03c3 '+pim.sigmaDaily.toFixed(2)+'%';
      pb.appendChild(p2);
      pb.appendChild(el('div','qvs-note',TL('Воздействие вогнутое: корневой закон надёжнее линейного для крупных заявок. Дневные бары не содержат знака потока \u2014 оценивается размер требуемого потока, но не его направление.','ההשפעה קעורה; הברים היומיים ללא סימן זרימה.','Impact is concave: the square-root law is the reliable one for large orders. Daily bars carry no signed flow \u2014 this sizes the flow required, not its direction.')));
      container.appendChild(pb);
    }
  }catch(_pi){ window.QELog&&window.QELog.debug&&window.QELog.debug('priceImpact',(_pi&&_pi.message)||'err'); }
  try{
    var pv=pitValidate(closes,{horizon:3,minHist:120,move:0.07});
    if(pv&&pv.ok){
      var vb=el('div','qvs-block');
      vb.appendChild(el('div','qvs-h',TL('ПРОВЕРКА КАЛИБРОВКИ (PIT)','בדיקת כיול (PIT)','CALIBRATION CHECK (PIT)')));
      var vl=el('div');vl.style.cssText='font-family:monospace;font-weight:800;font-size:13px;color:'+(pv.moveOk?PH:AM)+';';
      vl.textContent='P(+7%): '+TL('ожидалось','צפוי','expected')+' '+pv.moveExpected.toFixed(1)+' \u2192 '+TL('случилось','בפועל','observed')+' '+pv.moveObserved+' '+TL('раз','פעמים','times')+' (N='+pv.n+')';
      vb.appendChild(vl);
      var v2=el('div','qvs-note'+(pv.calibrated?'':' qvs-warn'));
      v2.textContent=TL('Равномерность PIT: KS='+pv.ks+', p='+pv.pval+(pv.calibrated?' \u2014 плотности откалиброваны':' \u2014 плотности НЕ откалиброваны'),'PIT KS='+pv.ks+' p='+pv.pval,'PIT uniformity: KS='+pv.ks+', p='+pv.pval+(pv.calibrated?' \u2014 densities calibrated':' \u2014 densities NOT calibrated'));
      vb.appendChild(v2);
      var v3=el('div','qvs-vs');v3.style.marginTop='2px';
      v3.textContent=TL('хвосты','זנבות','tails')+' <5%: '+pv.tailLo+'% \u00b7 >95%: '+pv.tailHi+'% ('+TL('норма 5/5','5/5','expect 5/5')+') \u00b7 z='+pv.moveZ;
      vb.appendChild(v3);
      vb.appendChild(el('div','qvs-note',TL('Прогулка вперёд: каждая плотность построена только по данным до своей даты; окна не перекрываются. Мощность теста ограничена \u2014 на синтетике он отвергает грубо неверную модель лишь в части прогонов, поэтому пара «ожидалось/случилось» информативнее самого вердикта.','הליכה קדימה; עוצמת המבחן מוגבלת.','Walk-forward: each density uses only data before its own date; windows do not overlap. Test power is limited \u2014 on synthetic data it rejects a grossly wrong model only part of the time, so the expected/observed pair is more informative than the verdict itself.')));
      container.appendChild(vb);
    }
  }catch(_pv){ window.QELog&&window.QELog.debug&&window.QELog.debug('pitValidate',(_pv&&_pv.message)||'err'); }
  try{
    var dg=QVDiag.list();
    if(dg&&dg.length){
      var db=el('div','qvs-block');
      db.appendChild(el('div','qvs-h',TL('\u0414\u0418\u0410\u0413\u041d\u041e\u0421\u0422\u0418\u041a\u0410','\u05d0\u05d1\u05d7\u05d5\u05df','DIAGNOSTICS')));
      var hd=el('div');hd.style.cssText='font-family:monospace;font-weight:800;font-size:12.5px;color:'+AM+';';
      hd.textContent=TL('\u041d\u0430\u0440\u0443\u0448\u0435\u043d\u043e \u0438\u043d\u0432\u0430\u0440\u0438\u0430\u043d\u0442\u043e\u0432','\u0e04','Invariants violated')+': '+dg.length+' ('+QVDiag.total()+' '+TL('\u0441\u043e\u0431\u044b\u0442\u0438\u0439','','events')+')';
      db.appendChild(hd);
      dg.slice(0,6).forEach(function(v){
        var ln=el('div','qvs-vs');ln.style.marginTop='2px';
        ln.textContent='\u2022 '+v.node+': '+v.rule+(v.n>1?(' \u00d7'+v.n):'')+(v.last?('  ['+v.last+']'):'');
        db.appendChild(ln);
      });
      db.appendChild(el('div','qvs-note',TL('\u041a\u0430\u0436\u0434\u044b\u0439 \u0443\u0437\u0435\u043b \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u0442 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u043e \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u043c \u0432\u044b\u0432\u043e\u0434\u0435. \u041d\u0430\u0440\u0443\u0448\u0435\u043d\u0438\u0435 \u043d\u0435 \u043f\u0440\u0435\u0440\u044b\u0432\u0430\u0435\u0442 \u0440\u0430\u0431\u043e\u0442\u0443, \u043d\u043e \u043e\u0437\u043d\u0430\u0447\u0430\u0435\u0442, \u0447\u0442\u043e \u0447\u0438\u0441\u043b\u0430 \u044d\u0442\u043e\u0433\u043e \u0443\u0437\u043b\u0430 \u043d\u0435\u043b\u044c\u0437\u044f \u0441\u0447\u0438\u0442\u0430\u0442\u044c \u0434\u043e\u0441\u0442\u043e\u0432\u0435\u0440\u043d\u044b\u043c\u0438.','\u05d4\u05e4\u05e8\u05d5\u05ea \u05d0\u05d9\u05e0\u05d5\u05d5\u05e8\u05d9\u05d0\u05e0\u05d8\u05d9\u05dd.','Each node asserts invariants about its own output. A violation does not stop the app, but the numbers from that node cannot be trusted.')));
      container.appendChild(db);
    }
  }catch(_dg){}
  try{
    var _L=window.__QVLast, geo=(_L&&_L.sym===sym)?{px:_L.px,tgt:_L.tgt,stp:_L.stp}:null;
    var _fv2=(disc&&disc.ok)?fdrVerdict(sym,disc.stats&&disc.stats.pPermutation!=null?disc.stats.pPermutation:1,disc.tier):null;
    var _val=!!(_fv2&&_fv2.fdrPass);
    var rmv=geo?riskManagement(closes,geo,{horizon:5,validated:_val,
      pSignal:(_val&&disc&&disc.probability!=null)?(disc.probability/100):null}):null;
    if(rmv&&rmv.ok){
      var rb=el('div','qvs-block');
      rb.appendChild(el('div','qvs-h',TL('\u0423\u041f\u0420\u0410\u0412\u041b\u0415\u041d\u0418\u0415 \u0420\u0418\u0421\u041a\u041e\u041c','\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd','RISK MANAGEMENT')));
      var vc=rmv.tradeable?PH:AM;
      var hl=el('div');hl.style.cssText='font-family:monospace;font-weight:800;font-size:13px;color:'+vc+';';
      hl.textContent=(rmv.tradeable?'\u2713 ':'\u26a0 ')+TL('\u0440\u0430\u0437\u043c\u0435\u0440','\u05d2\u05d5\u05d3\u05dc','size')+' \u2264 '+rmv.sizePct.toFixed(1)+'% '+TL('\u043a\u0430\u043f\u0438\u0442\u0430\u043b\u0430','\u05de\u05d4\u05d4\u05d5\u05df','of capital');
      rb.appendChild(hl);
      var r1=el('div','qvs-vs');r1.style.marginTop='3px';
      r1.textContent=TL('\u043d\u0443\u0436\u043d\u043e \u043f\u043e\u043f\u0430\u0434\u0430\u043d\u0438\u0439','\u05d3\u05e8\u05d5\u05e9','need')+' '+rmv.breakEven+'% \u00b7 '+TL('\u043d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u043e','\u05e0\u05d9\u05d8\u05e8\u05dc\u05d9','neutral')+' '+rmv.neutral+'% \u00b7 '+TL('\u0432 \u0440\u0430\u0441\u0447\u0451\u0442\u0435','\u05d1\u05e9\u05d9\u05de\u05d5\u05e9','used')+' '+rmv.pUsed+'% \u00b7 R:R 1:'+rmv.rr;
      rb.appendChild(r1);
      var r2=el('div','qvs-vs');r2.style.marginTop='2px';
      r2.textContent=TL('\u043a\u0440\u0430\u0439','\u05d9\u05ea\u05e8\u05d5\u05df','edge')+' '+(rmv.edgePts>0?'+':'')+rmv.edgePts+TL(' \u043f.\u043f.',' ',' pp')+' \u00b7 '+TL('\u043e\u0436\u0438\u0434\u0430\u043d\u0438\u0435','\u05ea\u05d5\u05d7\u05dc\u05ea','EV')+' '+(rmv.evPct>0?'+':'')+rmv.evPct+'% \u00b7 '+TL('\u0441\u0442\u043e\u043f','\u05e1\u05d8\u05d5\u05e4','stop')+' '+(rmv.stopSigma!=null?rmv.stopSigma:'?')+'\u03c3';
      rb.appendChild(r2);
      var msgs={
        'unvalidated':TL('\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043e \u0432\u043d\u0435 \u0432\u044b\u0431\u043e\u0440\u043a\u0438 \u2014 \u0443\u0432\u0435\u0440\u0435\u043d\u043d\u043e\u0441\u0442\u044c \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043d\u0435 \u0432\u0437\u044f\u0442\u0430','\u05dc\u05d0 \u05d0\u05d5\u05de\u05ea','direction not confirmed out of sample — stated confidence was not used'),
        'no-edge':TL('\u0448\u0430\u043d\u0441 \u043d\u0438\u0436\u0435 \u043f\u043e\u0440\u043e\u0433\u0430 \u043e\u043a\u0443\u043f\u0430\u0435\u043c\u043e\u0441\u0442\u0438','\u05d0\u05d9\u05df \u05d9\u05ea\u05e8\u05d5\u05df','chance is below the break-even rate'),
        'rr<1':TL('\u0440\u0438\u0441\u043a \u0431\u043e\u043b\u044c\u0448\u0435 \u0446\u0435\u043b\u0438','\u05e1\u05d9\u05db\u05d5\u05df \u05d2\u05d3\u05d5\u05dc','risk exceeds the target'),
        'stop-in-noise':TL('\u0441\u0442\u043e\u043f \u0432\u043d\u0443\u0442\u0440\u0438 \u0448\u0443\u043c\u0430 \u2014 \u0435\u0433\u043e \u0441\u043d\u0435\u0441\u0451\u0442 \u043e\u0431\u044b\u0447\u043d\u044b\u043c \u043a\u043e\u043b\u0435\u0431\u0430\u043d\u0438\u0435\u043c','\u05e1\u05d8\u05d5\u05e4 \u05d1\u05ea\u05d5\u05da \u05d4\u05e8\u05e2\u05e9','stop sits inside noise — ordinary fluctuation will hit it')
      };
      try{
        var MR=(window.__QVLast&&window.__QVLast.macro)||null;
        if(MR&&MR.count){
          var mb=el('div','qvs-note qvs-warn');mb.style.marginTop='3px';
          mb.textContent=TL('\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0432 \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0435: ','\u05d0\u05d9\u05e8\u05d5\u05e2 \u05d1\u05d0\u05d5\u05e4\u05e7: ','Event inside the horizon: ')
            +MR.events.map(function(x){return x.title;}).slice(0,2).join(' \u00b7 ')
            +' \u2014 '+TL('\u0447\u0435\u0440\u0435\u0437 ','\u05d1\u05e2\u05d5\u05d3 ','in ')+MR.nextInDays.toFixed(1)+TL(' \u0434\u043d','\u05d9','d')
            +'. '+TL('\u041f\u043b\u043e\u0442\u043d\u043e\u0441\u0442\u044c \u043f\u043e\u0441\u0442\u0440\u043e\u0435\u043d\u0430 \u043f\u043e \u043e\u0431\u044b\u0447\u043d\u044b\u043c \u0441\u0435\u0441\u0441\u0438\u044f\u043c \u0438 \u044d\u0442\u043e\u0442 \u0445\u0432\u043e\u0441\u0442 \u043d\u0435 \u0443\u0447\u0438\u0442\u044b\u0432\u0430\u0435\u0442.','\u05d4\u05e6\u05e4\u05d9\u05e4\u05d5\u05ea \u05dc\u05d0 \u05db\u05d5\u05dc\u05dc\u05ea \u05d0\u05ea \u05d6\u05d4.','The density is fitted to ordinary sessions and does not carry this tail.');
          rb.appendChild(mb);
        }
      }catch(_mr){}
      if(rmv.why&&rmv.why.length){
        var wl=el('div','qvs-note qvs-warn');
        wl.textContent=rmv.why.map(function(k){return msgs[k]||k;}).join(' \u00b7 ');
        rb.appendChild(wl);
      }
      try{
        var al=arbitrageLimits(closes,_BARS[sym]||null);
        if(al&&al.ok){
          var ab=el('div','qvs-vs');ab.style.marginTop='3px';
          var lt=al.level==='high'?TL('\u0432\u044b\u0441\u043e\u043a\u0438\u0435','\u05d2\u05d1\u05d5\u05d4','high'):al.level==='medium'?TL('\u0441\u0440\u0435\u0434\u043d\u0438\u0435','\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9','medium'):TL('\u043d\u0438\u0437\u043a\u0438\u0435','\u05e0\u05de\u05d5\u05da','low');
          ab.style.color=(al.level==='low')?MU:DIM;
          ab.textContent=TL('\u041f\u0440\u0435\u0434\u0435\u043b\u044b \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436\u0430','\u05d2\u05d1\u05d5\u05dc\u05d5\u05ea \u05d0\u05e8\u05d1\u05d9\u05d8\u05e8\u05d0\u05d6','Limits to arbitrage')+': '+lt+
            (al.advUsd?(' \u00b7 ADV $'+(al.advUsd/1e6).toFixed(0)+'M'):'')+' \u00b7 \u03c3 '+al.volPct+'%/'+TL('\u0434\u043d','\u05d9','d')+
            (al.level==='low'?('  \u2014 '+TL('\u0437\u0434\u0435\u0441\u044c \u043a\u0440\u0430\u0439 \u0441\u043a\u043e\u0440\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u0443\u0436\u0435 \u0432\u044b\u0431\u0440\u0430\u043d','\u05d4\u05d9\u05ea\u05e8\u05d5\u05df \u05de\u05d5\u05e6\u05d4','any edge here is likely already competed away')):'');
          rb.appendChild(ab);
        }
      }catch(_al){}
      if(rmv.pRaw!=null&&rmv.validated){
        var dh=el('div','qvs-note');
        dh.textContent=TL('\u0417\u0430\u044f\u0432\u043b\u0435\u043d\u043d\u044b\u0439 \u0448\u0430\u043d\u0441 '+rmv.pRaw+'% \u0443\u0447\u0442\u0451\u043d \u043a\u0430\u043a '+rmv.pUsed+'%: \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043a\u0440\u0430\u044f \u0442\u0435\u0440\u044f\u044e\u0442 26% \u0432\u043d\u0435 \u0432\u044b\u0431\u043e\u0440\u043a\u0438 \u0438 58% \u043f\u043e\u0441\u043b\u0435 \u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0438 (McLean & Pontiff, 2016).','\u05d4\u05e0\u05d7\u05d4 \u05e2\u05dc \u05d3\u05e2\u05d9\u05db\u05d4','Claimed '+rmv.pRaw+'% is used as '+rmv.pUsed+'%: published edges lose 26% out of sample and 58% after publication (McLean & Pontiff, 2016).');
        rb.appendChild(dh);
      }
      rb.appendChild(el('div','qvs-note',TL('\u0420\u0430\u0437\u043c\u0435\u0440 \u2014 \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u044c \u043a\u0440\u0438\u0442\u0435\u0440\u0438\u044f \u041a\u0435\u043b\u043b\u0438 \u043e\u0442 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d\u043d\u043e\u0433\u043e \u043a\u0440\u0430\u044f; \u0431\u0435\u0437 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u0431\u0435\u0440\u0451\u0442\u0441\u044f \u043d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u0430\u044f \u0432\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u0441\u0442\u044c, \u0438 \u0440\u0430\u0437\u043c\u0435\u0440 \u043f\u0430\u0434\u0430\u0435\u0442 \u043f\u043e\u0447\u0442\u0438 \u0434\u043e \u043d\u0443\u043b\u044f. \u042d\u0442\u043e \u043d\u0435 \u043e\u0441\u0442\u043e\u0440\u043e\u0436\u043d\u043e\u0441\u0442\u044c, \u0430 \u0430\u0440\u0438\u0444\u043c\u0435\u0442\u0438\u043a\u0430.','\u05e8\u05d1\u05e2 \u05e7\u05dc\u05d9.','Size is quarter-Kelly on the confirmed edge; without confirmation the neutral probability is used and size falls to near zero. That is arithmetic, not caution.')));
      container.appendChild(rb);
    }
  }catch(_rm){ window.QELog&&window.QELog.debug&&window.QELog.debug('riskManagement',(_rm&&_rm.message)||'err'); }
  try{
    var PF=(window.__QVLast&&window.__QVLast.portfolio)||null;
    if(PF&&PF.ok){
      var pb=el('div','qvs-block');
      pb.appendChild(el('div','qvs-h',TL('\u041f\u041e\u0420\u0422\u0424\u0415\u041b\u042c \u0421\u041a\u0410\u041d\u0410','\u05ea\u05d9\u05e7 \u05d4\u05e1\u05e8\u05d9\u05e7\u05d4','SCAN PORTFOLIO')));
      var pc=(PF.flags&&PF.flags.length)?AM:PH;
      var ph=el('div');ph.style.cssText='font-family:monospace;font-weight:800;font-size:13px;color:'+pc+';';
      ph.textContent=TL('\u0412\u0441\u0435\u0433\u043e \u2264 ','\u05e1\u05d4\u05f4\u05db \u2264 ','Total \u2264 ')+PF.maxExposurePct+'% '+TL('\u043a\u0430\u043f\u0438\u0442\u0430\u043b\u0430','\u05de\u05d4\u05d4\u05d5\u05df','of capital')+'  \u00b7  '+PF.nEff+' '+TL('\u043d\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043c\u044b\u0445 \u0441\u0442\u0430\u0432\u043e\u043a \u0438\u0437 ','\u05d4\u05d9\u05de\u05d5\u05e8\u05d9\u05dd \u05de\u05ea\u05d5\u05da ','independent bets of ')+PF.n;
      pb.appendChild(ph);
      var p2=el('div','qvs-vs');p2.style.marginTop='3px';
      p2.textContent=TL('\u0441\u0440\u0435\u0434\u043d\u044f\u044f \u043a\u043e\u0440\u0440\u0435\u043b\u044f\u0446\u0438\u044f','\u05de\u05ea\u05d0\u05dd \u05de\u05de\u05d5\u05e6\u05e2','avg correlation')+' '+PF.rhoBar+' \u00b7 '+TL('\u0434\u0438\u0432\u0435\u0440\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f','\u05e4\u05d9\u05d6\u05d5\u05e8','diversification')+' '+PF.divRatio+'\u00d7 \u00b7 ES(5'+TL('\u0434','\u05d9','d')+') '+PF.esPortPct+'% \u00b7 '+PF.ups+'\u2191/'+PF.downs+'\u2193';
      pb.appendChild(p2);
      var pmsg={
        'herd':TL('\u0431\u0443\u043c\u0430\u0433\u0438 \u0445\u043e\u0434\u044f\u0442 \u0432\u043c\u0435\u0441\u0442\u0435 \u2014 \u044d\u0442\u043e \u043e\u0434\u043d\u0430 \u0441\u0442\u0430\u0432\u043a\u0430, \u0430 \u043d\u0435 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e','\u05e0\u05e2\u05d9\u05dd \u05d9\u05d7\u05d3','the names move together — this is one bet, not several'),
        'concentrated':TL('\u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0445 \u0441\u0442\u0430\u0432\u043e\u043a \u0433\u043e\u0440\u0430\u0437\u0434\u043e \u043c\u0435\u043d\u044c\u0448\u0435, \u0447\u0435\u043c \u0441\u0442\u0440\u043e\u043a \u0432 \u0441\u043f\u0438\u0441\u043a\u0435','\u05e8\u05d9\u05db\u05d5\u05d6','far fewer real bets than rows in the list'),
        'one-way':TL('\u0432\u0441\u0435 \u0432 \u043e\u0434\u043d\u0443 \u0441\u0442\u043e\u0440\u043e\u043d\u0443 \u2014 \u043d\u0435\u0442 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0435\u0439 \u0441\u0442\u0440\u0430\u0445\u043e\u0432\u043a\u0438','\u05d4\u05db\u05dc \u05dc\u05db\u05d9\u05d5\u05d5\u05df \u05d0\u05d7\u05d3','all one direction — no internal hedge')
      };
      if(PF.flags&&PF.flags.length){
        var pw=el('div','qvs-note qvs-warn');
        pw.textContent=PF.flags.map(function(k){return pmsg[k]||k;}).join(' \u00b7 ');
        pb.appendChild(pw);
      }
      try{
        drawPortfolio(pb,PF);
        var pcap=el('div','qvs-vs');pcap.style.marginTop='2px';
        pcap.textContent=TL('\u0421\u0435\u0442\u043a\u0430 \u2014 \u043f\u043e\u043f\u0430\u0440\u043d\u0430\u044f \u043a\u043e\u0440\u0440\u0435\u043b\u044f\u0446\u0438\u044f (\u0442\u0451\u043f\u043b\u044b\u0435 \u043a\u043b\u0435\u0442\u043a\u0438 \u2014 \u0445\u043e\u0434\u044f\u0442 \u0432\u043c\u0435\u0441\u0442\u0435). \u041f\u043e\u043b\u043e\u0441\u0430 \u2014 \u0434\u043e\u043b\u044f \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0445 \u0441\u0442\u0430\u0432\u043e\u043a \u043e\u0442 \u0447\u0438\u0441\u043b\u0430 \u0441\u0442\u0440\u043e\u043a; \u0434\u0435\u043b\u0435\u043d\u0438\u044f \u2014 \u0441\u0442\u0440\u043e\u043a\u0438 \u0432 \u0441\u043f\u0438\u0441\u043a\u0435.','\u05e8\u05e9\u05ea \u05de\u05ea\u05d0\u05dd; \u05e4\u05e1 \u05d4\u05d9\u05de\u05d5\u05e8\u05d9\u05dd \u05d4\u05d0\u05de\u05d9\u05ea\u05d9\u05d9\u05dd.','Grid is pairwise correlation (warm cells move together). The bar is the share of real bets against the number of rows; ticks are the rows.');
        pb.appendChild(pcap);
      }catch(_pv){}
      if(PF.maxPair&&PF.maxRho>=0.7){
        var mp2=el('div','qvs-vs');mp2.style.marginTop='2px';
        mp2.textContent=TL('\u0442\u0435\u0441\u043d\u0435\u0435 \u0432\u0441\u0435\u0433\u043e','\u05d4\u05e6\u05de\u05d5\u05d3 \u05d4\u05d3\u05d5\u05e7','closest pair')+': '+PF.maxPair[0]+' \u2194 '+PF.maxPair[1]+' ('+PF.maxRho+')';
        pb.appendChild(mp2);
      }
      pb.appendChild(el('div','qvs-note',TL('\u041b\u0438\u043c\u0438\u0442 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u043f\u043e \u043f\u043e\u043b\u043d\u043e\u0439 \u043a\u043e\u0432\u0430\u0440\u0438\u0430\u0446\u0438\u0438 \u0440\u0430\u0432\u043d\u043e\u0432\u0437\u0432\u0435\u0448\u0435\u043d\u043d\u043e\u0439 \u043a\u043e\u0440\u0437\u0438\u043d\u044b \u043f\u0440\u0438 \u0431\u044e\u0434\u0436\u0435\u0442\u0435 '+PF.budgetPct+'%. \u0414\u0435\u0441\u044f\u0442\u044c \u0441\u0442\u0440\u043e\u043a \u0432 \u0441\u043f\u0438\u0441\u043a\u0435 \u2014 \u043d\u0435 \u0434\u0435\u0441\u044f\u0442\u044c \u0441\u0442\u0430\u0432\u043e\u043a.','\u05de\u05d7\u05d5\u05e9\u05d1 \u05de\u05dc\u05d0 \u05d4\u05e9\u05d5\u05e0\u05d5\u05ea \u05d4\u05de\u05e9\u05d5\u05ea\u05e4\u05ea.','Computed from the full covariance of the equal-weight book at a '+PF.budgetPct+'% budget. Ten rows in the list are not ten bets.')));
      container.appendChild(pb);
    }
  }catch(_pf){}
  container.appendChild(el('div','qvs-foot',TL('Извлекает статистическую структуру из истории, не гарантирует прибыль. Не инвестиционный совет.','מחלץ מבנה סטטיסטי, לא מבטיח רווח. לא ייעוץ.','Extracts statistical structure; no profit guarantee. Not advice.')));
  container.appendChild(el('div','qvs-foot',TL('Оговорка о выживаемости: тесты и скан опираются на текущие листинги и историю выжившего инструмента; делистингованные/обанкротившиеся имена отсутствуют, поэтому оценки смещены оптимистично.','הטיית שרידות: הבדיקות מתבססות על ניירות נסחרים כיום ועל היסטוריית מכשיר ששרד; שמות שנמחקו/פשטו רגל נעדרים, ולכן ההערכות מוטות לטובה.','Survivorship caveat: tests and scan rely on currently-listed names and a surviving instrument\\u2019s own history; delisted/bankrupt names are absent, so estimates skew optimistic.')));
}

/* ---------- MA200 scan (Σ-overlay feature) ---------- */
var MA200_UNIVERSE=["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","JPM","V","MA","UNH","XOM","CVX","JNJ","PG","KO","PEP","WMT","HD","BAC","DIS","NFLX","CRM","AMD","INTC","QCOM","CSCO","ORCL","IBM","PFE","MRK","ABBV","TMO","COST","MCD","NKE","BA","CAT","GE","F","GM","T","VZ","WFC","GS","MS","C","E","MCRI","GCO","NICE","CRTO","SMCI","MU","PANW","DELL","ANET"];
function smaN(a,n){ if(!a||a.length<n) return null; var s=0,i; for(i=a.length-n;i<a.length;i++) s+=a[i]; return s/n; }
async function ma200Scan(opts,onProg){
  opts=opts||{}; var thr=(opts.thresholdPct!=null?opts.thresholdPct:3), minBars=200;
  var uni=MA200_UNIVERSE.slice();
  try{ var w=JSON.parse(localStorage.getItem('qe_watchlist')||'[]');
    if(Array.isArray(w)) w.forEach(function(x){ var t=(''+((x&&x.ticker)||x)).trim().toUpperCase(); if(t&&uni.indexOf(t)<0) uni.push(t); }); }catch(e){}
  var out=[], done=0, total=uni.length, skip=0, i=0, BATCH=4;
  async function one(sym){
    try{
      var c=await fetchCloses(sym);
      if(!c||c.length<minBars){ skip++; return; }
      var price=c[c.length-1], s200=smaN(c,200), s50=smaN(c,50), s200prev=smaN(c.slice(0,c.length-20),200);
      if(!(s200>0)){ skip++; return; }
      var dist=(price/s200-1)*100;
      if(Math.abs(dist)<=thr){
        var side=(price>=s200)?'support':'resistance';               // above the line = testing support; below = resistance
        var trendUp=(s50!=null&&s200!=null)?(s50>=s200):((s200prev!=null)?(s200>=s200prev):(dist>=0));
        var conv=(side==='support'?1:-1)+(trendUp?1:-1);              // -2..+2 : support-in-uptrend best, resistance-in-downtrend worst
        out.push({sym:sym,price:price,s200:s200,s50:s50,dist:dist,side:side,trendUp:trendUp,conv:conv});
      }
    }catch(e){ skip++; }
    finally{ done++; if(onProg) try{onProg(done,total,out.length);}catch(_){}}
  }
  while(i<uni.length){ var b=uni.slice(i,i+BATCH); i+=BATCH; await Promise.all(b.map(one)); }
  out.sort(function(a,b){ return (Math.abs(a.dist)-Math.abs(b.dist)) || (b.conv-a.conv); });
  return {items:out, scanned:total, skipped:skip, thresholdPct:thr};
}
function renderMA200(container,r){
  container.innerHTML='';
  if(r&&r.pbo!=null){var _pb=el('div','qvs-msg');_pb.textContent='PBO '+Math.round(r.pbo*100)+'% '+(r.pbo>0.5?TL('(риск оверфита выбора)','(סיכון התאמת יתר)','(selection overfit risk)'):TL('(отбор устойчив)','(בחירה יציבה)','(selection robust)'));_pb.style.color=(r.pbo>0.5?'#F5B23D':'#43E39B');container.appendChild(_pb);} if(!r.items.length){ container.appendChild(elText('div','qvs-msg',
    TL('На \u00b1','\u05d1\u05d8\u05d5\u05d5\u05d7 \u00b1','Within \u00b1')+r.thresholdPct+'% \u2014 '+TL('\u043d\u0438\u043a\u043e\u0433\u043e. \u0421\u043a\u0430\u043d ','\u05d0\u05d9\u05df. \u05e0\u05e1\u05e8\u05e7\u05d5 ','none. Scanned ')+r.scanned+', '+TL('\u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043e ','\u05d3\u05d5\u05dc\u05d2\u05d5 ','skipped ')+r.skipped)); return; }
  container.appendChild(elText('div','qvs-msg',
    TL('\u041d\u0430 MA200 (\u00b1','\u05e2\u05dc MA200 (\u00b1','On MA200 (\u00b1')+r.thresholdPct+'%): '+r.items.length+' \u00b7 '+TL('\u0441\u043a\u0430\u043d ','\u05e0\u05e1\u05e8\u05e7 ','scanned ')+r.scanned));
  r.items.forEach(function(it){
    var col=it.conv>=2?'#43E39B':(it.conv<=-2?'#FF5F70':(it.conv>0?'#4CC2FF':'#F5B23D'));
    var arrow=it.dist>=0?'\u25b2':'\u25bc';
    var sideTxt=it.side==='support'?TL('\u0442\u0435\u0441\u0442 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438','\u05d1\u05d3\u05d9\u05e7\u05ea \u05ea\u05de\u05d9\u05db\u05d4','support test'):TL('\u0442\u0435\u0441\u0442 \u0441\u043e\u043f\u0440\u043e\u0442\u0438\u0432\u043b\u0435\u043d\u0438\u044f','\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05ea\u05e0\u05d2\u05d3\u05d5\u05ea','resistance test');
    var trendTxt=it.trendUp?TL('\u0442\u0440\u0435\u043d\u0434\u2191','\u05de\u05d2\u05de\u05d4\u2191','trend\u2191'):TL('\u0442\u0440\u0435\u043d\u0434\u2193','\u05de\u05d2\u05de\u05d4\u2193','trend\u2193');
    var row=el('div'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid '+GRID+';font-family:monospace;font-size:12px;';
    var sy=el('b'); sy.textContent=it.sym; sy.style.cssText='min-width:54px;color:'+INK+';cursor:pointer;';
    sy.addEventListener('click',function(){ try{ root.QVStructure.open(it.sym); }catch(e){} });
    var meta=el('span'); meta.style.cssText='flex:1;color:'+PH+';';
    meta.textContent=arrow+Math.abs(it.dist).toFixed(1)+'% \u00b7 '+it.price.toFixed(2)+'/'+it.s200.toFixed(2);
    var tag=el('span'); tag.textContent=sideTxt+' \u00b7 '+trendTxt; tag.style.cssText='color:'+col+';font-size:10px;text-align:right;';
    row.appendChild(sy); row.appendChild(meta); row.appendChild(tag); container.appendChild(row);
  });
  container.appendChild(el('div','qvs-foot',TL('\u0422\u0430\u043f \u043f\u043e \u0442\u0438\u043a\u0435\u0440\u0443 \u2014 \u043f\u043e\u043b\u043d\u044b\u0439 \u0430\u043d\u0430\u043b\u0438\u0437. \u041d\u0435 \u0438\u043d\u0432\u0435\u0441\u0442\u0441\u043e\u0432\u0435\u0442.','\u05d4\u05e7\u05e9 \u05e2\u05dc \u05d8\u05d9\u05e7\u05e8 \u05dc\u05e0\u05d9\u05ea\u05d5\u05d7 \u05de\u05dc\u05d0. \u05d0\u05d9\u05e0\u05d5 \u05d9\u05d9\u05e2\u05d5\u05e5.','Tap a ticker for full analysis. Not investment advice.')));
}

function dsrRank(items){
  // Deflate each trial's Sharpe against the expected-maximum-of-N benchmark built from the
  // ACTUAL cross-trial SR dispersion. This is where selection bias is finally paid for.
  if(!items||items.length<2){
    var o0=(items||[]).map(function(it){var c={};for(var k in it)c[k]=it[k];c.dsr=psr(it.sr,0,it.T,it.skew,it.kurt);return c;});
    o0.sort(function(a,b){return b.dsr-a.dsr;}); return {items:o0,sr0:0,N:o0.length};
  }
  var GAMMA=0.5772156649015329, srs=items.map(function(i){return i.sr;}), vv=variance(srs), n=items.length;
  var sr0=(vv>0)?Math.sqrt(vv)*((1-GAMMA)*normInv(1-1/n)+GAMMA*normInv(1-1/(n*Math.E))):0;
  var out=items.map(function(it){var c={};for(var k in it)c[k]=it[k];c.dsr=psr(it.sr,sr0,it.T,it.skew,it.kurt);return c;});
  out.sort(function(a,b){return b.dsr-a.dsr;});
  return {items:out,sr0:sr0,N:n};
}
async function dsrScan(opts,onProg){
  opts=opts||{};
  var uni=MA200_UNIVERSE.slice(0,24);   // discovery is heavy; keep the core set + watchlist bounded
  try{ var w=JSON.parse(localStorage.getItem('qe_watchlist')||'[]');
    if(Array.isArray(w)) w.forEach(function(x){var t=(''+((x&&x.ticker)||x)).trim().toUpperCase(); if(t&&uni.indexOf(t)<0)uni.push(t);}); }catch(e){}
  var N=uni.length, items=[], done=0, skip=0, i=0, BATCH=3, _cols=[];
  async function one(sym){
    try{
      var c=await fetchCloses(sym);
      if(!c||c.length<200){ skip++; return; }
      var d=discoverStructure(c,{trials:N,perms:opts.perms||80,folds:opts.folds||5});
      if(d&&d.ok&&d.stats&&isFinite(d.stats.sr)&&d.stats.stratLen>20){
        _cols.push({sym:sym,ret:_retsOf(c)}); items.push({sym:sym,sr:d.stats.sr,skew:d.stats.srSkew,kurt:d.stats.srKurt,T:d.stats.stratLen,tier:d.stats.gateTier,pPerm:d.stats.pPermutation}); }
      else skip++;
    }catch(e){ skip++; }
    finally{ done++; if(onProg) try{onProg(done,N,items.length);}catch(_){}}
  }
  while(i<uni.length){ var b=uni.slice(i,i+BATCH); i+=BATCH; await Promise.all(b.map(one)); }
  var _pbo=null; try{ if(_cols.length>=4){ var _mn=Math.min.apply(null,_cols.map(function(x){return x.ret.length;})); _mn=Math.min(_mn,300); if(_mn>=40){ var _M=[]; for(var _t=0;_t<_mn;_t++){ var _row=[]; for(var _j=0;_j<_cols.length;_j++){ var rr=_cols[_j].ret; _row.push(rr[rr.length-_mn+_t]); } _M.push(_row); } _pbo=pbo(_M,10).pbo; } } }catch(e){}
  var r=dsrRank(items);
  return {items:r.items, sr0:r.sr0, scanned:N, skipped:skip, N:items.length, pbo:_pbo};
}
function renderDSR(container,r){
  container.innerHTML='';
  if(!r.items.length){ container.appendChild(elText('div','qvs-msg',
    TL('DSR: \u043d\u0435\u0442 \u0432\u0430\u043b\u0438\u0434\u043d\u044b\u0445, \u0441\u043a\u0430\u043d ','DSR: \u05d0\u05d9\u05df \u05ea\u05e7\u05e4\u05d9\u05dd, \u05e0\u05e1\u05e8\u05e7 ','DSR: none valid, scanned ')+r.scanned)); return; }
  container.appendChild(elText('div','qvs-msg',
    TL('DSR-\u0441\u043a\u0430\u043d: ','\u05e1\u05e8\u05d9\u05e7\u05ea DSR: ','DSR scan: ')+r.items.length+'/'+r.scanned+' \u00b7 SR0='+r.sr0.toFixed(3)));
  r.items.forEach(function(it){
    var col=it.dsr>=0.95?'#43E39B':(it.dsr>=0.9?'#4CC2FF':(it.dsr>=0.5?'#F5B23D':'#FF5F70'));
    var row=el('div'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid '+GRID+';font-family:monospace;font-size:12px;';
    var sy=el('b'); sy.textContent=it.sym; sy.style.cssText='min-width:54px;color:'+INK+';cursor:pointer;';
    sy.addEventListener('click',function(){ try{ root.QVStructure.open(it.sym); }catch(e){} });
    var meta=el('span'); meta.style.cssText='flex:1;color:'+PH+';'; meta.textContent='SR '+it.sr.toFixed(3)+' \u00b7 '+it.tier;
    var tag=el('span'); tag.textContent='DSR '+it.dsr.toFixed(2); tag.style.cssText='color:'+col+';';
    row.appendChild(sy); row.appendChild(meta); row.appendChild(tag); container.appendChild(row);
  });
  container.appendChild(el('div','qvs-foot',
    TL('DSR = P(\u043a\u0440\u0430\u0439 \u0440\u0435\u0430\u043b\u0435\u043d \u043f\u043e\u0441\u043b\u0435 \u0434\u0435\u0444\u043b\u044f\u0446\u0438\u0438 \u043d\u0430 '+r.N+' \u043f\u0440\u043e\u0431 + skew/kurt). \u0422\u0430\u043f \u2014 \u0430\u043d\u0430\u043b\u0438\u0437. \u041d\u0435 \u0438\u043d\u0432\u0435\u0441\u0442\u0441\u043e\u0432\u0435\u0442.','DSR = \u05d4\u05e1\u05ea\u05d1\u05e8\u05d5\u05ea \u05e9\u05d4\u05d9\u05ea\u05e8\u05d5\u05df \u05d0\u05de\u05d9\u05ea\u05d9 \u05d0\u05d7\u05e8\u05d9 \u05d3\u05e4\u05dc\u05e6\u05d9\u05d4. \u05d0\u05d9\u05e0\u05d5 \u05d9\u05d9\u05e2\u05d5\u05e5.','DSR = P(edge real after deflating for '+r.N+' trials + skew/kurt). Tap for analysis. Not advice.')));
}
function _clip(p){return Math.min(1-1e-6,Math.max(1e-6,p));}
function _ece(ps,ys,B){B=B||10;var n=ps.length,conf=new Array(B).fill(0),acc=new Array(B).fill(0),cnt=new Array(B).fill(0),i,e=0;
 for(i=0;i<n;i++){var b=Math.min(B-1,Math.floor(_clip(ps[i])*B));conf[b]+=ps[i];acc[b]+=ys[i];cnt[b]++;}
 for(i=0;i<B;i++)if(cnt[i])e+=(cnt[i]/n)*Math.abs(acc[i]/cnt[i]-conf[i]/cnt[i]);return e;}
function _logreg(X,y,it,lam){var p=X[0].length,n=X.length,i,j,k,mu=new Array(p).fill(0),sd=new Array(p).fill(1);
 // L2 ridge on the standardized slopes (NOT the bias): without it, gradient descent on a
 // skewed or near-separable sample drives the slope huge and the fitted sigmoid saturates,
 // mapping almost every probability to ~0.999 — the "moved by >40 points" calibration bug.
 lam=(lam==null?1.0:lam);
 for(j=1;j<p;j++){var m=0;for(i=0;i<n;i++)m+=X[i][j];m/=n;var v=0;for(i=0;i<n;i++){var d=X[i][j]-m;v+=d*d;}v=Math.sqrt(v/n)||1;mu[j]=m;sd[j]=v;}
 var Z=X.map(function(r){var z=r.slice();for(var q=1;q<p;q++)z[q]=(r[q]-mu[q])/sd[q];return z;});
 var w=new Array(p).fill(0),lr=0.5;
 for(k=0;k<(it||1500);k++){var g=new Array(p).fill(0);for(i=0;i<n;i++){var zz=0;for(j=0;j<p;j++)zz+=w[j]*Z[i][j];var pr=1/(1+Math.exp(-zz)),dd=pr-y[i];for(j=0;j<p;j++)g[j]+=dd*Z[i][j];}for(j=0;j<p;j++){var gj=g[j]/n+(j>0?lam*w[j]/n:0);w[j]-=lr*gj;}}
 var wo=w.slice(),b=w[0];for(j=1;j<p;j++){wo[j]=w[j]/sd[j];b-=w[j]*mu[j]/sd[j];}wo[0]=b;return wo;}
function _plattFit(ps,ys){return {t:'platt',w:_logreg(ps.map(function(p){var q=_clip(p);return [1,Math.log(q/(1-q))];}),ys)};}
function _betaFit(ps,ys){return {t:'beta',w:_logreg(ps.map(function(p){var q=_clip(p);return [1,Math.log(q),Math.log(1-q)];}),ys)};}
function _applyCal(cal,p){var q=_clip(p),z;if(cal.t==='identity')return p;
 z=cal.t==='platt'?(cal.w[0]+cal.w[1]*Math.log(q/(1-q))):(cal.w[0]+cal.w[1]*Math.log(q)+cal.w[2]*Math.log(1-q));return 1/(1+Math.exp(-z));}
// D1 FIX: replace over-fitting isotonic with Platt/beta, applied ONLY if it beats identity on held-out.
/* Speed: pickCalibrator is deterministic (seeded shuffle) in (ps,ys,opts); the fit is the dominant cost of the periodic
   re-arming. Exact memo of the last few inputs; identical object returned (it is only read afterwards). */
var _pcMemo=[];
function pickCalibratorMemo(ps,ys,opts){ var key; try{ key=ps.join(",")+"|"+ys.join(",")+"|"+JSON.stringify(opts||{}); }catch(e){ return pickCalibrator(ps,ys,opts); }
  for(var i=0;i<_pcMemo.length;i++) if(_pcMemo[i].k===key) return _pcMemo[i].v;
  var v=pickCalibrator(ps,ys,opts); _pcMemo.push({k:key,v:v}); if(_pcMemo.length>4) _pcMemo.shift(); return v; }
function pickCalibrator(ps,ys,opts){opts=opts||{};var n=ps.length;
 if(n<50)return {method:'identity',apply:function(p){return p;},reason:'n<50'};
 // Seeded shuffle BEFORE the held-out split. A raw time-ordered slice can hand the fit a
 // tail that is almost all wins; a sigmoid that outputs ~1 then scores well on an equally
 // skewed validation slice and passes the gate, even though it destroys calibration in the
 // middle. Shuffling makes train and validation share the same label mix.
 var idx=ps.map(function(_,i){return i;}),rnd=mul32(0x9E3779B1);
 for(var s=idx.length-1;s>0;s--){var j2=Math.floor(rnd()*(s+1)),tm=idx[s];idx[s]=idx[j2];idx[j2]=tm;}
 var P=idx.map(function(i){return ps[i];}),Y=idx.map(function(i){return ys[i];});
 var cut=Math.floor(n*0.7),tp=P.slice(0,cut),ty=Y.slice(0,cut),vp=P.slice(cut),vy=Y.slice(cut);
 var idE=_ece(vp,vy),best={m:'identity',e:idE};
 // require a real margin (0.005), not any epsilon, so noise can't select a correction
 [_plattFit(tp,ty),_betaFit(tp,ty)].forEach(function(c){var e=_ece(vp.map(function(p){return _applyCal(c,p);}),vy);if(e<best.e-0.005)best={m:c.t,e:e};});
 var full=best.m==='platt'?_plattFit(P,Y):best.m==='beta'?_betaFit(P,Y):{t:'identity'};
 // COLLAPSE / OVER-SHIFT GUARD — the certain defence against the 0.5→0.999 bug. A calibrator
 // must ADJUST probabilities, not replace them: over a [0.05..0.95] grid it may not move any
 // point by more than 0.35, nor squash the whole range into a band narrower than 0.10. If it
 // does, it is degenerate → fall back to identity (leave the forecast untouched).
 if(best.m!=='identity'){
   var grid=[0.05,0.15,0.25,0.35,0.45,0.55,0.65,0.75,0.85,0.95];
   var maxShift=0,mn=1,mx=0,gi;
   for(gi=0;gi<grid.length;gi++){var q=_applyCal(full,grid[gi]);if(Math.abs(q-grid[gi])>maxShift)maxShift=Math.abs(q-grid[gi]);if(q<mn)mn=q;if(q>mx)mx=q;}
   if(maxShift>0.35 || (mx-mn)<0.10){
     return {method:'identity',apply:function(p){return p;},
             reason:'degenerate '+(maxShift>0.35?('shift='+maxShift.toFixed(2)):('range='+(mx-mn).toFixed(2))),
             eceId:+idE.toFixed(4)};
   }
 }
 return {method:best.m,apply:function(p){return _applyCal(full,p);},eceId:+idE.toFixed(4),eceSel:+best.e.toFixed(4)};}
/* ---------- Cointegration / pairs scan (Engle-Granger + ADF gate) ---------- */
function _ols2(x,y){var n=x.length,sx=0,sy=0,i;for(i=0;i<n;i++){sx+=x[i];sy+=y[i];}var mx=sx/n,my=sy/n,sxx=0,sxy=0;
 for(i=0;i<n;i++){var dx=x[i]-mx;sxx+=dx*dx;sxy+=dx*(y[i]-my);}var b=sxx>0?sxy/sxx:0,a=my-b*mx,rss=0;
 for(i=0;i<n;i++){var e=y[i]-(b*x[i]+a);rss+=e*e;}var s2=n>2?rss/(n-2):0,se=(sxx>0&&s2>0)?Math.sqrt(s2/sxx):Infinity;
 return {b:b,a:a,se:se};}
function _adf(e){var de=[],lag=[],i;for(i=1;i<e.length;i++){de.push(e[i]-e[i-1]);lag.push(e[i-1]);}
 if(lag.length<20)return {t:0,stationary:false};var r=_ols2(lag,de);var t=(isFinite(r.se)&&r.se>0)?r.b/r.se:0;
 return {t:t,stationary:t<-2.86,phi:r.b};}
function _halfLife(e){var de=[],lag=[],i;for(i=1;i<e.length;i++){de.push(e[i]-e[i-1]);lag.push(e[i-1]);}
 var r=_ols2(lag,de);if(!(r.b<0))return Infinity;var hl=-Math.log(2)/Math.log(1+r.b);return isFinite(hl)?hl:Infinity;}
function cointPair(A,B){var n=Math.min(A.length,B.length);if(n<60)return null;A=A.slice(A.length-n);B=B.slice(B.length-n);
 var reg=_ols2(B,A),beta=reg.b,e=[],i;for(i=0;i<n;i++)e.push(A[i]-beta*B[i]-reg.a);
 var adf=_adf(e),me=0;for(i=0;i<n;i++)me+=e[i];me/=n;var v=0;for(i=0;i<n;i++){var d=e[i]-me;v+=d*d;}var sd=Math.sqrt(v/n)||1;
 return {beta:beta,adfT:adf.t,coint:adf.stationary,z:(e[n-1]-me)/sd,halfLife:_halfLife(e),n:n};}
async function cointScan(opts,onProg){opts=opts||{};var thrZ=(opts.z!=null?opts.z:2),uni=MA200_UNIVERSE.slice(0,16);
 try{var w=JSON.parse(localStorage.getItem('qe_watchlist')||'[]');if(Array.isArray(w))w.forEach(function(x){var t=(''+((x&&x.ticker)||x)).trim().toUpperCase();if(t&&uni.indexOf(t)<0)uni.push(t);});}catch(e){}
 var series={},done=0,i=0,B=4;
 async function one(sym){try{var c=await fetchCloses(sym);if(c&&c.length>=120)series[sym]=c;}catch(e){}finally{done++;if(onProg)try{onProg(done,uni.length,Object.keys(series).length);}catch(_){}}}
 while(i<uni.length){var b=uni.slice(i,i+B);i+=B;await Promise.all(b.map(one));}
 var syms=Object.keys(series),out=[],j,k;
 function rets(c){var r=[];for(var t=1;t<c.length;t++)r.push(Math.log(c[t]/c[t-1]));return r;}
 var R={};syms.forEach(function(sy){R[sy]=rets(series[sy]);});
 function corr(a,b){var n=Math.min(a.length,b.length);a=a.slice(a.length-n);b=b.slice(b.length-n);var ma=0,mb=0,t;for(t=0;t<n;t++){ma+=a[t];mb+=b[t];}ma/=n;mb/=n;var sab=0,sa=0,sb=0;for(t=0;t<n;t++){var da=a[t]-ma,db=b[t]-mb;sab+=da*db;sa+=da*da;sb+=db*db;}return (sa>0&&sb>0)?sab/Math.sqrt(sa*sb):0;}
 for(j=0;j<syms.length;j++)for(k=j+1;k<syms.length;k++){
   if(Math.abs(corr(R[syms[j]],R[syms[k]]))<0.5)continue;
   var cp=cointPair(series[syms[j]],series[syms[k]]);
   if(cp&&cp.coint&&isFinite(cp.halfLife)&&cp.halfLife>1&&cp.halfLife<120&&Math.abs(cp.z)>=thrZ)
     out.push({a:syms[j],b:syms[k],beta:cp.beta,z:cp.z,adfT:cp.adfT,halfLife:cp.halfLife});}
 out.sort(function(x,y){return Math.abs(y.z)-Math.abs(x.z);});
 return {pairs:out,scanned:uni.length,valid:syms.length,z:thrZ};}
function renderCoint(container,r){container.innerHTML='';
 if(!r.pairs.length){container.appendChild(elText('div','qvs-msg',TL('Пар нет. Скан ','אין זוגות. נסרק ','No pairs. scanned ')+r.scanned+'/'+r.valid));return;}
 container.appendChild(elText('div','qvs-msg',TL('Коинт. пары (|z|>=','זוגות (|z|>=','Coint. pairs (|z|>=')+r.z+'): '+r.pairs.length));
 r.pairs.forEach(function(it){var col=Math.abs(it.z)>=3?'#43E39B':'#4CC2FF';
  var row=el('div');row.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid '+GRID+';font-family:monospace;font-size:12px;';
  var sy=el('b');sy.textContent=it.a+'-'+it.b;sy.style.cssText='min-width:96px;color:'+INK+';';
  var meta=el('span');meta.style.cssText='flex:1;color:'+PH+';';meta.textContent='b='+it.beta.toFixed(2)+' HL='+Math.round(it.halfLife)+'d ADF '+it.adfT.toFixed(2);
  var tag=el('span');tag.textContent='z '+it.z.toFixed(2);tag.style.cssText='color:'+col+';';
  row.appendChild(sy);row.appendChild(meta);row.appendChild(tag);container.appendChild(row);});
 container.appendChild(el('div','qvs-foot',TL('Спред стационарен (ADF<-2.86); |z| велик -> возврат к среднему. Не инвестсовет.','המרווח נייח. אינו ייעוץ.','Spread stationary (ADF<-2.86); high |z| -> mean-reversion. Not advice.')));}
/* ---------- Optimal execution schedule (Almgren-Chriss 2000) ---------- */
function execSchedule(opts){opts=opts||{};var N=Math.max(2,Math.round(opts.N||5)),sig=opts.sigma||0.02,eta=opts.eta||1,
 lam=(opts.lambda!=null?opts.lambda:1e-4),Q=opts.Q||1,T=N,j;
 var kappa=Math.sqrt(Math.max(0,lam)*sig*sig/Math.max(1e-12,eta));      // trade-off rate: sqrt(lambda*sigma^2/eta)
 function x(t){return kappa<1e-8? Q*(1-t/T) : Q*Math.sinh(kappa*(T-t))/Math.sinh(kappa*T);}  // holdings trajectory
 var hold=[],trade=[];for(j=0;j<=N;j++)hold.push(x(j));for(j=1;j<=N;j++)trade.push(hold[j-1]-hold[j]);
 var cost=0,risk=0;for(j=0;j<N;j++)cost+=eta*trade[j]*trade[j];for(j=0;j<=N;j++)risk+=sig*sig*hold[j]*hold[j];
 var twap=Q/N,frontLoad=trade[0]/twap;
 return {N:N,kappa:kappa,holdings:hold,trades:trade,twap:twap,frontLoad:frontLoad,tempCost:cost,riskVar:risk};}
function renderExec(container,sym,sc){container.innerHTML='';
 container.appendChild(elText('div','qvs-msg',TL('План исполнения ','תוכנית ביצוע ','Execution plan ')+sym+' - '+sc.N+TL(' дн.',' ימים',' d')+' - '+TL('фронт-лоад ','front-load ','front-load ')+'x'+sc.frontLoad.toFixed(2)));
 var row=el('div');row.style.cssText='display:flex;gap:4px;align-items:flex-end;height:70px;padding:8px 4px;border-bottom:1px solid '+GRID+';';
 var mx=Math.max.apply(null,sc.trades)||1;
 sc.trades.forEach(function(tr,i){var h=Math.max(3,Math.round(60*tr/mx));var c=el('div');
  c.style.cssText='flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-family:monospace;font-size:9px;color:'+PH+';';
  var bar=el('div');bar.style.cssText='width:70%;height:'+h+'px;background:'+PH+';border-radius:3px 3px 0 0;';
  c.appendChild(el('span',null,(100*tr/(sc.trades.reduce(function(a,b){return a+b;},0))).toFixed(0)+'%'));c.appendChild(bar);
  c.appendChild(el('span',null,'D'+(i+1)));row.appendChild(c);});
 container.appendChild(row);
 container.appendChild(el('div','qvs-foot',TL('Доля позиции в день по Almgren-Chriss. Меньше риск-аверсии -> ближе к равномерному (TWAP); больше -> раньше. Не инвестсовет.','חלק מהפוזיציה ליום (Almgren-Chriss). אינו ייעוץ.','Share of position per day (Almgren-Chriss). Lower risk-aversion -> TWAP; higher -> earlier. Not advice.')));}
/* ---------- Market breadth regime gate (% of universe above SMA200/SMA50) ---------- */
function _aboveSMA(closes,n){var m=smaN(closes,n);if(m==null)return null;return closes[closes.length-1]>m;}
function breadthClassify(a200,a50){
 if(a200>=0.60&&a50>=0.55)return 'broad-strength';
 if(a200>=0.50&&a50<0.40)return 'deteriorating';         // index broadly up, short-term breadth weakening
 if(a200<0.40)return 'broad-weakness';
 return 'neutral';}
async function breadthScan(opts,onProg){opts=opts||{};var uni=MA200_UNIVERSE.slice();
 try{var w=JSON.parse(localStorage.getItem('qe_watchlist')||'[]');if(Array.isArray(w))w.forEach(function(x){var t=(''+((x&&x.ticker)||x)).trim().toUpperCase();if(t&&uni.indexOf(t)<0)uni.push(t);});}catch(e){}
 var n200=0,ab200=0,n50=0,ab50=0,done=0,i=0,B=5;
 async function one(sym){try{var c=await fetchCloses(sym);if(c){var b200=_aboveSMA(c,200),b50=_aboveSMA(c,50);
   if(b200!=null){n200++;if(b200)ab200++;}if(b50!=null){n50++;if(b50)ab50++;}}}catch(e){}finally{done++;if(onProg)try{onProg(done,uni.length,n200);}catch(_){}}}
 while(i<uni.length){var b=uni.slice(i,i+B);i+=B;await Promise.all(b.map(one));}
 var a200=n200?ab200/n200:0,a50=n50?ab50/n50:0;
 return {above200:a200,above50:a50,regime:breadthClassify(a200,a50),n:n200,scanned:uni.length};}
function renderBreadth(container,r){container.innerHTML='';
 var lab={'broad-strength':[TL('Широкая сила','רוחב חזק','Broad strength'),'#43E39B'],
  'deteriorating':[TL('Ухудшение (индекс↑, рынок↓)','הידרדרות','Deteriorating (index up, breadth down)'),'#F5B23D'],
  'broad-weakness':[TL('Широкая слабость','חולשה רחבה','Broad weakness'),'#FF5F70'],
  'neutral':[TL('Нейтрально','ניטרלי','Neutral'),'#4CC2FF']}[r.regime];
 if(r.n<8){container.appendChild(elText('div','qvs-msg',TL('Мало данных для ширины (','מעט נתונים (','Too little data (')+r.n+')'));return;}
 var hd=el('div');hd.style.cssText='font-family:monospace;font-size:13px;font-weight:800;color:'+lab[1]+';padding:6px 4px;';
 hd.textContent=lab[0].toUpperCase();container.appendChild(hd);
 function bar(name,frac){var row=el('div');row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 4px;font-family:monospace;font-size:12px;';
  var t=el('span');t.textContent=name;t.style.cssText='min-width:110px;color:'+PH+';';
  var track=el('div');track.style.cssText='flex:1;height:10px;border-radius:5px;background:'+PANEL+';border:1px solid '+GRID+';overflow:hidden;';
  var fill=el('div');fill.style.cssText='height:100%;width:'+Math.round(frac*100)+'%;background:'+(frac>=0.55?'#43E39B':frac<0.4?'#FF5F70':'#F5B23D')+';';
  track.appendChild(fill);var v=el('span');v.textContent=Math.round(frac*100)+'%';v.style.cssText='color:'+INK+';min-width:36px;text-align:right;';
  row.appendChild(t);row.appendChild(track);row.appendChild(v);container.appendChild(row);}
 bar(TL('над SMA200','מעל SMA200','above SMA200'),r.above200);
 bar(TL('над SMA50','מעל SMA50','above SMA50'),r.above50);
 container.appendChild(el('div','qvs-foot',TL('Ширина рынка: '+r.n+' бумаг. Сильный индекс при узкой ширине — хрупкость. Не инвестсовет.','רוחב שוק. אינו ייעוץ.','Market breadth: '+r.n+' names. Strong index + narrow breadth = fragility. Not advice.')));}
function _breadthBadge(){ if(document.getElementById('qvBreadthBadge'))return;
 var TTL=30*60*1000,KEY='qe_breadth_cache';
 var el0=document.createElement('div');el0.id='qvBreadthBadge';
 el0.style.cssText='position:fixed;bottom:calc(72px + env(safe-area-inset-bottom,0px));left:12px;z-index:9998;display:flex;align-items:center;gap:7px;background:'+PANEL+';border:1px solid '+GRID+';border-radius:20px;padding:6px 11px;font-family:monospace;font-size:11px;color:'+PH+';box-shadow:0 2px 8px rgba(0,0,0,.45);cursor:pointer;max-width:62vw;';
 var dot=document.createElement('span');dot.style.cssText='width:9px;height:9px;border-radius:50%;background:'+PH+';flex:none;';
 var txt=document.createElement('span');txt.textContent=TL('ширина рынка…','רוחב שוק…','market breadth…');
 el0.appendChild(dot);el0.appendChild(txt);try{document.body.appendChild(el0);}catch(e){return;}
 var COL={'broad-strength':'#43E39B','deteriorating':'#F5B23D','broad-weakness':'#FF5F70','neutral':'#4CC2FF'};
 var LAB={'broad-strength':TL('сила','חזק','strength'),'deteriorating':TL('ухудшение','הידרדרות','deteriorating'),'broad-weakness':TL('слабость','חולשה','weakness'),'neutral':TL('нейтр.','ניטרלי','neutral')};
 function paint(r){dot.style.background=COL[r.regime]||PH;txt.textContent=TL('рынок: ','שוק: ','market: ')+(LAB[r.regime]||'')+' · '+Math.round((r.above200||0)*100)+'%>200';}
 function fresh(){try{var c=JSON.parse(localStorage.getItem(KEY)||'null');return (c&&(Date.now()-c.ts<TTL))?c:null;}catch(e){return null;}}
 var running=false;
 function refresh(force){ if(running)return; var c=fresh(); if(c&&!force){paint(c);return;}
  running=true; txt.textContent=TL('ширина рынка…','רוחב שוק…','market breadth…'); dot.style.background=PH;
  breadthScan({}).then(function(r){ if(r&&r.n>=8){ paint(r); try{localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),regime:r.regime,above200:r.above200,above50:r.above50}));}catch(e){} }
    else txt.textContent=TL('ширина: нет данных','רוחב: אין נתונים','breadth: no data'); })
   .catch(function(){ txt.textContent=TL('ширина: н/д','רוחב: לא זמין','breadth: n/a'); })
   .then(function(){ running=false; }); }
 el0.addEventListener('click',function(){ refresh(true); });
 var c0=fresh(); if(c0) paint(c0); else setTimeout(function(){refresh(false);},4000);   // lazy first compute
 setInterval(function(){ if(!fresh()) refresh(false); }, 5*60*1000);                     // auto-refresh when stale
}
/* ---------- Prediction accuracy (hit-rate) tracking, filter & comparison ---------- */
function _kbRead(){ try{ return JSON.parse(localStorage.getItem('qe_knowledge')||'{}')||{}; }catch(e){ return {}; } }
function _isHit(s){ return s.outcome==='hit'||s.outcome===1||s.outcome===true; }
function _sigWin(sigs,days){ var cut=Date.now()-days*864e5; return (sigs||[]).filter(function(s){ var t=s.original_ts||s.ts||0; return t>=cut && s.outcome!=null; }); }
function stockAccuracy(sym,opts){ opts=opts||{}; var days=opts.days||180, db=_kbRead(), e=db[(sym||'').toUpperCase()];
 if(!e||!e.signals) return {sym:(sym||'').toUpperCase(),n:0,hitRate:0,byHorizon:{}};
 var sg=_sigWin(e.signals,days),n=sg.length,hits=0,bh={};
 sg.forEach(function(s){ if(_isHit(s))hits++; var h=s.horizonDays||s.horizon||0; if(h){ bh[h]=bh[h]||{n:0,h:0}; bh[h].n++; if(_isHit(s))bh[h].h++; } });
 var by={}; for(var k in bh) by[k]={n:bh[k].n,rate:bh[k].n?bh[k].h/bh[k].n:0};
 return {sym:(sym||'').toUpperCase(),n:n,hits:hits,hitRate:n?hits/n:0,byHorizon:by}; }
function accuracyAll(opts){ opts=opts||{}; var days=opts.days||180,minN=opts.minN||5,db=_kbRead(),out=[];
 for(var sym in db){ var a=stockAccuracy(sym,{days:days}); if(a.n>=minN) out.push(a); }
 out.sort(function(x,y){ return (y.hitRate-x.hitRate)||(y.n-x.n); }); return out; }
function topByAccuracy(N,opts){ return accuracyAll(opts).slice(0,N||10); }          // фильтр «топ по угадываниям за окно»
function accuracyFilter(items,opts){ opts=opts||{}; var minRate=(opts.minRate!=null?opts.minRate:0.5),days=opts.days||180,minN=opts.minN||3;
 return (items||[]).map(function(it){ var s=(it.sym||it.ticker||it.a||''); var a=stockAccuracy(s,{days:days}); it._hitRate=a.hitRate; it._accN=a.n; return it; })
  .filter(function(it){ return it._accN>=minN && it._hitRate>=minRate; })
  .sort(function(x,y){ return y._hitRate-x._hitRate; }); }
function forecastVsActual(sym,opts){ opts=opts||{}; var db=_kbRead(),e=db[(sym||'').toUpperCase()],hs=opts.horizons||[2,4,7,14],rows=[];
 if(e&&e.signals) hs.forEach(function(H){ var c=e.signals.filter(function(s){ return (s.horizonDays||s.horizon)==H && s.outcome!=null; });
   if(!c.length) return; c.sort(function(a,b){ return (b.original_ts||b.ts||0)-(a.original_ts||a.ts||0); }); var s=c[0];
   var mv=(s.predLN!=null)?(Math.exp(s.predLN)-1)*100:null;
   var pf=(s.entry!=null&&s.predLN!=null)?s.entry*Math.exp(s.predLN):(s.target!=null?s.target:null);
   rows.push({h:H,entry:(s.entry!=null?s.entry:null),forecast:pf,movePct:mv,dir:(s.predUp?'up':'down'),hit:_isHit(s)}); });
 return {sym:(sym||'').toUpperCase(),rows:rows}; }
var _accState={on:false,minRate:0.5,days:180,minN:3};
function _accWrap(items){ return _accState.on? accuracyFilter(items,_accState): items; }
function renderAccuracy(container,sym){ container.innerHTML='';
 var top=topByAccuracy(10,{days:_accState.days,minN:3});
 container.appendChild(elText('div','qvs-msg',TL('Топ по угадываниям (','מובילים בניחוש (','Top by hit-rate (')+Math.round(_accState.days/30)+TL(' мес)',' חוד)',' mo)')));
 if(!top.length) container.appendChild(elText('div','qvs-foot',TL('База ещё копится (нужно ≥5 разрешённых сигналов на акцию).','המאגר נצבר.','Reservoir still building (need ≥5 resolved signals per stock).')));
 top.forEach(function(a){ var row=el('div');row.style.cssText='display:flex;gap:8px;padding:6px 4px;border-bottom:1px solid '+GRID+';font-family:monospace;font-size:12px;';
  var c=a.hitRate>=0.6?'#43E39B':a.hitRate>=0.5?'#F5B23D':'#FF5F70';
  var sy=el('b');sy.textContent=a.sym;sy.style.cssText='min-width:70px;color:'+INK+';cursor:pointer;';sy.addEventListener('click',function(){ if(QVStructure&&QVStructure.open)QVStructure.open(a.sym); });
  var m=el('span');m.style.cssText='flex:1;color:'+PH+';';m.textContent='n='+a.n;
  var t=el('span');t.textContent=Math.round(a.hitRate*100)+'%';t.style.cssText='color:'+c+';min-width:40px;text-align:right;';
  row.appendChild(sy);row.appendChild(m);row.appendChild(t);container.appendChild(row); });
 if(sym){ var fv=forecastVsActual(sym); if(fv.rows.length){
   container.appendChild(elText('div','qvs-msg',TL('Прогноз vs факт · ','תחזית מול בפועל · ','Forecast vs actual · ')+fv.sym));
   fv.rows.forEach(function(r){ var row=el('div');row.style.cssText='display:flex;gap:8px;padding:5px 4px;font-family:monospace;font-size:12px;border-bottom:1px solid '+GRID+';';
    var h=el('span');h.textContent=r.h+TL(' дн',' ימים',' d');h.style.cssText='min-width:52px;color:'+PH+';';
    var f=el('span');f.style.cssText='flex:1;color:'+INK+';';f.textContent=(r.forecast!=null?('→ '+r.forecast.toFixed(2)):((r.movePct>=0?'+':'')+ (r.movePct!=null?r.movePct.toFixed(1):'—')+'%'));
    var hit=el('span');hit.textContent=r.hit?'✓':'✗';hit.style.cssText='color:'+(r.hit?'#43E39B':'#FF5F70')+';min-width:20px;';
    row.appendChild(h);row.appendChild(f);row.appendChild(hit);container.appendChild(row); }); } }
 container.appendChild(el('div','qvs-foot',TL('% угадываний по базе прогнозов. Тап по тикеру — открыть. Не инвестсовет.','אחוז ניחושים. אינו ייעוץ.','Hit-rate from the forecast database. Tap a ticker to open. Not advice.'))); }
/* ---------- TimesFM integration (external endpoint; app is a thin client, no weights inside) ---------- */
var _tfmCache={};
function _tfmUrl(){ try{ return (localStorage.getItem('qe_tfm_url')||'').trim(); }catch(e){ return ''; } }
async function tfmForecast(sym,closes,horizons){ var url=_tfmUrl(); if(!url||!closes||closes.length<32) return null;
 horizons=horizons||[2,4,7,14]; var key=(sym||'')+':'+closes.length+':'+closes[closes.length-1];
 var c=_tfmCache[key]; if(c&&Date.now()-c.ts<6*36e5) return c.v;
 try{ var ctrl=new AbortController(); var to=setTimeout(function(){ctrl.abort();},20000);
   var r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,
     body:JSON.stringify({series:closes.slice(-1024),horizons:horizons})});
   clearTimeout(to); if(!r.ok) return null; var j=await r.json();
   if(!j||!j.point||!j.q) return null; _tfmCache[key]={ts:Date.now(),v:j}; return j;
 }catch(e){ return null; }  // fail-closed: absence of TimesFM never breaks the engine
}
// Quantile CDF -> probability of a move. qArr = [q10..q90] ascending prices; levels 0.1..0.9.
function tfmMoveProb(entry,qArr,movePct){ if(!qArr||qArr.length<9||!(entry>0)) return null;
 var lv=[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9], target=entry*(1+movePct), cdf;
 if(target<=qArr[0]) cdf=0.05; else if(target>=qArr[8]) cdf=0.95;
 else { cdf=0.9; for(var i=0;i<8;i++){ if(target>=qArr[i]&&target<=qArr[i+1]){ var d=(qArr[i+1]-qArr[i])||1e-9; var f=(target-qArr[i])/d; cdf=lv[i]+f*(lv[i+1]-lv[i]); break; } } }
 return movePct>=0 ? (1-cdf) : cdf; }
function tfmBlend(pA,pB,w){ w=(w==null?0.5:w); if(pA==null)return pB; if(pB==null)return pA; return w*pA+(1-w)*pB; }
function tfmAgree(point,entry,engineUp){ if(point==null||!(entry>0)) return null; var tfmUp=point>entry; return tfmUp===!!engineUp; }
function renderTfm(container,sym,closes,engine){ container.innerHTML='';
 container.appendChild(elText('div','qvs-msg',TL('TimesFM прогноз ','תחזית TimesFM ','TimesFM forecast ')+sym+'…'));
 tfmForecast(sym,closes).then(function(j){ container.innerHTML='';
  if(!j){ container.appendChild(elText('div','qvs-msg qvs-warn',TL('TimesFM недоступен (задай URL эндпоинта в поле выше и запусти сервис).','TimesFM לא זמין.','TimesFM unavailable (set endpoint URL above and run the service).'))); return; }
  var entry=closes[closes.length-1];
  container.appendChild(elText('div','qvs-msg',TL('TimesFM · ','TimesFM · ','TimesFM · ')+sym+'  (entry '+entry.toFixed(2)+')'));
  [2,4,7,14].forEach(function(H){ var pt=j.point[H]||j.point[''+H]; var q=j.q[H]||j.q[''+H]; if(pt==null) return;
   var up=pt>entry, pUp5=(q?tfmMoveProb(entry,q,0.05):null);
   var eUp=engine&&engine.up; var agree=(eUp==null)?null:tfmAgree(pt,entry,eUp);
   var row=el('div');row.style.cssText='display:flex;gap:8px;padding:5px 4px;border-bottom:1px solid '+GRID+';font-family:monospace;font-size:12px;';
   var h=el('span');h.textContent=H+TL(' дн',' ימים',' d');h.style.cssText='min-width:52px;color:'+INK+';';
   var f=el('span');f.style.cssText='flex:1;color:'+PH+';';f.textContent='→ '+pt.toFixed(2)+' ('+((pt/entry-1)*100>=0?'+':'')+((pt/entry-1)*100).toFixed(1)+'%)'+(pUp5!=null?('  P≥5%↑ '+Math.round(pUp5*100)+'%'):'');
   var ag=el('span'); if(agree!=null){ ag.textContent=agree?'=movok':'≠'; ag.style.cssText='color:'+(agree?'#43E39B':'#F5B23D')+';min-width:22px;'; }
   row.appendChild(h);row.appendChild(f);row.appendChild(ag);container.appendChild(row); });
  container.appendChild(el('div','qvs-foot',TL('Квантили TimesFM → P(движения). = согласие с направлением движка, ≠ расхождение. Не инвестсовет.','אינו ייעוץ.','TimesFM quantiles → move-prob. = agrees with engine direction, ≠ diverges. Not advice.')));
 }); }
/* ---------- PBO / CSCV: probability of backtest overfitting (Bailey-Lopez de Prado) ---------- */
function _retsOf(c){var r=[],t;for(t=1;t<c.length;t++){var a=c[t],b=c[t-1];if(b>0&&a>0)r.push(Math.log(a/b));else r.push(0);}return r;}
function _shrp(r){var n=r.length;if(n<2)return 0;var m=0,i;for(i=0;i<n;i++)m+=r[i];m/=n;var v=0;for(i=0;i<n;i++){var d=r[i]-m;v+=d*d;}v=Math.sqrt(v/(n-1));return v>0?m/v:0;}
function _combs(n,k){var res=[],c=[];(function rec(st,dp){if(dp===k){res.push(c.slice());return;}for(var i=st;i<=n-(k-dp);i++){c.push(i);rec(i+1,dp+1);c.pop();}})(0,0);return res;}
function pbo(M,S){ if(!M||M.length<2||!M[0]||M[0].length<2) return {pbo:null,n:0};
 var T=M.length,N=M[0].length; S=S||10; if(S%2)S++; if(S>T)S=T-(T%2); if(S<2) return {pbo:null,n:0};
 var bs=Math.floor(T/S),blocks=[],b; if(bs<1) return {pbo:null,n:0};
 for(b=0;b<S;b++) blocks.push([b*bs,(b+1)*bs]);
 var combos=_combs(S,S/2); if(combos.length>2000){var st=Math.ceil(combos.length/2000);combos=combos.filter(function(_,i){return i%st===0;});}
 var loss=0,cnt=0;
 combos.forEach(function(isB){ var isSet={}; isB.forEach(function(x){isSet[x]=1;});
  var isR=[],oosR=[],j; for(j=0;j<N;j++){isR.push([]);oosR.push([]);}
  for(b=0;b<S;b++){var sg=blocks[b];for(var t=sg[0];t<sg[1];t++)for(j=0;j<N;j++)(isSet[b]?isR[j]:oosR[j]).push(M[t][j]);}
  var isS=isR.map(_shrp),oS=oosR.map(_shrp),best=0; for(j=1;j<N;j++)if(isS[j]>isS[best])best=j;
  var below=0; for(j=0;j<N;j++)if(oS[j]<oS[best])below++; var w=(below+0.5)/N,l=Math.log(w/(1-w));
  if(l<=0)loss++; cnt++; });
 return {pbo:cnt?loss/cnt:null,n:cnt,S:S,N:N,T:T}; }
/* ---------- Hidden Markov regime (2-state Gaussian HMM, Baum-Welch, scaled) ---------- */
function _gauss(x,m,sd){ sd=Math.max(sd,1e-9); var z=(x-m)/sd; return Math.exp(-0.5*z*z)/(sd*2.5066282746310002); }
function hmmFit(r,iters){ var T=r.length; if(T<40) return null; iters=iters||50; var K=2,i,t,k,j;
 var m0=0; for(i=0;i<T;i++)m0+=r[i]; m0/=T; var v0=0; for(i=0;i<T;i++){var d=r[i]-m0;v0+=d*d;} var sd0=Math.sqrt(v0/T)||1e-6;
 var M=[m0+0.15*sd0, m0-0.15*sd0], S=[0.6*sd0, 1.8*sd0];       // state0 = calm, state1 = volatile (init)
 var A=[[0.92,0.08],[0.10,0.90]], pi=[0.6,0.4];
 var gamma=null;
 for(var it=0;it<iters;it++){
  var B=new Array(T); for(t=0;t<T;t++) B[t]=[_gauss(r[t],M[0],S[0]),_gauss(r[t],M[1],S[1])];
  var al=new Array(T),c=new Array(T); al[0]=[pi[0]*B[0][0],pi[1]*B[0][1]]; c[0]=(al[0][0]+al[0][1])||1e-300; al[0][0]/=c[0]; al[0][1]/=c[0];
  for(t=1;t<T;t++){ var a0=(al[t-1][0]*A[0][0]+al[t-1][1]*A[1][0])*B[t][0], a1=(al[t-1][0]*A[0][1]+al[t-1][1]*A[1][1])*B[t][1]; c[t]=(a0+a1)||1e-300; al[t]=[a0/c[t],a1/c[t]]; }
  var be=new Array(T); be[T-1]=[1,1];
  for(t=T-2;t>=0;t--){ var b0=(A[0][0]*B[t+1][0]*be[t+1][0]+A[0][1]*B[t+1][1]*be[t+1][1])/c[t+1], b1=(A[1][0]*B[t+1][0]*be[t+1][0]+A[1][1]*B[t+1][1]*be[t+1][1])/c[t+1]; be[t]=[b0,b1]; }
  gamma=new Array(T); var xi=[[0,0],[0,0]];
  for(t=0;t<T;t++){ var g0=al[t][0]*be[t][0], g1=al[t][1]*be[t][1], gs=(g0+g1)||1e-300; gamma[t]=[g0/gs,g1/gs]; }
  for(t=0;t<T-1;t++){ for(j=0;j<K;j++) for(k=0;k<K;k++){ xi[j][k]+= al[t][j]*A[j][k]*B[t+1][k]*be[t+1][k]/c[t+1]; } }
  // M-step
  pi=[gamma[0][0],gamma[0][1]];
  for(j=0;j<K;j++){ var gsum=0; for(t=0;t<T-1;t++)gsum+=gamma[t][j]; gsum=gsum||1e-300; for(k=0;k<K;k++)A[j][k]=xi[j][k]/gsum; var rs=A[j][0]+A[j][1]||1; A[j][0]/=rs;A[j][1]/=rs; }
  for(k=0;k<K;k++){ var num=0,den=0; for(t=0;t<T;t++){num+=gamma[t][k]*r[t];den+=gamma[t][k];} den=den||1e-300; M[k]=num/den; var vn=0; for(t=0;t<T;t++){var dd=r[t]-M[k];vn+=gamma[t][k]*dd*dd;} S[k]=Math.sqrt(vn/den)||1e-6; }
 }
 var volState=S[1]>=S[0]?1:0, calmState=1-volState;
 var last=gamma[T-1], cur=last[1]>last[0]?1:0;
 return {mu:M,sd:S,A:A,pi:pi,gammaLast:last,state:cur,volState:volState,calmState:calmState,
   pVol:last[volState], curVol:S[cur], curMu:M[cur]}; }
function regimeHMM(closes){ if(!closes||closes.length<60) return null; var r=[],t; for(t=1;t<closes.length;t++){var a=closes[t],b=closes[t-1]; r.push(b>0&&a>0?Math.log(a/b):0);} 
 var h=hmmFit(r); if(!h) return null;
 var volatile=(h.state===h.volState), up=(h.curMu>=0);
 var label = volatile ? (up?'volatile-up':'volatile-down') : (up?'calm-up':'calm-down');
 return {label:label, volatile:volatile, up:up, pVol:h.pVol, muDaily:h.curMu, sdDaily:h.curVol, sdCalm:h.sd[h.calmState], sdVol:h.sd[h.volState]}; }
function renderRegime(container,sym,rg){ container.innerHTML='';
 if(!rg){ container.appendChild(elText('div','qvs-msg qvs-warn',TL('Мало данных для HMM','מעט נתונים','Too little data for HMM'))); return; }
 var col={'calm-up':'#43E39B','calm-down':'#4CC2FF','volatile-up':'#F5B23D','volatile-down':'#FF5F70'}[rg.label]||'#96A2C0';
 var lab={'calm-up':TL('спокойно, вверх','רגוע, עולה','calm, up'),'calm-down':TL('спокойно, вниз','רגוע, יורד','calm, down'),
  'volatile-up':TL('волатильно, вверх','תנודתי, עולה','volatile, up'),'volatile-down':TL('волатильно, вниз','תנודתי, יורד','volatile, down')}[rg.label];
 var hd=el('div'); hd.style.cssText='font-family:monospace;font-size:13px;font-weight:800;color:'+col+';padding:6px 4px;';
 hd.textContent=(sym?sym+' · ':'')+TL('режим HMM: ','משטר HMM: ','HMM regime: ')+lab.toUpperCase(); container.appendChild(hd);
 function line(k,v){ var row=el('div');row.style.cssText='display:flex;gap:8px;padding:4px;font-family:monospace;font-size:12px;border-bottom:1px solid '+GRID+';';
  var a=el('span');a.textContent=k;a.style.cssText='flex:1;color:'+PH+';';var b=el('span');b.textContent=v;b.style.cssText='color:'+INK+';';row.appendChild(a);row.appendChild(b);container.appendChild(row); }
 line(TL('P(волатильное)','P(תנודתי)','P(volatile)'), Math.round(rg.pVol*100)+'%');
 line(TL('вол. текущая / спок. / волат.','תנודתיות','vol now / calm / high'), (rg.sdDaily*100).toFixed(1)+'% / '+(rg.sdCalm*100).toFixed(1)+'% / '+(rg.sdVol*100).toFixed(1)+'%');
 line(TL('дрейф/день','דריפט','drift/day'), ((rg.muDaily*100>=0?'+':'')+(rg.muDaily*100).toFixed(2))+'%');
 container.appendChild(el('div','qvs-foot',TL('Скрытое состояние рынка (HMM). Волатильное → осторожнее с плечом. Не инвестсовет.','מצב שוק חבוי (HMM). אינו ייעוץ.','Hidden market state (HMM). Volatile → careful with leverage. Not advice.'))); }
/* ---------- Monte Carlo price-path simulation (block-bootstrap, martingale, seeded) ---------- */
function _mcRets(closes){var r=[],t;for(t=1;t<closes.length;t++){var a=closes[t],b=closes[t-1];if(b>0&&a>0)r.push(Math.log(a/b));}return r;}
function monteCarlo(closes,opts){opts=opts||{};
 var r=_mcRets(closes); if(r.length<60) return {ok:false};
 var H=opts.H||14, N=opts.N||5000, blk=opts.block||5, drift0=(opts.drift!=null?opts.drift:0);
 var n=r.length, mu=0,i,t; for(i=0;i<n;i++)mu+=r[i]; mu/=n;
 // center returns to enforce martingale (drift=0): remove the historical mean, add back optional drift
 var cr=new Array(n); for(i=0;i<n;i++)cr[i]=r[i]-mu+drift0;
 var rnd=opts.rnd||mul32((opts.seed|0)||0x51ED270B);
 var S0=closes[closes.length-1];
 var term=new Array(N), pathMin=new Array(N), pathMax=new Array(N);
 for(i=0;i<N;i++){
   var lr=0, mn=0, mx=0, j=0;
   while(j<H){                                   // stationary block bootstrap
     var start=Math.floor(rnd()*n), L=Math.min(blk, H-j);
     for(var k=0;k<L;k++){ lr+=cr[(start+k)%n]; if(lr<mn)mn=lr; if(lr>mx)mx=lr; j++; }
   }
   term[i]=lr; pathMin[i]=mn; pathMax[i]=mx;
 }
 term.sort(function(a,b){return a-b;});
 function pctl(a,qq){var srt=a===term?a:a.slice().sort(function(x,y){return x-y;});var h=(srt.length-1)*qq,lo=Math.floor(h);return srt[lo]+(srt[Math.min(lo+1,srt.length-1)]-srt[lo])*(h-lo);}
 function pxUp(x){var c=0;for(i=0;i<N;i++)if(term[i]>=Math.log(1+x))c++;return c/N;}       // P(terminal ≥ +x)
 function pStop(x){var c=0;for(i=0;i<N;i++)if(pathMin[i]<=Math.log(1-x))c++;return c/N;}    // P(path ever ≤ −x)
 var meanLr=0; for(i=0;i<N;i++)meanLr+=term[i]; meanLr/=N;
 var aL=1-(opts.conf||0.95), var5=pctl(term,aL), es=0,cnt=0;
 for(i=0;i<N;i++)if(term[i]<=var5){es+=term[i];cnt++;} es=cnt?es/cnt:var5;
 function toP(lr){return S0*Math.exp(lr);}
 return {ok:true,S0:S0,H:H,N:N,
   p:{p5:toP(pctl(term,.05)),p25:toP(pctl(term,.25)),p50:toP(pctl(term,.5)),p75:toP(pctl(term,.75)),p95:toP(pctl(term,.95))},
   mret:(Math.exp(meanLr)-1),
   pUp5:pxUp(0.05),pUp10:pxUp(0.10),pDn5:1-pxUp(-0.0499),pStop5:pStop(0.05),pStop10:pStop(0.10),
   VaR:(1-Math.exp(var5)),ES:(1-Math.exp(es)),
   band:{lo:toP(pctl(term,.05)),hi:toP(pctl(term,.95))}};}
function renderMC(container,sym,closes){container.innerHTML='';
 var m=monteCarlo(closes,{H:14,N:5000}); if(!m.ok){container.appendChild(elText('div','qvs-msg qvs-warn',TL('Мало данных (нужно ≥60 баров)','מעט נתונים','Too little data (need ≥60 bars)')));return;}
 container.appendChild(elText('div','qvs-msg',TL('Монте-Карло · ','מונטה קרלו · ','Monte Carlo · ')+sym+'  '+m.N+TL(' путей · H=','msl · H=',' paths · H=')+m.H+TL(' дн',' ימים',' d')));
 // percentile fan
 var svgW=300,svgH=90,lo=m.p.p5,hi=m.p.p95,rng=(hi-lo)||1;
 function X(v){return 6+(v-lo)/rng*(svgW-12);}
 var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+svgW+' '+svgH);svg.setAttribute('width','100%');
 function line(x1,y1,x2,y2,c,w){var l=document.createElementNS(ns,'line');l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',x2);l.setAttribute('y2',y2);l.setAttribute('stroke',c);l.setAttribute('stroke-width',w||1);svg.appendChild(l);}
 function box(x1,x2,c){var r=document.createElementNS(ns,'rect');r.setAttribute('x',x1);r.setAttribute('y',34);r.setAttribute('width',Math.max(1,x2-x1));r.setAttribute('height',22);r.setAttribute('fill',c);r.setAttribute('opacity','.5');svg.appendChild(r);}
 box(X(m.p.p5),X(m.p.p95),PANEL); box(X(m.p.p25),X(m.p.p75),PH);
 line(X(m.S0),18,X(m.S0),72,AM,1.5); line(X(m.p.p50),30,X(m.p.p50),60,INK,2);
 function lab(x,y,txt,c){var t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('font-size','8');t.setAttribute('fill',c||DIM);t.setAttribute('font-family','monospace');t.setAttribute('text-anchor','middle');t.textContent=txt;svg.appendChild(t);}
 lab(X(m.p.p5),30,m.p.p5.toFixed(1),DIM);lab(X(m.p.p95),30,m.p.p95.toFixed(1),DIM);lab(X(m.S0),14,'now '+m.S0.toFixed(1),AM);lab(X(m.p.p50),70,'med '+m.p.p50.toFixed(1),INK);
 var wrap=el('div');wrap.style.cssText='background:'+PANEL+';border:1px solid '+GRID+';border-radius:8px;padding:8px;margin:6px 0;';wrap.appendChild(svg);container.appendChild(wrap);
 function row(k,v,c){var d=el('div');d.style.cssText='display:flex;gap:8px;padding:4px;font-family:monospace;font-size:12px;border-bottom:1px solid '+GRID+';';var a=el('span');a.textContent=k;a.style.cssText='flex:1;color:'+PH+';';var b=el('span');b.textContent=v;b.style.cssText='color:'+(c||INK)+';';d.appendChild(a);d.appendChild(b);container.appendChild(d);}
 row(TL('Диапазон 90% (p5–p95)','טווח 90%','90% range (p5–p95)'),m.band.lo.toFixed(2)+' – '+m.band.hi.toFixed(2));
 row(TL('Ожид. ход','תזוזה צפויה','Expected move'),((m.mret*100>=0?'+':'')+(m.mret*100).toFixed(1))+'%',m.mret>=0?'#43E39B':'#FF5F70');
 row('P(≥+5% / ≥+10%)',Math.round(m.pUp5*100)+'% / '+Math.round(m.pUp10*100)+'%','#43E39B');
 row(TL('P(касание −5% / −10%)','P(נגיעה','P(touch −5% / −10%)'),Math.round(m.pStop5*100)+'% / '+Math.round(m.pStop10*100)+'%','#FF5F70');
 row('VaR / ES (95%)','−'+(m.VaR*100).toFixed(1)+'% / −'+(m.ES*100).toFixed(1)+'%','#F5B23D');
 try{ var fp=moveProbability(closes,{horizon:14,move:0.05});
  if(fp&&fp.ok){ var mcTouchUp=(function(){var mm=monteCarlo(closes,{H:14,N:5000,seed:0x51ED270B}); return null;})();
   var agree=Math.abs(m.pUp5*100 - fp.pUp)<=8;
   var d=el('div'); d.style.cssText='display:flex;gap:8px;padding:5px 4px;font-family:monospace;font-size:11px;border-top:1px solid '+GRID+';margin-top:4px;';
   var a=el('span'); a.style.cssText='flex:1;color:'+PH+';'; a.textContent=TL('Сверка с Fokker–Planck (P≥+5%)','מול Fokker–Planck','vs Fokker–Planck (P≥+5%)');
   var b=el('span'); b.textContent='MC '+Math.round(m.pUp5*100)+'% · FP '+Math.round(fp.pUp)+'%  '+(agree?'✓':'≈');
   b.style.cssText='color:'+(agree?'#43E39B':'#F5B23D')+';'; d.appendChild(a); d.appendChild(b); container.appendChild(d);
  } }catch(e){}
 container.appendChild(el('div','qvs-foot',TL('Block-bootstrap исторических тордоходностей, drift=0 (мартингейл): оценка РАЗБРОСА, не направления. Сверяйте с Fokker–Planck. Не инвестсовет.','אתחול-מקטע, drift=0. אינו ייעוץ.','Block-bootstrap of historical returns, drift=0 (martingale): a RANGE estimate, not direction. Cross-check with Fokker–Planck. Not advice.')));}

function T3(a){var r=a[LANG==="he"?1:LANG==="en"?2:0]||a[0]; try{ return root.QEX?root.QEX.tr(r,LANG):r; }catch(e){ return r; }}
var QVHELP=[
 {c:["Основы","יסודות","Basics"],t:["Что это","מה זה","What it is"],b:[
  "QUANT EDGE — аналитика акций на устройстве: волны Эллиота, Фибоначчи, индикаторы + статистический движок риска и вероятностей. Прогноз даётся только при подтверждении вне выборки; иначе — воздержание.",
  "QUANT EDGE — ניתוח מניות במכשיר: גלי אליוט, פיבונאצ׳י, אינדיקטורים + מנוע סטטיסטי לסיכון והסתברות. תחזית ניתנת רק כשהיא מאושרת מחוץ למדגם; אחרת — הימנעות.",
  "QUANT EDGE — on-device stock analytics: Elliott Waves, Fibonacci, indicators + a statistical risk/probability engine. A forecast is given only when confirmed out-of-sample; otherwise it abstains."]},
 {c:["Основы","יסודות","Basics"],t:["Уровни D / S / N","רמות D / S / N","D / S / N tiers"],b:[
  "D — есть направление (edge пережил проверку вне выборки): прогноз+интервал. S — только риск (структура в волатильности, не в направлении). N — нет структуры: движок воздерживается (законный ответ).",
  "D — יש כיוון (edge שרד מבחן מחוץ למדגם): תחזית+טווח. S — סיכון בלבד (מבנה בתנודתיות, לא בכיוון). N — אין מבנה: המנוע נמנע (תשובה לגיטימית).",
  "D — has direction (edge survived OOS): forecast+interval. S — risk only (structure in volatility, not direction). N — no structure: the engine abstains (a valid answer)."]},
 {c:["Основы","יסודות","Basics"],t:["Прогноз против кольца","תחזית מול הטבעת","Projection vs ring"],b:[
  "Прогноз (верх) = согласованность текущих сигналов. Кольцо = вероятностная оценка распределения цены. Расхождение — не ошибка, а сигнал «смешанно / повышенная неопределённость».",
  "תחזית (למעלה) = תיאום הסיגנלים הנוכחיים. הטבעת = הערכת התפלגות מחיר הסתברותית. פער אינו שגיאה אלא סימן ל״מעורב / אי-ודאות מוגברת״.",
  "Projection (top) = agreement of current signals. Ring = a probabilistic price-distribution estimate. Divergence is not an error but a 'mixed / raised uncertainty' signal."]},
 {c:["Графики","גרפים","Charts"],t:["Кольцо (циферблат)","הטבעת","The ring"],b:[
  "Центр — знаковый ожидаемый ход %; низ — P(рост); цвет (красный/зелёный) — сторона-фаворит. Это распределение, не цель на завтра.",
  "מרכז — תזוזה צפויה חתומה %; תחתית — P(עלייה); צבע (אדום/ירוק) — הצד המועדף. זו התפלגות, לא יעד למחר.",
  "Center — signed expected move %; bottom — P(rise); colour (red/green) — favoured side. A distribution, not a next-day target."]},
 {c:["Графики","גרפים","Charts"],t:["Коридор Боллинджера","רצועות בולינגר","Bollinger"],b:[
  "Голубые полосы = ±2σ вокруг средней (жёлтая). Ширина = волатильность. Даёт диапазон, не направление; касание полосы само по себе не разворот.",
  "רצועות כחולות = ±2σ סביב הממוצע (צהוב). רוחב = תנודתיות. נותן טווח, לא כיוון; נגיעה ברצועה אינה היפוך בפני עצמה.",
  "Blue bands = ±2σ around the mean (yellow). Width = volatility. Gives range, not direction; touching a band is not a reversal by itself."]},
 {c:["Графики","גרפים","Charts"],t:["Кривая распределения","עקומת התפלגות","Distribution curve"],b:[
  "Плотность вероятности цены на горизонт (Фоккер–Планк). Закрашенные хвосты = зоны движений ≥5%/≥10%. Площадь хвоста = вероятность, не гарантия уровня.",
  "צפיפות הסתברות של המחיר לאופק (Fokker–Planck). זנבות צבועים = אזורי תזוזה ≥5%/≥10%. שטח הזנב = הסתברות, לא הבטחת רמה.",
  "Probability density of price to the horizon (Fokker–Planck). Shaded tails = ≥5%/≥10% move zones. Tail area = probability, not a guaranteed level."]},
 {c:["Движки","מנועים","Engines"],t:["Discovery (есть ли структура)","Discovery (האם יש מבנה)","Discovery"],b:[
  "Строит предиктор, проверяет вне выборки (walk-forward) и перемешивает данные блоками ×200. Edge реален, если переживает перемешивание.",
  "בונה מנבא, בודק מחוץ למדגם (walk-forward) ומערבב בלוקים ×200. edge אמיתי אם שורד את הערבוב.",
  "Builds a predictor, tests out-of-sample (walk-forward) and shuffles data in blocks ×200. The edge is real if it survives the shuffle."]},
 {c:["Движки","מנועים","Engines"],t:["GPD/EVT + ES/VaR","GPD/EVT + ES/VaR","GPD/EVT + ES/VaR"],b:[
  "Хвост убытков моделируется обобщённым Парето (метод PWM). ES — средний убыток в худшем сценарии; VaR — его порог. Проверки: Acerbi–Székely, Kupiec, Christoffersen, PIT.",
  "זנב ההפסדים ממודל בפארטו מוכלל (PWM). ES — הפסד ממוצע בתרחיש הגרוע; VaR — הסף שלו. בדיקות: Acerbi–Székely, Kupiec, Christoffersen, PIT.",
  "The loss tail is modelled by a generalized Pareto (PWM). ES — average loss in the worst case; VaR — its threshold. Checks: Acerbi–Székely, Kupiec, Christoffersen, PIT."]},
 {c:["Движки","מנועים","Engines"],t:["Фоккер–Планк","Fokker–Planck","Fokker–Planck"],b:[
  "Решает уравнение эволюции плотности → распределение цены и P(≥5%/≥10% за 3/5/10 дн). Снос=0 (мартингейл — направление не угадывается).",
  "פותר את משוואת התפתחות הצפיפות → התפלגות מחיר ו-P(≥5%/≥10% ב-3/5/10 ימים). Drift=0 (מרטינגייל — הכיוון אינו מנוחש).",
  "Solves the density-evolution equation → price distribution and P(≥5%/≥10% over 3/5/10 d). Drift=0 (martingale — direction is not guessed)."]},
 {c:["Движки","מנועים","Engines"],t:["DSR — удача или умение","DSR — מזל או מיומנות","DSR — luck or skill"],b:[
  "Дефлированный Sharpe снижает результат на число проверенных акций и асимметрию. DSR≥0.95 = edge скорее реален. «Скан DSR» отсеивает случайных «звёзд».",
  "Sharpe מנוכה מוריד את התוצאה לפי מספר המניות שנבדקו והאסימטריה. DSR≥0.95 = edge כנראה אמיתי. «סריקת DSR» מסננת «כוכבים» אקראיים.",
  "The deflated Sharpe lowers the result by the number of stocks tested and by skew. DSR≥0.95 = the edge is likely real. 'DSR scan' filters random 'stars'."]},
 {c:["Движки","מנועים","Engines"],t:["PBO (оверфит отбора)","PBO (התאמת יתר בבחירה)","PBO (selection overfit)"],b:[
  "Комбинаторная кросс-валидация (CSCV): устойчив ли выбор лучшего кандидата вне выборки. PBO>50% = «риск оверфита выбора». Дополняет DSR.",
  "אימות צולב קומבינטורי (CSCV): האם בחירת המועמד הטוב יציבה מחוץ למדגם. PBO>50% = «סיכון התאמת יתר בבחירה». משלים את DSR.",
  "Combinatorial cross-validation (CSCV): is picking the best candidate robust out-of-sample. PBO>50% = 'selection overfit risk'. Complements DSR."]},
 {c:["Движки","מנועים","Engines"],t:["HMM — режим рынка","HMM — משטר שוק","HMM — market regime"],b:[
  "Скрытая марковская модель находит 2 состояния: спокойное и волатильное, и текущее с вероятностью. Волатильное → осторожнее с плечом.",
  "מודל מרקוב חבוי מוצא 2 מצבים: רגוע ותנודתי, ואת הנוכחי בהסתברות. תנודתי → זהירות עם מינוף.",
  "A hidden Markov model finds 2 states: calm and volatile, plus the current one with a probability. Volatile → careful with leverage."]},
 {c:["Движки","מנועים","Engines"],t:["Монте-Карло","מונטה קרלו","Monte Carlo"],b:[
  "Симуляция 5000 путей block-bootstrap из истории, drift=0. Даёт диапазон 90% (p5–p95), P(≥+5%), P(касание −5%), VaR/ES — и сверку с Fokker–Planck (✓). Это оценка разброса, не направления.",
  "סימולציה של 5000 מסלולים ב-block-bootstrap מההיסטוריה, drift=0. נותן טווח 90% (p5–p95), P(≥+5%), P(נגיעה −5%), VaR/ES — והצלבה מול Fokker–Planck (✓). הערכת פיזור, לא כיוון.",
  "Simulates 5000 block-bootstrap paths from history, drift=0. Gives the 90% range (p5–p95), P(≥+5%), P(touch −5%), VaR/ES — plus a Fokker–Planck cross-check (✓). A spread estimate, not direction."]},
 {c:["Движки","מנועים","Engines"],t:["Калибровка","כיול","Calibration"],b:[
  "Заявленные вероятности сверяются с реальной частотой (ECE/Brier). Коррекция (Platt/beta) применяется только если улучшает held-out; иначе прогноз не трогается.",
  "ההסתברויות המוצהרות מושוות לתדירות בפועל (ECE/Brier). תיקון (Platt/beta) מיושם רק אם משפר held-out; אחרת התחזית לא נוגעים.",
  "Stated probabilities are checked against real frequency (ECE/Brier). The correction (Platt/beta) applies only if it improves held-out; otherwise the forecast is untouched."]},
 {c:["Сканеры","סורקים","Scanners"],t:["MA200","MA200","MA200"],b:[
  "Находит акции у 200-дневной средней (±%). Тест поддержки + тренд↑ = сетап отскока; тест сопротивления + тренд↓ = риск пробоя.",
  "מוצא מניות ליד הממוצע ל-200 ימים (±%). מבחן תמיכה + מגמה↑ = היפוך למעלה; מבחן התנגדות + מגמה↓ = סיכון שבירה.",
  "Finds stocks at the 200-day average (±%). Support test + trend↑ = bounce setup; resistance test + trend↓ = breakdown risk."]},
 {c:["Сканеры","סורקים","Scanners"],t:["Пары (коинтеграция)","זוגות (קואינטגרציה)","Pairs (cointegration)"],b:[
  "Ищет коинтегрированные пары (ADF<−2.86). Вход при |z|≥2 (спред растянут), выход к z≈0; горизонт = half-life. Рыночно-нейтрально.",
  "מחפש זוגות מקואינטגרים (ADF<−2.86). כניסה ב-|z|≥2 (מרווח מתוח), יציאה ל-z≈0; אופק = half-life. ניטרלי לשוק.",
  "Finds cointegrated pairs (ADF<−2.86). Enter at |z|≥2 (stretched spread), exit toward z≈0; horizon = half-life. Market-neutral."]},
 {c:["Сканеры","סורקים","Scanners"],t:["Ширина рынка","רוחב שוק","Market breadth"],b:[
  "% акций над SMA200/SMA50 → режим: широкая сила / ухудшение / широкая слабость. Сильный индекс при узкой ширине = хрупкость.",
  "% מניות מעל SMA200/SMA50 → משטר: רוחב חזק / הידרדרות / חולשה רחבה. מדד חזק עם רוחב צר = שבריריות.",
  "% of stocks above SMA200/SMA50 → regime: broad strength / deteriorating / broad weakness. A strong index with narrow breadth = fragility."]},
 {c:["Сканеры","סורקים","Scanners"],t:["Угадывания (hit-rate)","ניחושים","Hit-rate"],b:[
  "% сбывшихся прогнозов по акции за окно (полгода), по горизонтам 2/4/7/14. Топ по угадываниям; прогноз-vs-факт; фильтр сканов по истории.",
  "% תחזיות שהתממשו למניה בחלון (חצי שנה), לפי אופקים 2/4/7/14. מובילים בניחוש; תחזית מול בפועל; סינון סריקות לפי היסטוריה.",
  "% of forecasts that came true per stock over a window (half a year), by horizons 2/4/7/14. Top by hit-rate; forecast-vs-actual; filter scans by history."]},
 {c:["Сканеры","סורקים","Scanners"],t:["План исполнения (A-C)","תוכנית ביצוע (A-C)","Execution (A-C)"],b:[
  "Almgren–Chriss: как дробить крупную позицию по дням. Ниже риск-аверсия → равномернее (TWAP); выше → раньше (фронт-лоад).",
  "Almgren–Chriss: איך לפצל פוזיציה גדולה לימים. פחות סלידת סיכון → אחיד יותר (TWAP); יותר → מוקדם (front-load).",
  "Almgren–Chriss: how to split a large position across days. Lower risk-aversion → more even (TWAP); higher → earlier (front-load)."]},
 {c:["Внешнее","חיצוני","External"],t:["TimesFM","TimesFM","TimesFM"],b:[
  "Внешняя foundation-модель прогноза (по URL в поле). Квантили → вероятности, ансамбль с Фоккером–Планком, гейт согласия направления. Весов в приложении нет.",
  "מודל foundation חיצוני לתחזית (לפי URL בשדה). קוונטילים → הסתברויות, אנסמבל עם Fokker–Planck, שער הסכמת כיוון. אין משקלים באפליקציה.",
  "External forecast foundation model (by URL in the field). Quantiles → probabilities, an ensemble with Fokker–Planck, a direction-agreement gate. No weights in the app."]},
 {c:["Данные","נתונים","Data"],t:["Релей и источники","ריליי ומקורות","Relay & sources"],b:[
  "Цены (Stooq) — напрямую. Yahoo/Finviz/новости/Wikipedia блокируют браузер (CORS) → нужен релей (Cloudflare Worker), адрес в Σ-панели. Без него часть источников недоступна.",
  "מחירים (Stooq) — ישירות. Yahoo/Finviz/חדשות/Wikipedia חוסמים דפדפן (CORS) → צריך ריליי (Cloudflare Worker), כתובת בפאנל Σ. בלעדיו חלק מהמקורות לא זמינים.",
  "Prices (Stooq) — direct. Yahoo/Finviz/news/Wikipedia block the browser (CORS) → you need a relay (Cloudflare Worker), URL in the Σ panel. Without it some sources are unavailable."]},
 {c:["Проблемы","תקלות","Troubleshoot"],t:["Нет данных / пустой скан","אין נתונים / סריקה ריקה","No data / empty scan"],b:[
  "Обычно релей не задеплоен или упал («CORS relay layer down»), прямой источник недоступен. Задайте релей в Σ; проверьте связь. Тяжёлые сканы фетчат много котировок.",
  "בד״כ הריליי לא פרוס או נפל («CORS relay layer down»), מקור ישיר לא זמין. הגדר ריליי ב-Σ; בדוק חיבור. סריקות כבדות מושכות הרבה ציטוטים.",
  "Usually the relay is not deployed or is down ('CORS relay layer down'), and the direct source is unreachable. Set the relay in Σ; check connectivity. Heavy scans fetch many quotes."]},
 {c:["Проблемы","תקלות","Troubleshoot"],t:["«Приложение не установлено»","«האפליקציה לא הותקנה»","'App not installed'"],b:[
  "Конфликт подписи с уже установленной версией. Удалите старую и поставьте заново, либо подпишите своим релиз-ключом.",
  "קונפליקט חתימה עם גרסה מותקנת. הסר את הישנה והתקן מחדש, או חתום במפתח שחרור משלך.",
  "Signature conflict with an installed version. Uninstall the old one and reinstall, or sign with your own release key."]},
{c:["Движки","מנועים","Engines"],t:["Спектр (частотный анализ)","ספקטרום (ניתוח תדר)","Spectrum (frequency analysis)"],b:[
  "Из теории Brüel & Kjær: цена как сигнал. Периодограмма (окно Ханна) ищет доминантный цикл; он засчитывается только если пик выше рефлекса шума (перестановка p<0.05) и спектр «тональный» (flatness<0.6). Крест-фактор=max|r|/RMS — импульсность хвостов (>4.5 = шоки). Полу-затухание шока — как быстро гаснет волатильность после скачка.",
  "מתורת Brüel & Kjær: מחיר כאות. פריאודוגרם (חלון Hanning) מחפש מחזור דומיננטי; הוא נספר רק אם השיא מעל רצפת הרעש (פרמוטציה p<0.05) והספקטרום «טונאלי» (flatness<0.6). Crest factor=max|r|/RMS — אימפולסיביות הזנבות (>4.5 = הלמים). חצי-דעיכת הלם — כמה מהר התנודתיות דועכת אחרי קפיצה.",
  "From Brüel & Kjær theory: price as a signal. A periodogram (Hanning window) seeks the dominant cycle; it counts only if the peak is above the noise floor (permutation p<0.05) and the spectrum is 'tonal' (flatness<0.6). Crest factor=max|r|/RMS — tail impulsiveness (>4.5 = shocks). Shock half-decay — how fast volatility fades after a jump."]},
 {c:["Движки","מנועים","Engines"],t:["Фаза цикла (Гильберт)","פאזת מחזור (הילברט)","Cycle phase (Hilbert)"],b:[
  "Глубокая теория волн: аналитический сигнал Гильберта z=x+iH[x] даёт мгновенную фазу цикла. Периодограмма говорит ЕСТЬ ли цикл; фаза говорит ГДЕ мы в нём (0–360°) → прогноз следующего разворота (вершина/дно) в днях. Включается только при значимом цикле; на нестационарных данных фаза дрейфует.",
  "תורת גלים עמוקה: אות אנליטי של הילברט z=x+iH[x] נותן פאזה רגעית של המחזור. הפריאודוגרם אומר אם יש מחזור; הפאזה אומרת איפה אנחנו בו (0–360°) → תחזית ההיפוך הבא (שיא/שפל) בימים. נדלק רק במחזור מובהק; בנתונים לא-נייחים הפאזה נודדת.",
  "Deep wave theory: the Hilbert analytic signal z=x+iH[x] gives the cycle's instantaneous phase. The periodogram says IF a cycle exists; the phase says WHERE we are in it (0–360°) → a forecast of the next turn (top/bottom) in days. Engages only for a significant cycle; on non-stationary data the phase drifts."]},
 {c:["Стратегии","אסטרטגיות","Strategies"],t:["Fib 61.8% + Pinbar (Monxaiding №1)","Fib 61.8% + Pinbar","Fib 61.8% + Pinbar (Monxaiding #1)"],b:[
  "Стратегия из видео Monxaiding: не усложнять, 4H — контекст, 15M — вход. Тянем Фибоначчи от минимума до максимума импульса; ждём откат в «золотую зону» 61.8% (50–66%); там должен сформироваться бычий Pinbar (длинная нижняя тень ≥2× тела), затем — зелёная свеча, закрывающаяся выше Pinbar. Вход на закрытии этой зелёной свечи, стоп под Pinbar, цель — максимум импульса. Кнопка «Стратегия Fib+Pinbar» проверяет тикер, «Скан» ищет сетапы по юниверсу (свежие — вперёд). Честный гейт: сигнал только когда все условия выполнены.",
  "אסטרטגיית Monxaiding: פיבונאצ׳י מהמינימום למקסימום, נסיגה לאזור 61.8%, Pinbar שורי + נר ירוק = כניסה. סטופ מתחת ל-Pinbar, יעד — שיא האימפולס. אינו ייעוץ.",
  "The Monxaiding video strategy: keep it simple — 4H context, 15M entry. Draw Fibonacci from the impulse min→max; wait for a pullback into the 61.8% golden zone (50–66%); a bullish Pinbar must form there (lower wick ≥2× body), then a green candle that closes above the Pinbar. Enter on that green candle's close, stop below the Pinbar, target the impulse high. The 'Fib+Pinbar strategy' button checks one ticker; 'Scan' finds setups across the universe (fresh first). Honesty gate: a signal appears only when every condition is met. Not advice."]},
 {c:["Сканеры","סורקים","Scanners"],t:["Волновой фильтр (по всем сканам)","מסנן גל (בכל הסריקות)","Wave filter (all scans)"],b:[
  "Кнопка «Волновой скан» прогоняет весь юниверс + список слежения через спектр+Гильберт и кэширует значимые циклы. Галочка «волн. фильтр» затем применяется ко ВСЕМ сканам (MA200, DSR, пары): скрывает бумаги без значимого цикла и ранжирует по близости к дну (тайминг покупки), верх — потом. Нескан­ированные не отбрасываются. Каждый цикл проходит тот же гейт значимости (перестановка p<0.05, flatness<0.6) — шум не ранжируется.",
  "כפתור «סריקת גל» מריץ את כל היקום + רשימת מעקב דרך ספקטרום+הילברט ושומר מחזורים מובהקים. תיבת «מסנן גל» מיושמת אז על כל הסריקות (MA200, DSR, זוגות): מסתיר ניירות בלי מחזור מובהק ומדרג לפי קרבה לשפל (תזמון קנייה), שיא — אחר כך. מה שלא נסרק אינו נזרק. כל מחזור עובר את אותו שער מובהקות (פרמוטציה p<0.05, flatness<0.6) — רעש לא מדורג.",
  "The 'Wave scan' button runs the whole universe + watchlist through spectrum+Hilbert and caches the significant cycles. The 'wave filter' checkbox then applies to ALL scans (MA200, DSR, pairs): it hides names with no significant cycle and ranks by nearness to a bottom (buy timing), tops later. Un-scanned names are not dropped. Every cycle passes the same significance gate (permutation p<0.05, flatness<0.6) — noise is never ranked."]},
  {c:["Честность","יושרה","Honesty"],t:["Границы и дисклеймер","גבולות והבהרה","Limits & disclaimer"],b:[
  "Образовательный инструмент теханализа, НЕ инвестиционный совет. Ошибка выжившего; снимок во времени; дневной горизонт (не HFT). Всегда проверяйте сами.",
  "כלי חינוכי לניתוח טכני, לא ייעוץ השקעה. הטיית השורדים; צילום נקודתי; אופק יומי (לא HFT). תמיד בדוק בעצמך.",
  "An educational technical-analysis tool, NOT financial advice. Survivorship bias; point-in-time snapshot; daily horizon (not HFT). Always verify yourself."]}
];
function _qvHelpOverlay(){ if(document.getElementById('qvHelpOv')) return document.getElementById('qvHelpOv');
 var ov=el('div'); ov.id='qvHelpOv';
 ov.style.cssText='position:fixed;inset:0;z-index:2147483600;background:'+BG+';display:none;flex-direction:column;';
 var hd=el('div'); hd.style.cssText='display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid '+GRID+';';
 var ttl=el('div'); ttl.innerHTML='📖 '+TL('Помощь','עזרה','Help'); ttl.style.cssText='font-family:monospace;font-weight:800;color:'+PH+';font-size:15px;flex:1;';
 var xb=el('button','',''); xb.textContent='✕'; xb.style.cssText='background:none;border:1px solid '+GRID+';color:'+INK+';border-radius:8px;width:32px;height:32px;font-size:15px;cursor:pointer;';
 xb.addEventListener('click',function(){ ov.style.display='none'; });
 hd.appendChild(ttl); hd.appendChild(xb); ov.appendChild(hd);
 var sb=document.createElement('input'); sb.type='text'; sb.placeholder=TL('Поиск по справке…','חיפוש בעזרה…','Search help…');
 sb.style.cssText='margin:10px 14px;padding:9px 12px;background:'+PANEL+';color:'+INK+';border:1px solid '+GRID+';border-radius:9px;font-size:14px;';
 ov.appendChild(sb);
 var list=el('div'); list.style.cssText='flex:1;overflow-y:auto;padding:0 10px 16px;'; ov.appendChild(list);
 var cp=el('div'); cp.textContent='© 2026 Daniel Saricov · All rights reserved'; cp.style.cssText='font-family:monospace;font-size:8.5px;color:'+DIM+';text-align:center;padding:6px;border-top:1px solid '+GRID+';'; ov.appendChild(cp);
 function render(q){ list.innerHTML=''; q=(q||'').trim().toLowerCase(); var cats={},order=[];
  QVHELP.forEach(function(it){ var title=T3(it.t),body=T3(it.b),cat=T3(it.c);
   var hay=(title+' '+body+' '+it.t.join(' ')+' '+it.b.join(' ')).toLowerCase();
   if(q && hay.indexOf(q)<0) return;
   if(!cats[cat]){cats[cat]=[];order.push(cat);} cats[cat].push({title:title,body:body}); });
  if(!order.length){ list.appendChild(elText('div','',TL('Ничего не найдено','לא נמצא','Nothing found'))); list.lastChild.style.cssText='color:'+DIM+';text-align:center;padding:20px;font-family:monospace;'; return; }
  order.forEach(function(cat){ var ch=el('div'); ch.textContent=cat; ch.style.cssText='color:'+DIM+';font-family:monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin:12px 6px 4px;'; list.appendChild(ch);
   cats[cat].forEach(function(tp){ var card=el('div'); card.style.cssText='background:'+PANEL+';border:1px solid '+GRID+';border-radius:10px;margin:5px 0;overflow:hidden;';
    var h=el('div'); h.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:10px 12px;cursor:pointer;';
    var tt=el('span'); tt.textContent=tp.title; tt.style.cssText='color:'+INK+';font-weight:700;font-size:13.5px;';
    var ar=el('span'); ar.textContent=q?'−':'+'; ar.style.cssText='color:'+PH+';font-family:monospace;';
    h.appendChild(tt); h.appendChild(ar);
    var bd=el('div'); bd.textContent=tp.body; bd.style.cssText='padding:0 12px 11px;color:'+INK+';font-size:12.5px;line-height:1.55;display:'+(q?'block':'none')+';';
    h.addEventListener('click',function(){ var open=bd.style.display==='block'; bd.style.display=open?'none':'block'; ar.textContent=open?'+':'−'; });
    card.appendChild(h); card.appendChild(bd); list.appendChild(card); }); });
 }
 sb.addEventListener('input',function(){ render(sb.value); });
 render(''); try{document.body.appendChild(ov);}catch(e){} return ov; }
/* ---------- Spectral / vibration engine (B&K frequency analysis, adapted) ---------- */
function _specRets(c){var r=[],t;for(t=1;t<c.length;t++){var a=c[t],b=c[t-1];if(b>0&&a>0)r.push(Math.log(a/b));}return r;}
function _dft(x){ // real -> periodogram P[k], k=1..N/2 (Hanning-windowed)
 var N=x.length,i,k,m=0; for(i=0;i<N;i++)m+=x[i]; m/=N;
 var w=new Array(N),sw2=0; for(i=0;i<N;i++){var win=0.5*(1-Math.cos(2*Math.PI*i/(N-1)));w[i]=(x[i]-m)*win;sw2+=win*win;}
 var K=Math.floor(N/2),P=new Array(K);
 for(k=1;k<=K;k++){var re=0,im=0,a=2*Math.PI*k/N;for(i=0;i<N;i++){re+=w[i]*Math.cos(a*i);im-=w[i]*Math.sin(a*i);}
  P[k-1]=2*(re*re+im*im)/(sw2||1);}
 return {P:P,K:K,N:N}; }
function _rms(r){var n=r.length,s=0,i;for(i=0;i<n;i++)s+=r[i]*r[i];return Math.sqrt(s/n);}
function _crest(r){var mx=0,i;for(i=0;i<r.length;i++)if(Math.abs(r[i])>mx)mx=Math.abs(r[i]);var rms=_rms(r);return rms>0?mx/rms:0;}
function _flatness(P){var n=P.length,i,ls=0,as_=0,c=0;for(i=0;i<n;i++){if(P[i]>1e-300){ls+=Math.log(P[i]);as_+=P[i];c++;}}if(!c)return 1;var gm=Math.exp(ls/c),am=as_/c;return am>0?gm/am:1;}
function spectrum(closes,opts){opts=opts||{}; var r=_specRets(closes); if(r.length<64) return {ok:false};
 var minT=opts.minT||4, maxT=opts.maxT||Math.floor(r.length/3), B=opts.B||200;
 var d=_dft(r),P=d.P,N=d.N;
 // dominant peak within [minT,maxT]
 var best=-1,bestP=0,k; for(k=0;k<P.length;k++){var T=N/(k+1); if(T<minT||T>maxT)continue; if(P[k]>bestP){bestP=P[k];best=k;}}
 if(best<0) return {ok:false};
 var domT=N/(best+1);
 // permutation null: shuffle returns, record max peak in band
 var rnd=opts.rnd||mul32(0x5F356495), ge=0, b, i;
 for(b=0;b<B;b++){ var sh=r.slice(); for(i=sh.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1));var tmp=sh[i];sh[i]=sh[j];sh[j]=tmp;}
  var ds=_dft(sh),mx=0; for(k=0;k<ds.P.length;k++){var TT=ds.N/(k+1);if(TT<minT||TT>maxT)continue;if(ds.P[k]>mx)mx=ds.P[k];}
  if(mx>=bestP)ge++; }
 var pval=(ge+1)/(B+1);
 var meanP=0;for(k=0;k<P.length;k++)meanP+=P[k];meanP/=P.length;
 var snr=meanP>0?bestP/meanP:0, flat=_flatness(P);
 return {ok:true, period:domT, peak:bestP, snr:snr, flatness:flat, pval:pval,
   significant:(pval<0.05 && flat<0.6), crest:_crest(r), rms:_rms(r)*100, N:N}; }
function shockDecay(closes,opts){opts=opts||{}; var r=_specRets(closes); if(r.length<40) return null;
 // find largest |return| (shock), fit |r_{t+k}| ~ A*exp(-zeta*k) over K days after
 var n=r.length,si=0,mx=0,i; for(i=0;i<n;i++)if(Math.abs(r[i])>mx){mx=Math.abs(r[i]);si=i;}
 var K=Math.min(opts.K||10, n-si-1); if(K<4) return null;
 var xs=[],ys=[]; for(i=1;i<=K;i++){var a=Math.abs(r[si+i]);if(a>1e-6){xs.push(i);ys.push(Math.log(a));}}
 if(xs.length<4) return null;
 var m=xs.length,sx=0,sy=0,sxx=0,sxy=0; for(i=0;i<m;i++){sx+=xs[i];sy+=ys[i];sxx+=xs[i]*xs[i];sxy+=xs[i]*ys[i];}
 var slope=(m*sxy-sx*sy)/((m*sxx-sx*sx)||1); var zeta=-slope; // decay rate per day
 var halfLife=zeta>0?Math.log(2)/zeta:Infinity;
 return {zeta:zeta, halfLife:halfLife, shockMag:mx*100, shockAgo:n-si}; }
function renderSpectrum(container,sym,closes){container.innerHTML='';
 var sp=spectrum(closes); if(!sp||!sp.ok){container.appendChild(elText('div','qvs-msg qvs-warn',TL('Мало данных (нужно ≥64 бара)','מעט נתונים','Too little data (need ≥64 bars)')));return;}
 container.appendChild(elText('div','qvs-msg',TL('Спектр · ','ספקטרום · ','Spectrum · ')+sym));
 function row(k,v,c){var d=el('div');d.style.cssText='display:flex;gap:8px;padding:5px 4px;font-family:monospace;font-size:12px;border-bottom:1px solid '+GRID+';';var a=el('span');a.textContent=k;a.style.cssText='flex:1;color:'+PH+';';var b=el('span');b.textContent=v;b.style.cssText='color:'+(c||INK)+';';d.appendChild(a);d.appendChild(b);container.appendChild(d);}
 if(sp.significant){ row(TL('Доминантный цикл','מחזור דומיננטי','Dominant cycle'),'~'+Math.round(sp.period)+TL(' дн',' ימים',' d'),'#43E39B');
   row(TL('Значимость (перест.)','מובהקות','Significance (perm)'),'p='+sp.pval.toFixed(3)+' ✓','#43E39B'); }
 else { row(TL('Цикл','מחזור','Cycle'),TL('не значим (шум)','לא מובהק (רעש)','not significant (noise)'),'#F5B23D');
   row('p','='+sp.pval.toFixed(3),'#F5B23D'); }
 row('SNR',sp.snr.toFixed(1)+'×');
 row(TL('Спектр. плоскость','שטיחות ספקטרלית','Spectral flatness'),sp.flatness.toFixed(2)+(sp.flatness<0.6?' '+TL('(тональ)','(טונאלי)','(tonal)'):' '+TL('(шум)','(רעש)','(noise)')));
 row(TL('Крест-фактор','Crest factor','Crest factor'),sp.crest.toFixed(2)+(sp.crest>4.5?' '+TL('⚠ импульсно','⚠ אימפולסיבי','⚠ impulsive'):''),sp.crest>4.5?'#F5B23D':INK);
 row('RMS σ',sp.rms.toFixed(2)+'%/'+TL('день','יום','d'));
 var sd=shockDecay(closes); if(sd&&isFinite(sd.halfLife)){ row(TL('Дни после шока','ימים אחרי הלם','Days since shock'),sd.shockAgo+' ('+sd.shockMag.toFixed(1)+'%)');
   row(TL('Полу-затухание шока','חצי-דעיכת הלם','Shock half-decay'),Math.round(sd.halfLife)+TL(' дн',' ימים',' d')); }
 container.appendChild(el('div','qvs-foot',TL('Частотный анализ (Brüel & Kjær, адаптир.): цикл засчитан только выше рефлекса шума. Крест-фактор>4.5 = импульсные хвосты. Не инвестсовет.','ניתוח תדר (B&K). אינו ייעוץ.','Frequency analysis (Brüel & Kjær, adapted): a cycle counts only above the noise floor. Crest factor>4.5 = impulsive tails. Not advice.')));}
/* ---------- Deep wave theory: analytic signal (Hilbert), instantaneous phase/frequency ---------- */
function _cdft(re,im){var N=re.length,Re=new Array(N),Im=new Array(N),k,n;
 for(k=0;k<N;k++){var sr=0,si=0,a=-2*Math.PI*k/N;for(n=0;n<N;n++){var c=Math.cos(a*n),s2=Math.sin(a*n);sr+=re[n]*c-im[n]*s2;si+=re[n]*s2+im[n]*c;}Re[k]=sr;Im[k]=si;}
 return [Re,Im];}
function _cidft(re,im){var N=re.length,Re=new Array(N),Im=new Array(N),k,n;
 for(n=0;n<N;n++){var sr=0,si=0,a=2*Math.PI*n/N;for(k=0;k<N;k++){var c=Math.cos(a*k),s2=Math.sin(a*k);sr+=re[k]*c-im[k]*s2;si+=re[k]*s2+im[k]*c;}Re[n]=sr/N;Im[n]=si/N;}
 return [Re,Im];}
function _analytic(x){ // returns [reZ, imZ] analytic signal (Marple FFT method)
 var N=x.length,zi=new Array(N).fill(0);
 var F=_cdft(x.slice(),zi), Re=F[0],Im=F[1],k;
 var H=new Array(N); for(k=0;k<N;k++){ if(k===0||(N%2===0&&k===N/2))H[k]=1; else if(k<N/2)H[k]=2; else H[k]=0; }
 for(k=0;k<N;k++){ Re[k]*=H[k]; Im[k]*=H[k]; }
 return _cidft(Re,Im); }
function _sma(a,n){var out=[],i,j;for(i=0;i<a.length;i++){if(i<n-1){out.push(null);continue;}var s=0;for(j=0;j<n;j++)s+=a[i-j];out.push(s/n);}return out;}
function hilbertPhase(closes,opts){opts=opts||{};
 if(!closes||closes.length<80) return null;
 var sp=(opts.spec||spectrum(closes,{B:opts.B||150}));
 if(!sp||!sp.ok) return {ok:false};
 var T=Math.max(4,Math.round(sp.period));
 // detrend log-price by SMA(1.5T) to isolate the cycle band, drop leading nulls
 var lp=closes.map(function(v){return Math.log(v);});
 var win=Math.max(3,Math.round(1.5*T)), ma=_sma(lp,win), x=[],i;
 for(i=0;i<lp.length;i++){ if(ma[i]!=null) x.push(lp[i]-ma[i]); }
 // taper tail to reduce edge effect (use last ~4 cycles for stable analytic signal)
 var keep=Math.min(x.length, Math.max(4*T, 80)); x=x.slice(x.length-keep);
 if(x.length<3*T) return {ok:false,significant:sp.significant,period:T};
 var Z=_analytic(x), reZ=Z[0], imZ=Z[1], n=x.length-1;
 var amp=Math.sqrt(reZ[n]*reZ[n]+imZ[n]*imZ[n]);
 var phase=Math.atan2(imZ[n],reZ[n]);            // radians, cos-phase: top at phase=0
 // instantaneous frequency from last phase diff
 var ph1=Math.atan2(imZ[n-1],reZ[n-1]); var dph=phase-ph1; while(dph>Math.PI)dph-=2*Math.PI; while(dph<-Math.PI)dph+=2*Math.PI;
 var instT=(dph!==0)?Math.abs(2*Math.PI/dph):T;
 // phase clock: x≈amp·cos(phase). Top (cos=1) at phase=0; trough at phase=±π.
 // days to next top = fraction of cycle from current phase forward to phase=0 (2π)
 function frac(target){var d=target-phase; d=((d%(2*Math.PI))+2*Math.PI)%(2*Math.PI); if(d<1e-9)d=2*Math.PI; return d/(2*Math.PI);}
 var toTop=frac(2*Math.PI)*T, toBot=frac(Math.PI)*T;
 var next = toTop<toBot ? {kind:'top',days:toTop} : {kind:'bottom',days:toBot};
 return {ok:true, significant:sp.significant, period:T, instPeriod:instT,
   phaseDeg:phase*180/Math.PI, amp:amp, toTop:toTop, toBot:toBot, next:next, pval:sp.pval, flatness:sp.flatness}; }
function renderHilbert(container,sym,closes){container.innerHTML='';
 var h=hilbertPhase(closes); if(!h){container.appendChild(elText('div','qvs-msg qvs-warn',TL('Мало данных (нужно ≥80 баров)','מעט נתונים','Too little data (need ≥80 bars)')));return;}
 container.appendChild(elText('div','qvs-msg',TL('Фаза цикла (Гильберт) · ','פאזת מחזור (הילברט) · ','Cycle phase (Hilbert) · ')+sym));
 if(!h.ok||!h.significant){ container.appendChild(elText('div','qvs-msg qvs-warn',TL('Значимого цикла нет — фаза недостоверна (p=','אין מחזור מובהק — פאזה לא אמינה (p=','No significant cycle — phase unreliable (p=')+(h.pval!=null?h.pval.toFixed(3):'?')+')'));
   container.appendChild(el('div','qvs-foot',TL('Часы фазы включаются только при значимом цикле (защита от шума).','שעון הפאזה נדלק רק במחזור מובהק.','The phase clock engages only for a significant cycle (noise guard).'))); return; }
 function row(k,v,c){var d=el('div');d.style.cssText='display:flex;gap:8px;padding:5px 4px;font-family:monospace;font-size:12px;border-bottom:1px solid '+GRID+';';var a=el('span');a.textContent=k;a.style.cssText='flex:1;color:'+PH+';';var b=el('span');b.textContent=v;b.style.cssText='color:'+(c||INK)+';';d.appendChild(a);d.appendChild(b);container.appendChild(d);}
 row(TL('Период цикла','מחזור','Cycle period'),'~'+h.period+TL(' дн',' ימים',' d')+' (инст. '+Math.round(h.instPeriod)+')');
 row(TL('Текущая фаза','פאזה נוכחית','Current phase'),Math.round(h.phaseDeg)+'°');
 var nk=h.next.kind==='top'?TL('вершина','שיא','top'):TL('дно','שפל','bottom');
 row(TL('Следующий разворот','ההיפוך הבא','Next turn'),nk+' ~'+Math.round(h.next.days)+TL(' дн',' ימים',' d'),h.next.kind==='top'?'#FF5F70':'#43E39B');
 row(TL('До вершины / до дна','לשיא / לשפל','To top / to bottom'),Math.round(h.toTop)+' / '+Math.round(h.toBot)+TL(' дн',' ימים',' d'));
 row(TL('Амплитуда цикла','משרעת','Cycle amplitude'),(h.amp*100).toFixed(2)+'% '+TL('лог','log','log'));
 container.appendChild(el('div','qvs-foot',TL('Аналитический сигнал Гильберта превращает цикл в «часы»: фаза → следующий разворот. Только при значимом цикле; на нестационарных данных фаза дрейфует. Не инвестсовет.','אות אנליטי הופך מחזור ל״שעון״. אינו ייעוץ.','The Hilbert analytic signal turns a cycle into a clock: phase → next turn. Only for a significant cycle; on non-stationary data the phase drifts. Not advice.')));}
/* ---------- Wave analysis applied across searches (cycle + phase timing) ---------- */
var _waveCache={};
function _waveOf(sym){ return _waveCache[(sym||'').toUpperCase()]||null; }
function waveOne(sym,closes){ try{ var sp=spectrum(closes,{B:120}); if(!sp||!sp.ok) return null;
  var h=hilbertPhase(closes,{spec:sp,B:120}); var rec={sym:(sym||'').toUpperCase(),period:sp.period,significant:sp.significant,
   crest:sp.crest, flatness:sp.flatness,
   nextKind:(h&&h.ok&&h.significant)?h.next.kind:null, nextDays:(h&&h.ok&&h.significant)?h.next.days:null,
   phaseDeg:(h&&h.ok)?h.phaseDeg:null };
  _waveCache[rec.sym]=rec; return rec; }catch(e){ return null; } }
async function waveScan(opts,onProg){ opts=opts||{}; var uni=MA200_UNIVERSE.slice();
 try{var w=JSON.parse(localStorage.getItem('qe_watchlist')||'[]');if(Array.isArray(w))w.forEach(function(x){var t=(''+((x&&x.ticker)||x)).trim().toUpperCase();if(t&&uni.indexOf(t)<0)uni.push(t);});}catch(e){}
 var out=[],done=0,i=0,B=4;
 async function one(sym){try{var c=await fetchCloses(sym);if(c&&c.length>=80){var r=waveOne(sym,c);if(r&&r.significant)out.push(r);}}catch(e){}finally{done++;if(onProg)try{onProg(done,uni.length,out.length);}catch(_){}}}
 while(i<uni.length){var b=uni.slice(i,i+B);i+=B;await Promise.all(b.map(one));}
 // rank: significant cycle nearest to a BOTTOM first (timing to buy), then nearest top (caution)
 out.sort(function(a,b){ var ka=(a.nextKind==='bottom'?0:1), kb=(b.nextKind==='bottom'?0:1); if(ka!==kb)return ka-kb; return (a.nextDays||99)-(b.nextDays||99); });
 return {items:out,scanned:uni.length,found:out.length}; }
var _waveState={on:false};
function _waveWrap(items){ if(!items)return items;
 items.forEach(function(it){ var sym=(it.sym||it.ticker||it.a||''); var w=_waveOf(sym); it._wave=w; });
 if(!_waveState.on) return items;
 // keep items whose cached wave is significant, or unknown (not yet scanned); drop known-insignificant
 var filt=items.filter(function(it){ return !it._wave || it._wave.significant; });
 // among significant, sort by nearest bottom
 filt.sort(function(a,b){ var wa=a._wave,wb=b._wave; if(!wa&&!wb)return 0; if(!wa)return 1; if(!wb)return -1;
   var ka=(wa.nextKind==='bottom'?0:1),kb=(wb.nextKind==='bottom'?0:1); if(ka!==kb)return ka-kb; return (wa.nextDays||99)-(wb.nextDays||99); });
 return filt; }
function _waveTag(sym){ var w=_waveOf(sym); if(!w||!w.significant) return ''; var k=w.nextKind==='bottom'?TL('дно','שפל','bot'):TL('верш','שיא','top');
 return ' · ~'+Math.round(w.period)+'d '+k+' '+Math.round(w.nextDays)+'d'; }
function renderWave(container,r){container.innerHTML='';
 if(!r.items.length){container.appendChild(elText('div','qvs-msg',TL('Значимых циклов не найдено. Скан ','לא נמצאו מחזורים. נסרק ','No significant cycles. scanned ')+r.scanned));return;}
 container.appendChild(elText('div','qvs-msg',TL('Волновой скан: значимых циклов ','סריקת גל: מחזורים ','Wave scan: significant cycles ')+r.found+'/'+r.scanned));
 r.items.forEach(function(it){ var col=it.nextKind==='bottom'?'#43E39B':'#FF5F70';
  var row=el('div');row.style.cssText='display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid '+GRID+';font-family:monospace;font-size:12px;';
  var sy=el('b');sy.textContent=it.sym;sy.style.cssText='min-width:64px;color:'+INK+';cursor:pointer;';sy.addEventListener('click',function(){ if(QVStructure&&QVStructure.open)QVStructure.open(it.sym); });
  var meta=el('span');meta.style.cssText='flex:1;color:'+PH+';';meta.textContent='~'+Math.round(it.period)+TL('дн цикл',' ימים',' d cyc')+' · '+Math.round(it.phaseDeg)+'°'+(it.crest>4.5?' ⚠':'');
  var tag=el('span');tag.textContent=(it.nextKind==='bottom'?TL('дно','שפל','bottom'):TL('верш.','שיא','top'))+' '+Math.round(it.nextDays)+'d';tag.style.cssText='color:'+col+';min-width:64px;text-align:right;';
  row.appendChild(sy);row.appendChild(meta);row.appendChild(tag);container.appendChild(row); });
 container.appendChild(el('div','qvs-foot',TL('Циклы Гильберта по юниверсу: приоритет — значимый цикл у дна (тайминг покупки). ⚠=импульсные хвосты. Тап=разбор. Не инвестсовет.','מחזורי הילברט. אינו ייעוץ.','Hilbert cycles across the universe: priority is a significant cycle near a bottom (buy timing). ⚠=impulsive tails. Tap=analyze. Not advice.')));}
/* ---------- Strategy: Fib 61.8% + bullish Pinbar (Monxaiding «Эксклюзивная №1») ----------
   Faithful to the video: draw Fibonacci from the impulse min→max; price pulls back into the
   golden zone (~50–66%, around 61.8%); a BULLISH PINBAR forms there; then a GREEN candle
   closes above the pinbar → buy on that green candle's close, stop below the pinbar, target
   the impulse high. Honesty gate: a signal is returned ONLY when every condition is met. */
function fibPinbar(bars,opts){ opts=opts||{};
  if(!bars||bars.length<20) return {ok:false,reason:'few bars'};
  var W=Math.min(opts.window||60,bars.length), b=bars.slice(bars.length-W), n=b.length, i;
  // 1) impulse up-move: lowest low, then the highest high AFTER it
  var loI=0; for(i=1;i<n;i++){ if(b[i].l<b[loI].l) loI=i; }
  var hiI=loI; for(i=loI+1;i<n;i++){ if(b[i].h>b[hiI].h) hiI=i; }
  if(hiI<=loI) return {ok:true,signal:false,reason:'no up-impulse'};
  var lo=b[loI].l, hi=b[hiI].h, range=hi-lo;
  if(!(range>0)) return {ok:true,signal:false,reason:'flat'};
  var movePct=range/lo*100, minMove=(opts.minMove!=null?opts.minMove:4);
  if(movePct<minMove) return {ok:true,signal:false,reason:'impulse '+movePct.toFixed(1)+'% < '+minMove+'%'};
  // 2) golden retracement zone (50%..66%, centred on 61.8)
  var lvl618=hi-0.618*range, zHi=hi-0.50*range, zLo=hi-0.66*range;
  // 3) after the high, a bullish pinbar tagging the zone, then a green confirmation candle
  var best=null;
  for(i=hiI+1;i<n-1;i++){
    var p=b[i], body=Math.abs(p.c-p.o), rng=p.h-p.l; if(!(rng>0)) continue;
    var lowW=Math.min(p.o,p.c)-p.l, upW=p.h-Math.max(p.o,p.c);
    var isPin = lowW>=2*body && lowW>=0.5*rng && upW<=body*1.2 && Math.max(p.o,p.c)>=p.l+0.6*rng;
    var tapsZone = (p.l<=zHi && p.l>=zLo-0.15*range);   // wick reaches into/just below the golden zone
    if(!(isPin&&tapsZone)) continue;
    var q=b[i+1];
    if(q.c>q.o && q.c>p.h){ best={pinI:i,confI:i+1,entry:q.c,stop:Math.min(p.l,q.l),pinLow:p.l}; }  // green candle closes above pinbar
  }
  if(!best) return {ok:true,signal:false,lo:lo,hi:hi,lvl618:lvl618,zone:[zLo,zHi],movePct:movePct,reason:'no pinbar+green confirm in golden zone'};
  var entry=best.entry, stop=best.stop, target=hi, risk=entry-stop;
  var rr=(risk>0)?(target-entry)/risk:0, barsAgo=(n-1)-best.confI;
  return {ok:true,signal:true,lo:lo,hi:hi,lvl618:lvl618,zone:[zLo,zHi],movePct:movePct,
    entry:entry,stop:stop,target:target,rr:rr,pinLow:best.pinLow,barsAgo:barsAgo,
    fresh:(barsAgo<=(opts.fresh!=null?opts.fresh:3))}; }
function renderFibPinbar(container,sym,bars){ container.innerHTML='';
  var r=fibPinbar(bars);
  if(!r||!r.ok){ container.appendChild(elText('div','qvs-msg qvs-warn',TL('Мало данных (нужно ≥20 баров)','מעט נתונים','Too little data (need ≥20 bars)'))); return; }
  container.appendChild(elText('div','qvs-msg',TL('Fib 61.8% + Pinbar · ','Fib 61.8% + Pinbar · ','Fib 61.8% + Pinbar · ')+sym));
  function row(k,v,c){var d=el('div');d.style.cssText='display:flex;gap:8px;padding:5px 4px;font-family:monospace;font-size:12px;border-bottom:1px solid '+GRID+';';var a=el('span');a.textContent=k;a.style.cssText='flex:1;color:'+PH+';';var b=el('span');b.textContent=v;b.style.cssText='color:'+(c||INK)+';';d.appendChild(a);d.appendChild(b);container.appendChild(d);}
  if(!r.signal){
    container.appendChild(elText('div','qvs-msg qvs-warn',TL('Сетапа нет: ','אין סטאפ: ','No setup: ')+(r.reason||'—')));
    if(r.lvl618) row(TL('Зона 61.8%','אזור 61.8%','61.8% zone'), (r.zone[0]).toFixed(2)+'–'+(r.zone[1]).toFixed(2));
    container.appendChild(el('div','qvs-foot',TL('Стратегия ждёт: откат в зону 61.8% → бычий Pinbar → зелёная свеча. Сейчас условия не выполнены. Не инвестсовет.','האסטרטגיה ממתינה לתנאים. אינו ייעוץ.','The strategy waits for: pullback to the 61.8% zone → bullish Pinbar → green candle. Conditions are not met now. Not advice.')));
    return;
  }
  var col=r.fresh?'#43E39B':'#F5B23D';
  row(TL('Сигнал','סיגנל','Signal'), (r.fresh?TL('ПОКУПКА (свежий)','קנייה (טרי)','BUY (fresh)'):TL('покупка (устарел '+r.barsAgo+' б.)','קנייה (ישן)','buy (aged '+r.barsAgo+' bars)')), col);
  row(TL('Вход (закр. зелёной)','כניסה','Entry (green close)'), r.entry.toFixed(2), '#43E39B');
  row(TL('Стоп (под Pinbar)','סטופ','Stop (below Pinbar)'), r.stop.toFixed(2), '#FF5F70');
  row(TL('Цель (макс. импульса)','יעד','Target (impulse high)'), r.target.toFixed(2), PH);
  row('R:R', '1:'+r.rr.toFixed(1), r.rr>=2?'#43E39B':(r.rr>=1?'#F5B23D':'#FF5F70'));
  row(TL('Импульс','אימפולס','Impulse'), '+'+r.movePct.toFixed(1)+'%');
  row(TL('Зона 61.8%','אזור 61.8%','61.8% zone'), r.zone[0].toFixed(2)+'–'+r.zone[1].toFixed(2));
  container.appendChild(el('div','qvs-foot',TL('Стратегия Monxaiding №1: Фибо от мин→макс, откат в 61.8%, бычий Pinbar + зелёная свеча = вход. 4H — контекст, 15M — вход. Стоп под Pinbar, цель — макс импульса. Не инвестсовет.','אסטרטגיית Monxaiding №1. אינו ייעוץ.','Monxaiding strategy #1: Fib from min→max, pullback to 61.8%, bullish Pinbar + green candle = entry. 4H context, 15M entry. Stop below Pinbar, target the impulse high. Not advice.')));}
var _fibState={on:false};
async function fibScan(opts,onProg){ opts=opts||{}; var uni=MA200_UNIVERSE.slice();
 try{var w=JSON.parse(localStorage.getItem('qe_watchlist')||'[]');if(Array.isArray(w))w.forEach(function(x){var t=(''+((x&&x.ticker)||x)).trim().toUpperCase();if(t&&uni.indexOf(t)<0)uni.push(t);});}catch(e){}
 var out=[],done=0,i=0,B=4;
 async function one(sym){try{ await fetchCloses(sym); var bars=_BARS[(sym||'').toUpperCase()]; if(bars&&bars.length>=20){ var r=fibPinbar(bars); if(r&&r.signal){ r.sym=(sym||'').toUpperCase(); out.push(r); } } }catch(e){}finally{done++;if(onProg)try{onProg(done,uni.length,out.length);}catch(_){}}}
 while(i<uni.length){var bt=uni.slice(i,i+B);i+=B;await Promise.all(bt.map(one));}
 out.sort(function(a,b){ if(a.fresh!==b.fresh) return a.fresh?-1:1; return (b.rr||0)-(a.rr||0); });
 return {items:out,scanned:uni.length,found:out.length}; }
function renderFibScan(container,r){ container.innerHTML='';
 if(!r.items.length){ container.appendChild(elText('div','qvs-msg',TL('Сетапов Fib+Pinbar не найдено. Скан ','לא נמצאו סטאפים. נסרק ','No Fib+Pinbar setups. scanned ')+r.scanned)); return; }
 container.appendChild(elText('div','qvs-msg',TL('Fib+Pinbar сетапы: ','סטאפים: ','Fib+Pinbar setups: ')+r.found+'/'+r.scanned));
 r.items.forEach(function(it){ var col=it.fresh?'#43E39B':'#F5B23D';
  var row=el('div');row.style.cssText='display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid '+GRID+';font-family:monospace;font-size:12px;';
  var sy=el('b');sy.textContent=it.sym;sy.style.cssText='min-width:64px;color:'+INK+';cursor:pointer;';sy.addEventListener('click',function(){ try{ QVStructure.open(it.sym); }catch(e){} });
  var meta=el('span');meta.style.cssText='flex:1;color:'+PH+';';meta.textContent=TL('вход ','כניסה ','entry ')+it.entry.toFixed(2)+' · R:R 1:'+it.rr.toFixed(1)+(it.fresh?'':' ·'+TL('стар','ישן','old'));
  var tag=el('span');tag.textContent='+'+it.movePct.toFixed(0)+'%';tag.style.cssText='color:'+col+';min-width:52px;text-align:right;';
  row.appendChild(sy);row.appendChild(meta);row.appendChild(tag);container.appendChild(row); });
 container.appendChild(el('div','qvs-foot',TL('Стратегия Monxaiding №1 по юниверсу: свежий сигнал (зелёная свеча только что) — приоритет. Тап=разбор. Не инвестсовет.','אסטרטגיית Monxaiding №1. אינו ייעוץ.','Monxaiding strategy #1 across the universe: a fresh signal (green candle just closed) ranks first. Tap=analyze. Not advice.')));}
function build(){
  // remove any previous panel so build() can re-run on a theme switch without duplicating
  try{ ['.qvs-fab','.qvs-ov','#qvBreadthBadge','#qvHelpOv'].forEach(function(sel){ var n=document.querySelector(sel); if(n&&n.parentNode) n.parentNode.removeChild(n); }); }catch(e){}
  _qvPalette();
  css();
  var fab=el('button','qvs-fab','Σ '+TL('риск','סיכון','risk'));
  var ov=el('div','qvs-ov');
  var sheet=el('div','qvs-sheet');
  var hd=el('div','qvs-hd');hd.appendChild(el('div','qvs-ttl','QUANT<b>VIEW</b> · STRUCTURE'));
  var hbtn=el('button','qvs-x','?'); hbtn.title=TL('Помощь','עזרה','Help');
  hbtn.addEventListener('click',function(){ var o=_qvHelpOverlay(); o.style.display='flex'; });
  hd.appendChild(hbtn);
  var x=el('button','qvs-x','✕');hd.appendChild(x);sheet.appendChild(hd);
  try{ var _cp=el('div'); _cp.textContent='© 2026 Daniel Saricov · QUANT EDGE · All rights reserved';
    _cp.style.cssText='font-family:monospace;font-size:8.5px;color:'+DIM+';text-align:center;padding:4px 0 2px;opacity:.8;';
    sheet.appendChild(_cp); }catch(e){}
  var row=el('div','qvs-row');
  var input=el('input','qvs-in');input.setAttribute('placeholder','TICKER');input.value=guessTicker();
  var go=el('button','qvs-go',TL('Анализ','נתח','Analyze'));row.appendChild(input);row.appendChild(go);sheet.appendChild(row);
  var res=el('div');res.appendChild(el('div','qvs-msg',TL('Введите тикер (US: AAPL; иные: с суффиксом, напр. TEVA.TA) и нажмите Анализ.','הזן טיקר ולחץ נתח.','Enter a ticker (US: AAPL; others with suffix e.g. TEVA.TA) and tap Analyze.')));
  sheet.appendChild(res);ov.appendChild(sheet);document.body.appendChild(fab);document.body.appendChild(ov); try{ _breadthBadge(); }catch(e){}
  // ── MA200 scan control (Σ-overlay; does not touch the React verdict tree) ──
  var maRow=el('div'); maRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:8px;';
  var maThr=el('input'); maThr.setAttribute('type','number'); maThr.setAttribute('step','0.5'); maThr.value='3';
  maThr.style.cssText='width:52px;background:'+BG+';color:'+INK+';border:1px solid '+GRID+';border-radius:7px;padding:6px 8px;font-family:monospace;font-size:11px;';
  var maBtn=el('button','qvs-btn',TL('\u0421\u043a\u0430\u043d MA200','\u05e1\u05e8\u05d9\u05e7\u05ea MA200','MA200 scan'));
  maBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  maRow.appendChild(elText('span','qvs-msg','\u00b1%')); maRow.appendChild(maThr); maRow.appendChild(maBtn);
  try{ sheet.insertBefore(maRow,res); }catch(e){ sheet.appendChild(maRow); }
  // ── DSR scan (selection-bias-aware discovery screen; Σ-overlay) ──
  var dsRow=el('div'); dsRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;';
  var dsBtn=el('button','qvs-btn',TL('\u0421\u043a\u0430\u043d DSR (\u043f\u0435\u0440\u0435\u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435)','\u05e1\u05e8\u05d9\u05e7\u05ea DSR (\u05d4\u05ea\u05d0\u05de\u05ea \u05d9\u05ea\u05e8)','DSR scan (overfitting)'));
  dsBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  dsRow.appendChild(dsBtn); try{ sheet.insertBefore(dsRow,res); }catch(e){ sheet.appendChild(dsRow); }
  var coRow=el('div'); coRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;';
  var coBtn=el('button','qvs-btn',TL('Скан пар (коинтеграция)','סריקת זוגות','Pairs scan (cointegration)'));
  coBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  coRow.appendChild(coBtn); try{ sheet.insertBefore(coRow,res); }catch(e){ sheet.appendChild(coRow); }
  var exRow=el('div'); exRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;';
  var exBtn=el('button','qvs-btn',TL('План исполнения (A-C)','תוכנית ביצוע','Execution plan (A-C)'));
  exBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  exRow.appendChild(exBtn); try{ sheet.insertBefore(exRow,res); }catch(e){ sheet.appendChild(exRow); }
  var brRow=el('div'); brRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;';
  var brBtn=el('button','qvs-btn',TL('Ширина рынка','רוחב שוק','Market breadth'));
  brBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  brRow.appendChild(brBtn); try{ sheet.insertBefore(brRow,res); }catch(e){ sheet.appendChild(brRow); }
  var acRow=el('div'); acRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap;';
  var acBtn=el('button','qvs-btn',TL('Угадывания (топ + прогноз/факт)','ניחושים','Hit-rate (top + forecast/actual)'));
  acBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  var acChk=el('label'); acChk.style.cssText='display:flex;align-items:center;gap:4px;color:'+PH+';font-family:monospace;font-size:10px;cursor:pointer;';
  var acBox=document.createElement('input'); acBox.type='checkbox'; acChk.appendChild(acBox); acChk.appendChild(document.createTextNode(TL('фильтр сканов','סינון','filter scans')));
  acRow.appendChild(acBtn); acRow.appendChild(acChk); try{ sheet.insertBefore(acRow,res); }catch(e){ sheet.appendChild(acRow); }
  acBox.addEventListener('change',function(){ _accState.on=acBox.checked; });
  acBtn.addEventListener('click',function(){ try{ renderAccuracy(res,(input.value||'').trim().toUpperCase()); }catch(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Acc: '+((e&&e.message)||'error'))); } });
  var tfRow=el('div'); tfRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;';
  var tfUrl=document.createElement('input'); tfUrl.type='text'; tfUrl.placeholder=TL('URL TimesFM','TimesFM URL','TimesFM URL');
  try{ tfUrl.value=localStorage.getItem('qe_tfm_url')||''; }catch(e){}
  tfUrl.style.cssText='flex:1;background:'+PANEL+';color:'+INK+';border:1px solid '+GRID+';border-radius:7px;padding:6px 8px;font-family:monospace;font-size:10px;';
  var tfSave=el('button','qvs-btn',TL('Сохр.','שמור','Save')); tfSave.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:10px;cursor:pointer;';
  tfSave.addEventListener('click',function(){ try{ localStorage.setItem('qe_tfm_url',(tfUrl.value||'').trim()); }catch(e){} });
  tfRow.appendChild(tfUrl); tfRow.appendChild(tfSave); try{ sheet.insertBefore(tfRow,res); }catch(e){ sheet.appendChild(tfRow); }
  var tfBtn=el('button','qvs-btn',TL('TimesFM прогноз (+ согласие)','תחזית TimesFM','TimesFM forecast (+ agreement)'));
  tfBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;width:100%;margin-top:6px;';
  try{ sheet.insertBefore(tfBtn,res); }catch(e){ sheet.appendChild(tfBtn); }
  var tfBusy=false;
  tfBtn.addEventListener('click',function(){ if(tfBusy)return; var sym=(input.value||'').trim().toUpperCase(); if(!sym){res.innerHTML='';res.appendChild(elText('div','qvs-msg',TL('Введите тикер выше','הזן טיקר','Enter a ticker above')));return;} tfBusy=true;
    res.innerHTML=''; res.appendChild(elText('div','qvs-msg',TL('Загрузка… ','טוען… ','Loading… ')+sym));
    fetchCloses(sym).then(function(c){ if(!c||c.length<32) throw new Error('no data'); renderTfm(res,sym,c,null); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','TimesFM: '+((e&&e.message)||'error'))); })
      .then(function(){ tfBusy=false; }); });
  var rgBtn=el('button','qvs-btn',TL('Режим (HMM)','משטר (HMM)','Regime (HMM)'));
  rgBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;width:100%;margin-top:6px;';
  try{ sheet.insertBefore(rgBtn,res); }catch(e){ sheet.appendChild(rgBtn); }
  var rgBusy=false;
  var mcBtn=el('button','qvs-btn',TL('Монте-Карло (разброс/P)','מונטה קרלו','Monte Carlo (range/P)'));
  mcBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;width:100%;margin-top:6px;';
  try{ sheet.insertBefore(mcBtn,res); }catch(e){ sheet.appendChild(mcBtn); }
  var mcBusy=false;
  var spBtn=el('button','qvs-btn',TL('Спектр (цикл/шок)','ספקטרום (מחזור/הלם)','Spectrum (cycle/shock)'));
  spBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;width:100%;margin-top:6px;';
  try{ sheet.insertBefore(spBtn,res); }catch(e){ sheet.appendChild(spBtn); }
  var spBusy=false;
  var hbBtn=el('button','qvs-btn',TL('Фаза цикла (Гильберт)','פאזת מחזור (הילברט)','Cycle phase (Hilbert)'));
  hbBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;width:100%;margin-top:6px;';
  try{ sheet.insertBefore(hbBtn,res); }catch(e){ sheet.appendChild(hbBtn); }
  var hbBusy=false;
  var wvRow=el('div'); wvRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap;';
  var wvBtn=el('button','qvs-btn',TL('Волновой скан (циклы/тайминг)','סריקת גל','Wave scan (cycles/timing)'));
  wvBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  var wvChk=el('label'); wvChk.style.cssText='display:flex;align-items:center;gap:4px;color:'+PH+';font-family:monospace;font-size:10px;cursor:pointer;';
  var wvBox=document.createElement('input'); wvBox.type='checkbox'; wvChk.appendChild(wvBox); wvChk.appendChild(document.createTextNode(TL('фильтр сканов','סינון גל','wave filter')));
  wvRow.appendChild(wvBtn); wvRow.appendChild(wvChk); try{ sheet.insertBefore(wvRow,res); }catch(e){ sheet.appendChild(wvRow); }
  wvBox.addEventListener('change',function(){ _waveState.on=wvBox.checked; });
  var wvBusy=false;
  // ── Strategy: Fib 61.8% + bullish Pinbar (Monxaiding «Эксклюзивная №1») ──
  var fibRow=el('div'); fibRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap;';
  var fibBtn=el('button','qvs-btn',TL('Стратегия Fib+Pinbar','אסטרטגיית Fib+Pinbar','Fib+Pinbar strategy'));
  fibBtn.style.cssText='background:'+PANEL+';color:'+AM+';border:1px solid '+AM+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;flex:1;';
  var fibScanBtn=el('button','qvs-btn',TL('Скан','סריקה','Scan'));
  fibScanBtn.style.cssText='background:'+PANEL+';color:'+AM+';border:1px solid '+AM+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;';
  fibRow.appendChild(fibBtn); fibRow.appendChild(fibScanBtn); try{ sheet.insertBefore(fibRow,res); }catch(e){ sheet.appendChild(fibRow); }
  var fibBusy=false, fibScanBusy=false;
  fibBtn.addEventListener('click',function(){ if(fibBusy)return; var sym=(input.value||'').trim().toUpperCase(); if(!sym){res.innerHTML='';res.appendChild(elText('div','qvs-msg',TL('Введите тикер выше','הזן טיקר','Enter a ticker above')));return;} fibBusy=true;
    res.innerHTML=''; res.appendChild(elText('div','qvs-msg',TL('Анализ Fib+Pinbar… ','ניתוח… ','Fib+Pinbar… ')+sym));
    fetchCloses(sym).then(function(){ var bars=_BARS[sym]; if(!bars||bars.length<20) throw new Error('no data'); renderFibPinbar(res,sym,bars); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Fib: '+((e&&e.message)||'error'))); })
      .then(function(){ fibBusy=false; }); });
  fibScanBtn.addEventListener('click',function(){ if(fibScanBusy)return; fibScanBusy=true;
    res.innerHTML=''; var pg=elText('div','qvs-msg',TL('Скан Fib+Pinbar… ','סריקה… ','Fib+Pinbar scan… ')+'0'); res.appendChild(pg);
    fibScan({},function(d,t,v){ pg.textContent=TL('Скан ','סריקה ','Scan ')+d+'/'+t+' · '+TL('сетапов ','סטאפים ','setups ')+v; })
      .then(function(r){ renderFibScan(res,r); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Fib scan: '+((e&&e.message)||'error'))); })
      .then(function(){ fibScanBusy=false; }); });
  wvBtn.addEventListener('click',function(){ if(wvBusy)return; wvBusy=true;
    res.innerHTML=''; var pg=elText('div','qvs-msg',TL('Волновой скан… ','סריקת גל… ','Wave scan… ')+'0'); res.appendChild(pg);
    waveScan({},function(d,t,v){ pg.textContent=TL('Волны ','גלים ','Waves ')+d+'/'+t+' · '+TL('циклов ','מחזורים ','cycles ')+v; })
      .then(function(r){ renderWave(res,r); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Wave: '+((e&&e.message)||'error'))); })
      .then(function(){ wvBusy=false; }); });
  hbBtn.addEventListener('click',function(){ if(hbBusy)return; var sym=(input.value||'').trim().toUpperCase(); if(!sym){res.innerHTML='';res.appendChild(elText('div','qvs-msg',TL('Введите тикер выше','הזן טיקר','Enter a ticker above')));return;} hbBusy=true;
    res.innerHTML=''; res.appendChild(elText('div','qvs-msg',TL('Фазовый анализ… ','ניתוח פאזה… ','Phase analysis… ')+sym));
    fetchCloses(sym).then(function(c){ if(!c||c.length<80) throw new Error('no data'); renderHilbert(res,sym,c); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Hilbert: '+((e&&e.message)||'error'))); })
      .then(function(){ hbBusy=false; }); });
  spBtn.addEventListener('click',function(){ if(spBusy)return; var sym=(input.value||'').trim().toUpperCase(); if(!sym){res.innerHTML='';res.appendChild(elText('div','qvs-msg',TL('Введите тикер выше','הזן טיקר','Enter a ticker above')));return;} spBusy=true;
    res.innerHTML=''; res.appendChild(elText('div','qvs-msg',TL('Анализ спектра… ','ניתוח ספקטרום… ','Spectral analysis… ')+sym));
    fetchCloses(sym).then(function(c){ if(!c||c.length<64) throw new Error('no data'); renderSpectrum(res,sym,c); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Spectrum: '+((e&&e.message)||'error'))); })
      .then(function(){ spBusy=false; }); });
  mcBtn.addEventListener('click',function(){ if(mcBusy)return; var sym=(input.value||'').trim().toUpperCase(); if(!sym){res.innerHTML='';res.appendChild(elText('div','qvs-msg',TL('Введите тикер выше','הזן טיקר','Enter a ticker above')));return;} mcBusy=true;
    res.innerHTML=''; res.appendChild(elText('div','qvs-msg',TL('Симуляция… ','סימולציה… ','Simulating… ')+sym));
    fetchCloses(sym).then(function(c){ if(!c||c.length<60) throw new Error('no data'); renderMC(res,sym,c); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','MC: '+((e&&e.message)||'error'))); })
      .then(function(){ mcBusy=false; }); });
  rgBtn.addEventListener('click',function(){ if(rgBusy)return; var sym=(input.value||'').trim().toUpperCase(); rgBusy=true;
    res.innerHTML=''; res.appendChild(elText('div','qvs-msg',TL('HMM… ','HMM… ','HMM… ')+(sym||'SPY')));
    fetchCloses(sym||'SPY').then(function(c){ renderRegime(res,(sym||'SPY'),regimeHMM(c)); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','HMM: '+((e&&e.message)||'error'))); })
      .then(function(){ rgBusy=false; }); });
  var brBusy=false;
  brBtn.addEventListener('click',function(){ if(brBusy)return; brBusy=true;
    res.innerHTML=''; var pg=elText('div','qvs-msg',TL('Ширина... ','רוחב... ','Breadth... ')+'0'); res.appendChild(pg);
    breadthScan({},function(d,t,v){ pg.textContent=TL('Ширина ','רוחב ','Breadth ')+d+'/'+t; })
      .then(function(r){ renderBreadth(res,r); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Breadth: '+((e&&e.message)||'error'))); })
      .then(function(){ brBusy=false; });
  });
  var exBusy=false;
  exBtn.addEventListener('click',function(){ if(exBusy)return; var sym=(input.value||'').trim().toUpperCase(); if(!sym){res.innerHTML='';res.appendChild(elText('div','qvs-msg',TL('Введите тикер выше','הזן טיקר','Enter a ticker above')));return;} exBusy=true;
    res.innerHTML=''; res.appendChild(elText('div','qvs-msg',TL('Считаю... ','מחשב... ','Computing... ')+sym));
    fetchCloses(sym).then(function(c){ if(!c||c.length<60) throw new Error('no data');
      var r=[],t;for(t=1;t<c.length;t++)r.push(Math.log(c[t]/c[t-1]));
      var v=0,lam=0.94;for(t=1;t<r.length;t++)v=lam*v+(1-lam)*r[t-1]*r[t-1];var sig=Math.sqrt(v)||0.02;
      renderExec(res,sym,execSchedule({sigma:sig,N:5,lambda:2e-3}));
    }).catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Exec: '+((e&&e.message)||'error'))); }).then(function(){exBusy=false;});
  });
  var coBusy=false;
  coBtn.addEventListener('click',function(){ if(coBusy)return; coBusy=true;
    res.innerHTML=''; var pg=elText('div','qvs-msg',TL('Скан пар... ','סריקת זוגות... ','Pairs scan... ')+'0'); res.appendChild(pg);
    cointScan({z:2},function(d,t,v){ pg.textContent=TL('Пары ','זוגות ','Pairs ')+d+'/'+t+' - '+TL('рядов ','סדרות ','series ')+v; })
      .then(function(r){ if(_accState.on&&r&&r.pairs)r.pairs=_accWrap(r.pairs); if(r&&r.pairs)r.pairs=_waveWrap(r.pairs); renderCoint(res,r); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','Pairs: '+((e&&e.message)||'error'))); })
      .then(function(){ coBusy=false; });
  });
  var dsBusy=false;
  dsBtn.addEventListener('click',function(){
    if(dsBusy) return; dsBusy=true;
    res.innerHTML=''; var pg=elText('div','qvs-msg',TL('DSR-\u0441\u043a\u0430\u043d\u2026 ','\u05e1\u05e8\u05d9\u05e7\u05ea DSR\u2026 ','DSR scan\u2026 ')+'0'); res.appendChild(pg);
    dsrScan({},function(d,t,f){ pg.textContent=TL('DSR ','DSR ','DSR ')+d+'/'+t+' \u00b7 '+TL('\u0432\u0430\u043b\u0438\u0434 ','\u05ea\u05e7\u05e3 ','valid ')+f; })
      .then(function(r){ if(_accState.on&&r){var _it=r.items||r.rows;if(_it){var _f=_accWrap(_it);if(r.items)r.items=_f;else r.rows=_f;}}if(r){var _wi=r.items||r.rows; if(_wi){var _wf=_waveWrap(_wi); if(r.items)r.items=_wf; else r.rows=_wf;}} renderDSR(res,r); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','DSR: '+((e&&e.message)||'error'))); })
      .then(function(){ dsBusy=false; });
  });
  var maBusy=false;
  maBtn.addEventListener('click',function(){
    if(maBusy) return; maBusy=true;
    var thr=parseFloat(maThr.value)||3;
    res.innerHTML=''; var prog=elText('div','qvs-msg',TL('\u0421\u043a\u0430\u043d\u0438\u0440\u0443\u044e\u2026 ','\u05e1\u05d5\u05e8\u05e7\u2026 ','Scanning\u2026 ')+'0'); res.appendChild(prog);
    ma200Scan({thresholdPct:thr},function(d,t,f){ prog.textContent=TL('\u0421\u043a\u0430\u043d ','\u05e1\u05d5\u05e8\u05e7 ','Scanning ')+d+'/'+t+' \u00b7 '+TL('\u043d\u0430\u0439\u0434\u0435\u043d\u043e ','\u05e0\u05de\u05e6\u05d0\u05d5 ','found ')+f; })
      .then(function(r){ if(_accState.on&&r&&r.items)r.items=_accWrap(r.items); if(r&&r.items)r.items=_waveWrap(r.items); renderMA200(res,r); })
      .catch(function(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','MA200: '+((e&&e.message)||'error'))); })
      .then(function(){ maBusy=false; });
  });

  function open(){ ov.classList.add('on'); var last=(window.__QVLast&&window.__QVLast.sym)||''; input.value=last||input.value||guessTicker(); input.focus(); }
  function close(){ ov.classList.remove('on'); }
  fab.addEventListener('click',open); x.addEventListener('click',close);
  // Relay address, editable in-app. Without this the only way to point the app at a private
  // CORS relay would be rebuilding the APK, since a WebView offers no console to set
  // localStorage from. Stored under the same key the transport layer reads.
  var relayRow=el('div');
  relayRow.style.cssText='display:flex;gap:6px;align-items:center;margin-top:8px;';
  var relayIn=el('input');
  relayIn.setAttribute('placeholder','https://relay.\u2026  ('+TL('\u0441\u0432\u043e\u0439 \u0440\u0435\u043b\u0435\u0439','\u05de\u05de\u05e1\u05e8','own relay')+')');
  relayIn.style.cssText='flex:1;background:'+BG+';color:'+INK+';border:1px solid '+GRID+';border-radius:7px;padding:6px 8px;font-family:monospace;font-size:11px;';
  try{ relayIn.value=(localStorage.getItem('qe_relay')||''); }catch(e){}
  var relayBtn=el('button','qvs-btn',TL('\u0421\u043e\u0445\u0440.','\u05e9\u05de\u05d5\u05e8','Save'));
  relayBtn.style.cssText='background:'+PANEL+';color:'+PH+';border:1px solid '+PH+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;';
  relayBtn.addEventListener('click',function(){
    var v=(relayIn.value||'').trim();
    try{
      if(v && !/^https:\/\//i.test(v)){ relayIn.style.borderColor=TL_; relayIn.value=v; return; }
      localStorage.setItem('qe_relay', v);
      relayIn.style.borderColor=v?PH:GRID;
      window.QELog&&window.QELog.info&&window.QELog.info('relay', v?('relay set to '+v):'relay cleared');
    }catch(e){ relayIn.style.borderColor=TL_; }
  });
  // Test button: pings the relay (entered value, else the compiled default) against a live
  // Yahoo quote that REQUIRES a relay in a WebView, and reports OK+latency or fail — so the
  // user can confirm their relay actually serves data without reading logs.
  var relayTest=el('button','qvs-btn',TL('Тест','בדיקה','Test'));
  relayTest.style.cssText='background:'+PANEL+';color:'+AM+';border:1px solid '+AM+';border-radius:7px;padding:6px 10px;font-family:monospace;font-size:11px;cursor:pointer;';
  relayTest.addEventListener('click',function(){
    var base=(relayIn.value||'').trim();
    try{ if(!base) base=(window.QV_RELAY_DEFAULT||''); }catch(e){}
    if(!base){ relayTest.textContent=TL('нет релея','אין ריליי','no relay'); relayTest.style.color=TL_; relayTest.style.borderColor=TL_; return; }
    var target='https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d';
    var u=base.replace(/\/+$/,'')+'/?url='+encodeURIComponent(target);
    var t0=Date.now(); relayTest.textContent='…'; relayTest.style.color=AM; relayTest.style.borderColor=AM;
    fetch(u,{cache:'no-store'}).then(function(r){ return r.ok?r.json():Promise.reject(new Error('HTTP '+r.status)); })
      .then(function(j){ var ok=j&&j.chart&&!j.chart.error&&j.chart.result; if(!ok) throw new Error('bad body');
        relayTest.textContent='OK '+(Date.now()-t0)+TL('мс','ms','ms'); relayTest.style.color=PH; relayTest.style.borderColor=PH; })
      .catch(function(e){ relayTest.textContent=TL('ошибка','שגיאה','fail'); relayTest.style.color=TL_; relayTest.style.borderColor=TL_;
        window.QELog&&window.QELog.warn&&window.QELog.warn('relay','test failed: '+((e&&e.message)||'err')); });
    setTimeout(function(){ relayTest.textContent=TL('Тест','בדיקה','Test'); relayTest.style.color=AM; relayTest.style.borderColor=AM; },6000);
  });
  relayRow.appendChild(relayIn); relayRow.appendChild(relayBtn); relayRow.appendChild(relayTest);
  try{ sheet.appendChild(relayRow); }catch(e){}

  ov.addEventListener('click',function(e){ if(e.target===ov) close(); });

  // ── Data light, carried by the FAB ───────────────────────────────────────────
  // A separately positioned element depends on the host page's stacking context and
  // layout, which is fragile. The FAB already renders reliably, so the data light is a
  // coloured dot prepended to its own label: it cannot be covered by anything the FAB
  // is not also covered by, and it needs no z-index of its own.
  function healthNow(){
    var L=window.__QVLast;
    if(!L||!L.sym) return {level:"none",txt:TL('\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445','\u05d0\u05d9\u05df \u05e0\u05ea\u05d5\u05e0\u05d9\u05dd','no data'),reasons:[],age:null};
    try{
      _META[L.sym]=_META[L.sym]||{asOf:L.asOf,marketState:L.marketState,transport:L.transport,bars:L.bars,isFund:false};
      var dh=dataHealth(L.sym,(L.closes&&L.closes.length?L.closes:null));
      var ageTxt=(dh.ageH==null)?'?':(dh.ageH<1?(Math.round(dh.ageH*60)+TL('\u043c','\u05d3','m')):(dh.ageH<48?(Math.round(dh.ageH)+TL('\u0447','\u05e9','h')):(Math.round(dh.ageH/24)+TL('\u0434','\u05d9','d'))));
      return {level:dh.level,txt:ageTxt,reasons:dh.reasons,dh:dh};
    }catch(e){ return {level:"none",txt:"?",reasons:[]}; }
  }
  // The FAB label and the data dot are separate spans. The badge writers below used to
  // assign fab.textContent, which removes every child node — that would delete the dot the
  // first time a scan finished. They now write into fabLabel only.
  // Both the data light and the discovery badge want the tooltip; whichever wrote last used
  // to erase the other. They now own separate halves and a composer joins them.
  var _lampTitle='', _badgeTitle='';
  function syncTitle(){ try{ fab.title=[_lampTitle,_badgeTitle].filter(Boolean).join('  |  '); }catch(e){} }
  var dataDot=el('span'), fabLabel=el('span');
  dataDot.style.cssText='margin-inline-end:6px;font-size:13px;line-height:1;';
  dataDot.textContent='\u25cb';
  fabLabel.textContent=fab.textContent||('\u03a3 '+TL('\u0440\u0438\u0441\u043a','\u05e1\u05d9\u05db\u05d5\u05df','risk'));
  try{ fab.textContent=''; fab.appendChild(dataDot); fab.appendChild(fabLabel); }catch(e){}
  function paintLamp(){
    try{
      var h=healthNow();
      dataDot.textContent=(h.level==="none")?'\u25cb':'\u25cf';
      dataDot.style.color=(h.level==="green")?PH:(h.level==="amber")?AM:(h.level==="red")?TL_:MU;
      var base=(h.level==="none")
        ? TL('\u0421\u043a\u0430\u043d \u0435\u0449\u0451 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u043b\u0441\u044f \u2014 \u0441\u0432\u0435\u0436\u0435\u0441\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0445 \u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430','\u05d8\u05e8\u05dd \u05e0\u05e1\u05e8\u05e7','No scan yet - data freshness unknown')
        : (h.level==="green")?TL('\u0414\u0430\u043d\u043d\u044b\u0435 \u0441\u0432\u0435\u0436\u0438\u0435','\u05d8\u05e8\u05d9','Data fresh')
        : (h.level==="amber")?TL('\u0414\u0430\u043d\u043d\u044b\u0435 \u0441 \u043e\u0433\u043e\u0432\u043e\u0440\u043a\u043e\u0439','\u05d1\u05e1\u05e4\u05e7','Data suspect')
        : TL('\u0414\u0430\u043d\u043d\u044b\u043c \u043d\u0435\u043b\u044c\u0437\u044f \u0434\u043e\u0432\u0435\u0440\u044f\u0442\u044c','\u05dc\u05d0 \u05d0\u05de\u05d9\u05df','Data unreliable');
      var extra=(h.dh?(' \u00b7 '+(h.txt||'')+' \u00b7 '+MSX(h.dh.marketState)+' \u00b7 '+TPX(h.dh.transport)):'');
      _lampTitle=base+(h.reasons&&h.reasons.length?(' \u2014 '+h.reasons.join('; ')):'')+extra; syncTitle();
    }catch(e){}
  }
  window.addEventListener('qv:scandone',function(){ setTimeout(paintLamp,150); });
  try{ setTimeout(paintLamp,300); }catch(e){}
  setInterval(paintLamp, 60000);   // age keeps counting up even without a new scan

  // ── Third voice on the FAB ──────────────────────────────────────────────────
  // After an app scan, colour the Σ FAB with the discovery gate's honest verdict for the
  // winning symbol (✓ found / ≈ snoop / ⊘ none), computed on a DEEP series (not the 40-bar
  // display slice). Deferred so it never competes with the React verdict render; cached per
  // session; best-effort. Insufficient history → neutral "Σ · SYM", never a false ⊘.
  var _discCache={};
  function _fabDefault(){ fabLabel.textContent='Σ '+TL('риск','סיכון','risk'); fab.style.color=PH; fab.style.borderColor=PH; fab.removeAttribute('title'); }
  function _fabComputing(sym){ fabLabel.textContent='Σ … '+sym; fab.style.color=DIM; fab.style.borderColor=GRID; _badgeTitle=TL('Считаю направленный тест…','מחשב…','Computing directional test…')+' '+sym; syncTitle(); }
  function _fabNeutral(sym){ fabLabel.textContent='Σ · '+sym; fab.style.color=DIM; fab.style.borderColor=GRID; _badgeTitle=TL('Недостаточно истории для теста направления','אין מספיק היסטוריה','Insufficient history for directional test')+' · '+sym; syncTitle(); }
  function _fabVerdict(sym,vk){
    var g=vk==='disc.found'?'✓':vk==='disc.snoop'?'≈':'⊘';
    var c=vk==='disc.found'?PH:vk==='disc.snoop'?AM:MU;
    fabLabel.textContent='Σ '+g+' '+sym; fab.style.color=c; fab.style.borderColor=c;
    _badgeTitle=(vk==='disc.found'?TL('Направленный край подтверждён вне выборки','יתרון כיווני אושר מחוץ למדגם','Directional edge confirmed out-of-sample')
      :vk==='disc.snoop'?TL('Скилл не пробил блочную перестановку — артефакт перебора','לא עבר פרמוטציה — ארטיפקט','Failed block-permutation — search artifact')
      :TL('Направленной структуры нет — работает только слой риска','אין מבנה כיווני — רק שכבת סיכון','No directional structure — risk layer only'))+' · '+sym;
  }
  function fabSetVerdict(sym,vk){ if(sym&&vk){ _discCache[sym]=vk; _fabVerdict(sym,vk); } }  // exposed for run()
  async function _badgeScan(sym){
    if(!sym) return;
    if(_discCache[sym]){ _fabVerdict(sym,_discCache[sym]); return; }
    _fabComputing(sym);
    try{
      var closes=await fetchCloses(sym);
      var d=discoverStructure(closes,{perms:60});
      if(d&&d.ok){
        var fv1=fdrVerdict(sym,d.stats&&d.stats.pPermutation!=null?d.stats.pPermutation:1,d.tier);
        _discCache[sym]=fv1.verdictKey; _fabVerdict(sym,fv1.verdictKey);
      }
      else { _fabNeutral(sym); }
    }catch(e){ _fabDefault(); window.QELog&&window.QELog.debug&&window.QELog.debug('qvsFab',sym+': '+((e&&e.message)||'err')); }
  }
  window.addEventListener('qv:scandone',function(ev){
    var sym=(ev&&ev.detail&&ev.detail.sym)||(window.__QVLast&&window.__QVLast.sym)||'';
    if(sym) setTimeout(function(){ _badgeScan((''+sym).toUpperCase()); }, 400);
  });
  // A scan may have finished before this overlay built — badge it once on startup.
  try{ if(window.__QVLast&&window.__QVLast.sym) setTimeout(function(){ _badgeScan((''+window.__QVLast.sym).toUpperCase()); }, 600); }catch(e){}
  // ────────────────────────────────────────────────────────────────────────────

  function stat(msg){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg',msg)); }
  async function run(){
    var sym=(input.value||'').trim().toUpperCase(); if(!sym){input.focus();return;}
    stat(TL('Загрузка данных '+sym+'…','טוען '+sym+'…','Fetching '+sym+'…'));
    var closes;
    try{ closes=await fetchCloses(sym); }
    catch(e){ stat(''); res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn',TL('Данные не получены: ','נכשל: ','No data: ')+sym+' — '+((e&&e.message)||'ошибка сети'))); return; }
    stat(TL('Волатильность и хвосты…','תנודתיות…','Volatility & tails…'));
    setTimeout(function(){
      var vt,disc;
      try{ vt=volatilityTails(closes,{horizon:10}); }
      catch(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','vol: '+((e&&e.message)||'error'))); return; }
      stat(TL('Проверка направления (пермутации)…','כיוון…','Direction (permutations)…'));
      setTimeout(function(){
        try{ disc=discoverStructure(closes,{perms:60}); }
        catch(e){ disc={ok:false,_err:(e&&e.message)||'error'}; }
        try{ renderResult(res,sym,vt,disc,closes); }
        catch(e){ res.innerHTML=''; res.appendChild(elText('div','qvs-msg qvs-warn','render: '+((e&&e.message)||'error'))); }
        try{ if(disc&&disc.ok){ var _fv3=fdrVerdict(sym,disc.stats&&disc.stats.pPermutation!=null?disc.stats.pPermutation:1,disc.tier); fabSetVerdict(sym,_fv3.verdictKey); } }catch(_e){}
      },40);
    },40);
  }
  go.addEventListener('click',run);
  input.addEventListener('keydown',function(e){ if(e.key==='Enter') run(); });

  root.QVStructure={ open:function(t){ if(t){input.value=(''+t).toUpperCase();} open(); run&&t&&run(); }, applyTheme:function(){ try{ build(); }catch(e){} }, analyze:function(closes,o){return{vt:volatilityTails(closes,o),disc:discoverStructure(closes,o)};}, volatilityTails:volatilityTails, discoverStructure:discoverStructure, epistemicGate:epistemicGate, ma200Scan:ma200Scan, smaN:smaN, psr:psr, deflatedSR:deflatedSR, dsrScan:dsrScan, dsrRank:dsrRank, calibrate:pickCalibratorMemo, ece:_ece, cointScan:cointScan, cointPair:cointPair, execSchedule:execSchedule, breadthScan:breadthScan, breadthClassify:breadthClassify, stockAccuracy:stockAccuracy, accuracyAll:accuracyAll, topByAccuracy:topByAccuracy, accuracyFilter:accuracyFilter, forecastVsActual:forecastVsActual, tfmForecast:tfmForecast, tfmMoveProb:tfmMoveProb, tfmBlend:tfmBlend, tfmAgree:tfmAgree, pbo:pbo, monteCarlo:monteCarlo, spectrum:spectrum, shockDecay:shockDecay, hilbertPhase:hilbertPhase, waveScan:waveScan, waveOne:waveOne, fibPinbar:fibPinbar, fibScan:fibScan, hmmFit:hmmFit, regimeHMM:regimeHMM,
    // Exposed so the scan itself can rank on these, not merely report them afterwards.
    moveProbability:moveProbability, riskManagement:riskManagement,
    arbitrageLimits:arbitrageLimits, dataHealth:dataHealth, totalVector:totalVector,
    portfolioRisk:portfolioRisk };
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build); else build();
})(typeof window!=='undefined'?window:globalThis);
