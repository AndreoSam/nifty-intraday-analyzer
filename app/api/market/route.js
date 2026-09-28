import {NextResponse} from 'next/server';
import {analyze} from '@/lib/analysis';
export const runtime='nodejs';
const INDEXES=[
 {id:'NIFTY',name:'NIFTY 50',symbol:'^NSEI'},
 {id:'BANKNIFTY',name:'BANK NIFTY',symbol:'^NSEBANK'},
 {id:'FINNIFTY',name:'FINNIFTY',symbol:'^CNXFINANCE'},
 {id:'MIDCPNIFTY',name:'NIFTY MIDCAP 50',symbol:'^NSEMDCP50'}
];
async function getChart(symbol,interval='5m',range='5d'){
 const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval='+interval+'&range='+range+'&events=history';
 const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});
 if(!res.ok)throw new Error('Market data source returned '+res.status);
 const j=await res.json();const r=j.chart&&j.chart.result&&j.chart.result[0];if(!r)throw new Error('No market data returned for '+symbol);
 const q=r.indicators.quote[0];return r.timestamp.map((t,i)=>({time:t*1000,open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i],volume:q.volume&&q.volume[i]||0})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite));
}
export async function GET(req){
 const {searchParams}=new URL(req.url);const interval=searchParams.get('interval')||'5m';
 if(!['5m','15m'].includes(interval))return NextResponse.json({error:'Unsupported interval'},{status:400});
 const results=await Promise.all(INDEXES.map(async index=>{try{const candles=await getChart(index.symbol,interval,'5d');return {...index,analysis:analyze(candles),error:null}}catch(e){return {...index,analysis:null,error:e.message}}}));
 const candidates=results.filter(x=>x.analysis&&x.analysis.status!=='NO TRADE');
 if(results.every(x=>!x.analysis))return NextResponse.json({error:'Could not load market data for the index list. Try again shortly.',details:results.map(x=>({index:x.name,error:x.error}))},{status:502});
 return NextResponse.json({interval,updatedAt:Date.now(),indexes:results,candidates,hiddenCount:results.filter(x=>x.analysis&&x.analysis.status==='NO TRADE').length});
}
