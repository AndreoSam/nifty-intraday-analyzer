function classifyTrend(changePct){return changePct>0.35?'UP':changePct<-0.35?'DOWN':'FLAT';}
function scoreContext(items){
  let score=0; const reasons=[];
  const add=(v,r)=>{score+=v;if(r)reasons.push(r)};
  const s=id=>items.find(x=>x.id===id);
  const nifty=s('NIFTY'), sp=s('SP500'), nasdaq=s('NASDAQ'), vix=s('VIX'), oil=s('OIL'), dxy=s('DXY'), usdInr=s('USDINR'), us10=s('US10Y');
  if(nifty){if(nifty.changePct>0.4)add(2,'NIFTY is gaining on the latest available feed.');else if(nifty.changePct<-0.4)add(-2,'NIFTY is weakening on the latest available feed.');}
  if(sp){if(sp.changePct>0.5)add(1,'S&P 500 is positive.');else if(sp.changePct<-0.5)add(-1,'S&P 500 is negative.');}
  if(nasdaq){if(nasdaq.changePct>0.6)add(1,'Nasdaq is positive.');else if(nasdaq.changePct<-0.6)add(-1,'Nasdaq is negative.');}
  if(vix){if(vix.changePct>5)add(-2,'VIX is rising sharply, indicating higher risk sensitivity.');else if(vix.changePct<-5)add(1,'VIX is falling, reducing immediate volatility pressure.');}
  if(oil){if(oil.changePct>1.5)add(-2,'Crude oil is rising sharply; this can pressure India through inflation/import costs.');else if(oil.changePct<-1.5)add(1,'Crude oil is falling, which can ease India macro pressure.');}
  if(dxy){if(dxy.changePct>0.5)add(-1,'Dollar strength can tighten conditions for emerging-market assets.');else if(dxy.changePct<-0.5)add(1,'Dollar weakness can ease emerging-market pressure.');}
  if(usdInr){if(usdInr.changePct>0.4)add(-1,'USD/INR is rising, signalling rupee pressure.');else if(usdInr.changePct<-0.4)add(1,'USD/INR is falling, signalling rupee support.');}
  if(us10){if(us10.changePct>1)add(-1,'US 10-year yield is rising.');else if(us10.changePct<-1)add(1,'US 10-year yield is easing.');}
  return {score,reasons,regime:score>=3?'RISK_ON':score<=-3?'RISK_OFF':'MIXED'};
}
function deriveLocalStructure(candidates){
  const usable=candidates.filter(x=>x.direction==='UP'||x.direction==='DOWN');
  const up=usable.filter(x=>x.direction==='UP').reduce((s,x)=>s+(Number(x.strength)||0),0);
  const down=usable.filter(x=>x.direction==='DOWN').reduce((s,x)=>s+(Number(x.strength)||0),0);
  const triggered=usable.filter(x=>x.status==='TRIGGERED');
  const direction=up-down>=3?'UP':down-up>=3?'DOWN':'NEUTRAL';
  return {direction,upScore:up,downScore:down,triggered};
}
export async function buildIntelligence({news,market}){
  const symbols=[
    ['SP500','S&P 500','^GSPC'],['NASDAQ','Nasdaq','^IXIC'],['VIX','VIX','^VIX'],
    ['DXY','US Dollar Index','DX-Y.NYB'],['OIL','Brent/Crude proxy','BZ=F'],
    ['GOLD','Gold','GC=F'],['US10Y','US 10Y yield','^TNX'],['USDINR','USD/INR','USDINR=X']
  ];
  async function fetchOne([id,name,symbol]){
    try{
      const u='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d&events=history';
      const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
      if(!r.ok)throw new Error(String(r.status));
      const j=await r.json(),c=j?.chart?.result?.[0],q=c?.indicators?.quote?.[0];
      const rows=(c?.timestamp||[]).map((t,i)=>({time:t*1000,close:q?.close?.[i]})).filter(x=>Number.isFinite(x.close));
      if(!rows.length)throw new Error('no data');
      const last=rows.at(-1),prev=rows.length>1?rows.at(-2):last;
      const changePct=prev.close?((last.close-prev.close)/prev.close)*100:0;
      return {id,name,symbol,value:last.close,changePct,trend:classifyTrend(changePct),updatedAt:last.time};
    }catch(e){return {id,name,symbol,error:e.message};}
  }
  const global=await Promise.all(symbols.map(fetchOne));
  const valid=global.filter(x=>Number.isFinite(x.value));
  const context=scoreContext(valid);
  const newsRegime=news?.regime||'MIXED';
  const combinedScore=context.score+(newsRegime==='RISK_ON'?2:newsRegime==='RISK_OFF'?-2:0);
  const globalDirection=combinedScore>=3?'UP':combinedScore<=-3?'DOWN':'NEUTRAL';
  const marketCandidates=(market?.candidates||[]).map(x=>({id:x.id,name:x.name,direction:x.analysis?.direction,status:x.analysis?.status,strength:x.analysis?.strength}));
  const local=deriveLocalStructure(marketCandidates);
  const conflict=globalDirection!=='NEUTRAL'&&local.direction!=='NEUTRAL'&&globalDirection!==local.direction;
  const direction=conflict?'NEUTRAL':local.direction!=='NEUTRAL'?local.direction:globalDirection;
  const confidence=Math.min(10,Math.max(1,5+Math.abs(combinedScore)));
  const reasons=[...context.reasons];
  if(newsRegime==='RISK_ON')reasons.push('News radar is in a risk-on regime.');
  if(newsRegime==='RISK_OFF')reasons.push('News radar is in a risk-off regime.');
  if(local.direction!=='NEUTRAL')reasons.push('Local index structure is '+local.direction.toLowerCase()+' across the active candidates.');
  if(conflict)reasons.push('Global and local evidence conflict, so the engine downgrades the combined scenario to WAIT.');
  const trigger=local.triggered[0];
  const scenario=conflict
    ? 'Global and local evidence conflict; wait for price confirmation instead of forcing a directional scenario.'
    : direction==='UP'
      ? 'Upside continuation is supported by the available global/local evidence, but price confirmation is still required.'
      : direction==='DOWN'
        ? 'Downside continuation is supported by the available global/local evidence, but price confirmation is still required.'
        : 'No aligned directional edge is confirmed; wait for a clearer catalyst and local price confirmation.';
  return {
    generatedAt:Date.now(),direction,confidence,scenario,globalDirection,localDirection:local.direction,
    localUpScore:local.upScore,localDownScore:local.downScore,conflict,
    invalidation:'Treat the scenario as invalid if the supporting evidence reverses or the relevant index loses its own trigger/VWAP structure.',
    alternative:conflict?'A confirmed local breakout aligned with the global regime can resolve the conflict.':direction==='UP'?'Risk-off news shock or failed breakout could produce a reversal.':direction==='DOWN'?'Positive macro/news shock or failed breakdown could produce a rebound.':'A strong catalyst plus a confirmed price breakout can replace the neutral scenario.',
    combinedScore,newsRegime,global,marketCandidates,reasons,
    trigger:trigger?{index:trigger.name,status:trigger.status,direction:trigger.direction}:null,
    disclaimer:'This is an evidence-weighted scenario engine, not a claim that the future can be known. Global context and local price structure are shown separately; confidence is not a probability of profit.'
  };
}