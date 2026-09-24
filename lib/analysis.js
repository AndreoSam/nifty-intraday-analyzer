function ema(values,p){const k=2/(p+1);let e=values[0]??0;return values.map((v,i)=>i===0?e:(e=v*k+e*(1-k)))}
function rsi(values,p=14){let gains=0,losses=0;for(let i=1;i<=p&&i<values.length;i++){const d=values[i]-values[i-1];gains+=Math.max(d,0);losses+=Math.max(-d,0)}let ag=gains/p,al=losses/p;const out=Array(values.length).fill(null);for(let i=p;i<values.length;i++){if(i>p){const d=values[i]-values[i-1];ag=(ag*(p-1)+Math.max(d,0))/p;al=(al*(p-1)+Math.max(-d,0))/p}out[i]=al===0?100:100-100/(1+ag/al)}return out}
function vwap(rows){let pv=0,vol=0;return rows.map(r=>{const tp=(r.high+r.low+r.close)/3;pv+=tp*(r.volume||0);vol+=(r.volume||0);return vol?pv/vol:tp})}
function atr(rows,p=14){const tr=rows.map((r,i)=>i?Math.max(r.high-r.low,Math.abs(r.high-rows[i-1].close),Math.abs(r.low-rows[i-1].close)):r.high-r.low);let a=tr.slice(0,p).reduce((x,y)=>x+y,0)/p;const out=Array(rows.length).fill(null);out[p-1]=a;for(let i=p;i<rows.length;i++)a=(a*(p-1)+tr[i])/p,out[i]=a;return out}
export function analyze(rows){
 const closes=rows.map(x=>x.close), e9=ema(closes,9),e20=ema(closes,20),e50=ema(closes,50),rs=rsi(closes),vw=vwap(rows),at=atr(rows);const i=rows.length-1,last=rows[i],r=rs[i]||50;
 let score=0; if(last.close>e9[i])score+=1; else score-=1; if(e9[i]>e20[i])score+=2; else score-=2; if(e20[i]>e50[i])score+=1; else score-=1; if(last.close>vw[i])score+=1; else score-=1; if(r>55)score+=1; if(r<45)score-=1;
 const trend=score>=3?'Bullish':score<=-3?'Bearish':'Sideways / mixed';
 const recent=rows.slice(-30); const support=Math.min(...recent.map(x=>x.low)); const resistance=Math.max(...recent.map(x=>x.high));
 const range=at[i]||((resistance-support)/10); const bull=Math.max(15,Math.min(70,50+score*7)); const bear=Math.max(15,Math.min(70,50-score*7)); const side=Math.max(10,100-bull-bear); const total=bull+bear+side;
 return {last,trend,score,rsi:r,ema9:e9[i],ema20:e20[i],ema50:e50[i],vwap:vw[i],atr:range,support,resistance,scenarios:{bull:Math.round(bull/total*100),bear:Math.round(bear/total*100),side:Math.round(side/total*100)},chart:rows.slice(-80)};
}
