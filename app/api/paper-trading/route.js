import {NextResponse} from 'next/server';
import {getPaperDb,paperTradingConfigured,getStrategyHealth,syncPaperTrade,healthFromRows} from '@/lib/paperTrading';
import {evaluateStrategies} from '@/lib/strategies';

export const runtime='nodejs';
const INDEXES=[['NIFTY','NIFTY 50','^NSEI'],['BANKNIFTY','BANK NIFTY','^NSEBANK'],['FINNIFTY','FINNIFTY','^CNXFINANCE'],['MIDCPNIFTY','NIFTY MIDCAP 50','^NSEMDCP50']];

async function getChart(symbol){
  const u='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=15m&range=10d&events=history';
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});
  if(!r.ok) throw Error('Market data source returned '+r.status);
  const j=await r.json(),x=j.chart?.result?.[0];
  if(!x) throw Error('No historical candles returned');
  const q=x.indicators.quote[0];
  return x.timestamp.map((t,i)=>({time:t*1000,open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i],volume:q.volume?.[i]||0})).filter(c=>[c.open,c.high,c.low,c.close].every(Number.isFinite));
}

export async function GET(){
  if(!paperTradingConfigured)return NextResponse.json({configured:false,generatedAt:Date.now(),indexes:[],health:{},open:[],closed:[],message:'Paper-trading persistence is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY on the server.'});
  try{
    const db=getPaperDb();
    const health=await getStrategyHealth(db);
    const indexes=await Promise.all(INDEXES.map(async([id,name,symbol])=>{
      try{
        const rows=await getChart(symbol);
        const evaluation=evaluateStrategies(rows);
        const sync=await syncPaperTrade(db,rows,id,name,evaluation,health);
        return {id,name,evaluation,sync,error:null};
      }catch(e){return{id,name,error:e?.message||'Paper sync failed'}};
    }));
    const {data:trades,error}=await db.from('paper_trades').select('*').order('entry_time',{ascending:false}).limit(250);
    if(error) throw error;
    const refreshedHealth=healthFromRows(trades||[]);
    return NextResponse.json({configured:true,generatedAt:Date.now(),indexes,health:refreshedHealth,open:(trades||[]).filter(t=>t.status==='OPEN').slice(0,50),closed:(trades||[]).filter(t=>t.status==='CLOSED').slice(0,100),methodology:'Server-side paper trading uses closed 15-minute candles, enters at the latest closed candle price, checks stop before target on same-candle conflicts, uses a 12-bar maximum hold, and records R-multiples. It is a research ledger, not live order execution.'});
  }catch(e){return NextResponse.json({error:e?.message||'Paper trading sync failed',configured:true},{status:502})}
}
