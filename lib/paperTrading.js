import {createClient} from '@supabase/supabase-js';

const URL=process.env.SUPABASE_URL;
const KEY=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
export const paperTradingConfigured=Boolean(URL&&KEY);

export function getPaperDb(){
  if(!paperTradingConfigured) return null;
  return createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

function stats(trades){
  const closed=trades.filter(t=>t.status==='CLOSED');
  const wins=closed.filter(t=>Number(t.r_multiple)>0);
  const losses=closed.filter(t=>Number(t.r_multiple)<0);
  const gp=wins.reduce((s,t)=>s+Number(t.r_multiple||0),0);
  const gl=Math.abs(losses.reduce((s,t)=>s+Number(t.r_multiple||0),0));
  let eq=0,peak=0,dd=0;
  for(const t of closed){eq+=Number(t.r_multiple||0);peak=Math.max(peak,eq);dd=Math.max(dd,peak-eq)}
  return {sample:closed.length,winRate:closed.length?wins.length/closed.length*100:0,averageR:closed.length?closed.reduce((s,t)=>s+Number(t.r_multiple||0),0)/closed.length:0,profitFactor:gl?gp/gl:(gp>0?null:0),maxDrawdownR:dd};
}

export function classifyPaperHealth(trades){
  const s=stats(trades);
  let status='DISABLED';
  if(s.sample>=20&&s.averageR>0&&s.profitFactor>1.02&&s.maxDrawdownR<8) status='WATCH';
  if(s.sample>=40&&s.averageR>0.05&&s.profitFactor>1.10&&s.maxDrawdownR<6) status='ACTIVE';
  return {...s,status,reason:status==='ACTIVE'?'Recent paper results clear the activation gates.':status==='WATCH'?'Recent results are positive but below the activation evidence threshold.':'Recent evidence is insufficient or negative; new signals from this strategy stay disabled.'};
}

export function choosePaperSignal(evaluation,healthByStrategy){
  if(evaluation?.quality?.state!=='ACTIONABLE') return null;
  const allowed=evaluation.signals.filter(s=>{
    const h=healthByStrategy[s.id];
    return !h||h.status!=='DISABLED';
  }).sort((a,b)=>b.score-a.score);
  if(!allowed.length) return null;
  const directions=[...new Set(allowed.map(s=>s.direction))];
  if(directions.length!==1) return null;
  return allowed[0];
}

export async function getStrategyHealth(db){
  if(!db) return {};
  const {data,error}=await db.from('paper_trades').select('strategy_id,strategy,status,r_multiple').eq('status','CLOSED').order('exit_time',{ascending:false}).limit(1000);
  if(error) throw error;
  const grouped={};
  for(const t of data||[]){(grouped[t.strategy_id]??=[]).push(t)}
  return Object.fromEntries(Object.entries(grouped).map(([id,rows])=>[id,{strategyId:id,strategy:rows[0]?.strategy,...classifyPaperHealth(rows.slice(0,100))}]));
}

export async function openPaperTrade(db,{indexId,indexName,candle,evaluation,signal}){
  const payload={
    index_id:indexId,index_name:indexName,strategy_id:signal.id,strategy:signal.name,
    regime:evaluation.regime?.mid?.id||'UNKNOWN',direction:signal.direction,
    signal_time:new Date(candle.time).toISOString(),entry_time:new Date(candle.time).toISOString(),
    entry_price:candle.close,trigger_price:signal.trigger,stop_price:signal.stop,target_price:signal.target,
    status:'OPEN',evidence_score:signal.score,metadata:{quality:evaluation.quality,regime:evaluation.regime}
  };
  const {data,error}=await db.from('paper_trades').insert(payload).select().single();
  if(error) throw error;
  return data;
}

export async function syncPaperTrade(db,rows,indexId,indexName,evaluation,healthByStrategy){
  if(!db||!rows?.length) return {opened:null,closed:0,skipped:null};
  const latest=rows.at(-1);
  const {data:open,error:openError}=await db.from('paper_trades').select('*').eq('index_id',indexId).eq('status','OPEN').order('entry_time',{ascending:false}).limit(20);
  if(openError) throw openError;
  let closed=0;
  for(const t of open||[]){
    const dir=t.direction==='UP'?1:-1;
    const hitStop=dir===1?latest.low<=t.stop_price:latest.high>=t.stop_price;
    const hitTarget=dir===1?latest.high>=t.target_price:latest.low<=t.target_price;
    const timedOut=Date.now()-new Date(t.entry_time).getTime()>=12*15*60*1000;
    if(!hitStop&&!hitTarget&&!timedOut) continue;
    const exitPrice=hitStop?t.stop_price:hitTarget?t.target_price:latest.close;
    const risk=Math.abs(t.entry_price-t.stop_price)||1;
    const r=((exitPrice-t.entry_price)*dir)/risk;
    const reason=hitStop?(hitTarget?'STOP_AND_TARGET_SAME_CANDLE_STOP_ASSUMED':'STOP'):hitTarget?'TARGET':'TIME_EXIT';
    const {error}=await db.from('paper_trades').update({status:'CLOSED',exit_time:new Date(latest.time).toISOString(),exit_price:exitPrice,exit_reason:reason,r_multiple:r,last_price:latest.close}).eq('id',t.id).eq('status','OPEN');
    if(error) throw error;
    closed++;
  }
  const signal=choosePaperSignal(evaluation,healthByStrategy);
  if(!signal) return {opened:null,closed,skipped:'NO_ACTIONABLE_SIGNAL'};
  const already=open?.some(t=>t.strategy_id===signal.id&&t.direction===signal.direction);
  if(already) return {opened:null,closed,skipped:'ALREADY_OPEN'};
  const opened=await openPaperTrade(db,{indexId,indexName,candle:latest,evaluation,signal});
  return {opened,closed,skipped:null};
}

export function healthFromRows(rows){
  const grouped={};
  for(const t of rows||[]){if(t.status!=='CLOSED')continue;(grouped[t.strategy_id]??=[]).push(t)}
  return Object.fromEntries(Object.entries(grouped).map(([id,ts])=>[id,{strategyId:id,strategy:ts[0]?.strategy,...classifyPaperHealth(ts.slice(0,100))}]));
}
