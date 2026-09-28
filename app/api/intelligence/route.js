import {NextResponse} from 'next/server';
import {getNews} from '@/lib/news';
import {buildIntelligence} from '@/lib/intelligence';
import {analyze} from '@/lib/analysis';

export const runtime='nodejs';
const INDEXES=[
 {id:'NIFTY',name:'NIFTY 50',symbol:'^NSEI'},
 {id:'BANKNIFTY',name:'BANK NIFTY',symbol:'^NSEBANK'},
 {id:'FINNIFTY',name:'FINNIFTY',symbol:'^CNXFINANCE'},
 {id:'MIDCPNIFTY',name:'MIDCPNIFTY',symbol:'^NSEMDCP50'}
];
async function getChart(symbol){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=5m&range=5d&events=history';
 const r=await fetch(u,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0'}});
 if(!r.ok)throw new Error(String(r.status));
 const j=await r.json(),x=j?.chart?.result?.[0],q=x?.indicators?.quote?.[0];
 const rows=(x?.timestamp||[]).map((t,i)=>({time:t*1000,open:q?.open?.[i],high:q?.high?.[i],low:q?.low?.[i],close:q?.close?.[i],volume:q?.volume?.[i]||0})).filter(v=>[v.open,v.high,v.low,v.close].every(Number.isFinite));
 return analyze(rows);
}
export async function GET(){
 try{
   const [news,marketRows]=await Promise.all([
     getNews(),
     Promise.all(INDEXES.map(async x=>{try{return {...x,analysis:await getChart(x.symbol)}}catch(e){return {...x,analysis:null,error:e.message}}}))
   ]);
   const market={candidates:marketRows.filter(x=>x.analysis&&x.analysis.status!=='NO TRADE')};
   return NextResponse.json(await buildIntelligence({news,market}));
 }catch(e){
   return NextResponse.json({error:'Intelligence scan failed: '+e.message},{status:502});
 }
}