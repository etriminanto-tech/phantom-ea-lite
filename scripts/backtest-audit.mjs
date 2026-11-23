import fs from "node:fs/promises";

const BASE = "https://fapi.bitunix.com/api/v1/futures/market/kline";
const SYMBOL = "BTCUSDT";
const TARGET = 5000;
const FEE = 0.0006;
const SLIPPAGE = 0.0002;
const RISK = 0.01;
const INTERVALS = ["5m", "15m", "1h"];

async function candles(interval) {
  const all = new Map();
  let endTime;
  for (let page = 0; all.size < TARGET && page < 30; page++) {
    const u = new URL(BASE);
    u.searchParams.set("symbol", SYMBOL);
    u.searchParams.set("interval", interval);
    u.searchParams.set("limit", String(Math.min(200, TARGET - all.size)));
    if (endTime) u.searchParams.set("endTime", String(endTime));
    const r = await fetch(u, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`Bitunix HTTP ${r.status} for ${interval}`);
    const body = await r.json();
    if (Number(body.code) !== 0 || !Array.isArray(body.data)) throw new Error(`Bitunix response invalid: ${body.msg || "no data"}`);
    const pageRows = body.data.map(x => ({
      time: Number(x.time), open: Number(x.open), high: Number(x.high),
      low: Number(x.low), close: Number(x.close)
    })).filter(x => Object.values(x).every(Number.isFinite)).sort((a,b)=>a.time-b.time);
    if (!pageRows.length) break;
    for (const x of pageRows) all.set(x.time, x);
    if (pageRows.length < Math.min(200, TARGET - all.size + pageRows.length)) break;
    const oldest = pageRows[0].time;
    if (!Number.isFinite(oldest) || oldest <= 0 || oldest === endTime) break;
    endTime = oldest;
    await new Promise(resolve => setTimeout(resolve, 180));
  }
  return [...all.values()].sort((a,b)=>a.time-b.time).slice(-TARGET);
}

function ema(a, p) {
  const out = Array(a.length).fill(null);
  if (a.length < p) return out;
  let v = a.slice(0,p).reduce((x,y)=>x+y,0)/p;
  out[p-1] = v;
  const k = 2/(p+1);
  for (let i=p;i<a.length;i++) out[i] = v = a[i]*k + v*(1-k);
  return out;
}
function rsi(a,p=14) {
  const out=Array(a.length).fill(null);
  if(a.length<=p)return out;
  let g=0,l=0;
  for(let i=1;i<=p;i++){const d=a[i]-a[i-1];g+=Math.max(0,d);l+=Math.max(0,-d);}
  let ag=g/p,al=l/p;
  out[p]=al===0?100:100-100/(1+ag/al);
  for(let i=p+1;i<a.length;i++){const d=a[i]-a[i-1];ag=(ag*(p-1)+Math.max(0,d))/p;al=(al*(p-1)+Math.max(0,-d))/p;out[i]=al===0?100:100-100/(1+ag/al);}
  return out;
}
function atrAdx(c,p=14) {
  const tr=Array(c.length).fill(null), plus=Array(c.length).fill(0), minus=Array(c.length).fill(0);
  for(let i=1;i<c.length;i++){
    const up=c[i].high-c[i-1].high,down=c[i-1].low-c[i].low;
    plus[i]=up>down&&up>0?up:0;minus[i]=down>up&&down>0?down:0;
    tr[i]=Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close));
  }
  const a=Array(c.length).fill(null),adx=Array(c.length).fill(null);
  let sTR=0,sP=0,sM=0;
  for(let i=1;i<=p;i++){sTR+=tr[i];sP+=plus[i];sM+=minus[i];}
  let dxs=[];
  for(let i=p;i<c.length;i++){
    if(i>p){sTR=sTR-sTR/p+tr[i];sP=sP-sP/p+plus[i];sM=sM-sM/p+minus[i];}
    a[i]=sTR/p;
    const pdi=sTR?100*(sP/p)/a[i]:0,mdi=sTR?100*(sM/p)/a[i]:0;
    const dx=(pdi+mdi)?100*Math.abs(pdi-mdi)/(pdi+mdi):0;
    dxs.push(dx);
    if(dxs.length===p)adx[i]=dxs.reduce((x,y)=>x+y,0)/p;
    else if(dxs.length>p)adx[i]=(adx[i-1]*(p-1)+dx)/p;
  }
  return {atr:a,adx};
}
function indicators(c) {
  const close=c.map(x=>x.close), e9=ema(close,9),e21=ema(close,21),e50=ema(close,50),e200=ema(close,200);
  const e12=ema(close,12),e26=ema(close,26),m=close.map((_,i)=>e12[i]===null||e26[i]===null?null:e12[i]-e26[i]);
  const compact=m.filter(x=>x!==null),sigCompact=ema(compact,9),sig=Array(c.length).fill(null);let k=0;
  for(let i=0;i<c.length;i++)if(m[i]!==null)sig[i]=sigCompact[k++];
  const {atr,adx}=atrAdx(c);
  return {e9,e21,e50,e200,rsi:rsi(close),m,sig,atr,adx};
}
function simulate(c, ind, mode) {
  let equity=50, peak=50, maxDD=0, wins=0, grossWin=0, grossLoss=0, costs=0, trades=0;
  let i=220;
  while(i<c.length-1 && equity>0){
    const vals=[ind.e9[i],ind.e21[i],ind.e50[i],ind.e200[i],ind.rsi[i],ind.m[i],ind.sig[i],ind.atr[i],ind.adx[i]];
    if(vals.some(x=>x===null||!Number.isFinite(x))){i++;continue;}
    const trendBuy=ind.e50[i]>ind.e200[i] && c[i].close>ind.e200[i];
    const trendSell=ind.e50[i]<ind.e200[i] && c[i].close<ind.e200[i];
    const adxThreshold=mode.startsWith("trend_adx")?Number(mode.replace("trend_adx","")):0;
    const trendOk=mode==="baseline"||(mode==="trend"&&trendBuy)||(mode.startsWith("trend_adx")&&trendBuy&&ind.adx[i]>=adxThreshold);
    const trendSellOk=mode==="baseline"||(mode==="trend"&&trendSell)||(mode.startsWith("trend_adx")&&trendSell&&ind.adx[i]>=adxThreshold);
    const buy=ind.e9[i]>ind.e21[i]&&ind.rsi[i]>=52&&ind.rsi[i]<=68&&ind.m[i]>ind.sig[i]&&trendOk;
    const sell=ind.e9[i]<ind.e21[i]&&ind.rsi[i]>=32&&ind.rsi[i]<=48&&ind.m[i]<ind.sig[i]&&trendSellOk;
    if(!buy&&!sell){i++;continue;}
    const long=buy, rawEntry=c[i+1].open, stopDist=1.5*ind.atr[i];
    if(!(rawEntry>0&&stopDist>0)){i++;continue;}
    const sl=long?rawEntry-stopDist:rawEntry+stopDist,tp=long?rawEntry+2*stopDist:rawEntry-2*stopDist;
    const costRate=FEE+SLIPPAGE;
    const qty=(equity*RISK)/(stopDist+(rawEntry+sl)*costRate);
    let rawExit=c.at(-1).close, exitIndex=c.length-1;
    for(let j=i+1;j<c.length;j++){
      const hitSL=long?c[j].low<=sl:c[j].high>=sl;
      const hitTP=long?c[j].high>=tp:c[j].low<=tp;
      if(hitSL||hitTP){rawExit=hitSL?sl:tp;exitIndex=j;break;}
    }
    const gross=(long?rawExit-rawEntry:rawEntry-rawExit)*qty;
    const cost=(rawEntry+rawExit)*qty*costRate;
    const net=gross-cost;
    costs+=cost;equity+=net;trades++;
    if(net>0){wins++;grossWin+=net;}else grossLoss+=Math.abs(net);
    peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak*100);
    i=Math.max(i+1,exitIndex+1);
  }
  return {trades,winRate:trades?100*wins/trades:0,netPnl:equity-50,endingEquity:equity,maxDrawdown:maxDD,profitFactor:grossLoss?grossWin/grossLoss:(grossWin?999:0),costs};
}
const report=[];
for(const interval of INTERVALS){
  const c=await candles(interval);
  if(c.length<1000) throw new Error(`Only ${c.length} candles received for ${interval}`);
  const ind=indicators(c);
  for(const mode of ["baseline","trend","trend_adx20","trend_adx25","trend_adx30"]){
    report.push({interval,candles:c.length,from:new Date(c[0].time).toISOString(),to:new Date(c.at(-1).time).toISOString(),mode,...simulate(c,ind,mode)});
  }
}
const md=[
"# Phantom EA Lite — strategy audit",
"",
"Assumptions: BTCUSDT linear futures; initial equity 50 USDT; 1% risk/trade; fee 0.06% and slippage 0.02% per side; ATR(14) stop 1.5x and target 2R; same-candle SL/TP resolves to SL; no funding or additional spread.",
"",
"| Timeframe | Candles | Variant | Trades | Win rate | Net P/L | Ending equity | Max DD | Profit factor | Costs |",
"|---|---:|---|---:|---:|---:|---:|---:|---:|---:|",
...report.map(x=>`| ${x.interval} | ${x.candles} | ${x.mode} | ${x.trades} | ${x.winRate.toFixed(1)}% | ${x.netPnl.toFixed(2)} | ${x.endingEquity.toFixed(2)} | ${x.maxDrawdown.toFixed(2)}% | ${x.profitFactor.toFixed(2)} | ${x.costs.toFixed(2)} |`),
"",
"Variants: baseline = EMA 9/21 + RSI 14 + MACD; trend = baseline plus EMA 50/200 trend direction; trend_adx20/25/30 = trend plus ADX(14) above the named threshold. This is a historical screening test, not a guarantee or live-readiness certification."
].join("\n");
await fs.mkdir("audit-output",{recursive:true});
await fs.writeFile("audit-output/report.json",JSON.stringify(report,null,2));
await fs.writeFile("audit-output/report.md",md);
console.log(md);
