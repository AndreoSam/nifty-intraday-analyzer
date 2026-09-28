import { NextResponse } from 'next/server';
import { backtest } from '@/lib/backtest';

export const runtime = 'nodejs';

const INDEXES = [
  { id: 'NIFTY', name: 'NIFTY 50', symbol: '^NSEI' },
  { id: 'BANKNIFTY', name: 'BANK NIFTY', symbol: '^NSEBANK' },
  { id: 'FINNIFTY', name: 'FINNIFTY', symbol: '^CNXFINANCE' },
  { id: 'MIDCPNIFTY', name: 'MIDCPNIFTY', symbol: '^NSEMDCP50' }
];

async function getChart(symbol) {
  // 15-minute candles permit a longer historical window on Yahoo's chart feed.
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=15m&range=60d&events=history';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Market data source returned ' + res.status);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error('No historical candles returned');
  const quote = result.indicators.quote[0];
  return result.timestamp.map((time, i) => ({
    time: time * 1000,
    open: quote.open[i],
    high: quote.high[i],
    low: quote.low[i],
    close: quote.close[i],
    volume: quote.volume?.[i] || 0
  })).filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite));
}

export async function GET() {
  const results = await Promise.all(INDEXES.map(async index => {
    try {
      const candles = await getChart(index.symbol);
      return { ...index, result: backtest(candles), error: null };
    } catch (error) {
      return { ...index, result: null, error: error?.message || 'Backtest failed' };
    }
  }));

  if (results.every(x => !x.result)) {
    return NextResponse.json({
      error: 'Historical data could not be loaded for any index.',
      indexes: results.map(({ name, error }) => ({ name, error }))
    }, { status: 502 });
  }

  return NextResponse.json({
    interval: '15m',
    range: '60d',
    generatedAt: Date.now(),
    methodology: 'Closed-candle signal; next-candle-open entry; stop-first when stop and target occur in the same candle; maximum 12 bars held; one position at a time.',
    disclaimer: 'This is a historical spot-index price simulation, not an option-premium or executable trading backtest. It excludes brokerage, taxes, spread, slippage, latency and market impact. Results are not a forecast.',
    indexes: results
  });
}
