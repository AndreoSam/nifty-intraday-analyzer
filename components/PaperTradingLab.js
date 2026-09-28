'use client';
import {useEffect,useState} from 'react';
import {RefreshCw,TriangleAlert} from 'lucide-react';

const n=v=>Number.isFinite(Number(v))?Number(v).toFixed(2):'—';
export default function PaperTradingLab(){
 const [d,setD]=useState(null),[loading,setLoading]=useState(false),[err,setErr]=useState('');
 const load=async()=>{setLoading(true);setErr('');try{const r=await fetch('/api/paper-trading',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Paper trading sync failed');setD(j)}catch(e){setErr(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load();const id=setInterval(load,300000);return()=>clearInterval(id)},[]);
 if(d&&!d.configured)return <section className="validationPanel paperLab"><div className="validationHead"><div><p className="eyebrow">PAPER TRADING ENGINE</p><h2>Persistent performance ledger</h2><p className="muted">The engine is wired, but the server database is not configured yet.</p></div><button onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div><div className="smallWarning">{d.message}</div><p className="validationNote">The browser-only prediction ledger remains separate. Once the server database is configured, actionable signals, exits, R-multiples and strategy health will survive refreshes and devices.</p></section>;
 const open=d?.open||[],closed=d?.closed||[],health=Object.values(d?.health||{}),wins=closed.filter(x=>Number(x.r_multiple)>0).length,avg=closed.length?closed.reduce((s,x)=>s+Number(x.r_multiple||0),0)/closed.length:0;
 return <section className="validationPanel paperLab"><div className="validationHead"><div><p className="eyebrow">PAPER TRADING ENGINE</p><h2>Persistent performance ledger</h2><p className="muted">Server-side 15-minute paper trades with automatic strategy health gates.</p></div><button onClick={load} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/>{loading?'Syncing…':'Sync now'}</button></div>
 {err&&<div className="error"><TriangleAlert size={17}/>{err}</div>}
 {d&&<><div className="backtestStats paperStats"><div><span>Closed trades</span><strong>{closed.length}</strong></div><div><span>Directional win rate</span><strong>{closed.length?(wins/closed.length*100).toFixed(1)+'%':'—'}</strong></div><div><span>Average R</span><strong>{n(avg)}R</strong></div><div><span>Open trades</span><strong>{open.length}</strong></div></div>
 <div className="strategyRows">{health.map(h=><div className="strategyRow" key={h.strategyId}><b>{h.strategy||h.strategyId}</b><span>{h.sample} trades</span><span>{n(h.averageR)}R</span><span className={'health '+h.status}>{h.status}</span></div>)}</div>
 <div className="ledgerList">{open.slice(0,8).map(t=><div className="ledgerRow" key={t.id}><span>{t.index_name}</span><strong className={t.direction==='UP'?'positive':'negative'}>{t.direction}</strong><span>{t.strategy}</span><span>Entry {n(t.entry_price)}</span><b className="ledgerStatus OPEN">OPEN</b></div>)}</div>
 <p className="validationNote">A strategy is automatically disabled for new paper entries when recent evidence fails the health gates; it can recover after later paper results improve. This is not a live broker execution system.</p></>}</section>
}
