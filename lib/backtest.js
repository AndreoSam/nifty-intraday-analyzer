import { analyze } from '@/lib/analysis';

/**
 * Conservative candle-based simulation.
 * Signal is computed only from candles that have already closed.
 * Entry is the following candle open. If stop and target are both touched
 * inside one candle, the stop is assumed to fill first.
 */
export function backtest(rows, options = {}) {
  const { maxHoldBars = 12, maxTrades = 100, startIndex = 55, endIndex = rows.length - 1, maxReturnedTrades = 20 } = options;
  const trades = [];
  let i = Math.max(55, startIndex);

  while (i < Math.min(rows.length - 1, endIndex) && trades.length < maxTrades) {
    let signal;
    try {
      signal = analyze(rows.slice(0, i + 1));
    } catch {
      i += 1;
      continue;
    }

    if (signal.status !== 'TRIGGERED' || !Number.isFinite(signal.trigger) ||
        !Number.isFinite(signal.stop) || !Number.isFinite(signal.target)) {
      i += 1;
      continue;
    }

    const direction = signal.direction === 'UP' ? 1 : -1;
    const entryIndex = i + 1;
    const entry = rows[entryIndex].open;
    const risk = Math.abs(entry - signal.stop);
    const gapInvalid = direction === 1 ? (entry <= signal.stop || entry >= signal.target) : (entry >= signal.stop || entry <= signal.target);
    if (!(risk > 0) || !Number.isFinite(entry) || gapInvalid) {
      i += 1;
      continue;
    }

    let exit = null;
    let exitIndex = Math.min(rows.length - 1, entryIndex + maxHoldBars - 1);
    let exitReason = 'TIME_EXIT';

    for (let j = entryIndex; j <= exitIndex; j++) {
      const candle = rows[j];
      const stopHit = direction === 1 ? candle.low <= signal.stop : candle.high >= signal.stop;
      const targetHit = direction === 1 ? candle.high >= signal.target : candle.low <= signal.target;

      // Conservative tie-break when OHLC candles cannot reveal intrabar order.
      if (stopHit) {
        exit = signal.stop;
        exitIndex = j;
        exitReason = targetHit ? 'STOP_AND_TARGET_SAME_CANDLE_STOP_ASSUMED' : 'STOP';
        break;
      }
      if (targetHit) {
        exit = signal.target;
        exitIndex = j;
        exitReason = 'TARGET';
        break;
      }
    }

    if (exit === null) exit = rows[exitIndex].close;
    const points = (exit - entry) * direction;
    trades.push({
      direction: signal.direction,
      signalTime: rows[i].time,
      entryTime: rows[entryIndex].time,
      exitTime: rows[exitIndex].time,
      entry,
      exit,
      stop: signal.stop,
      target: signal.target,
      exitReason,
      points,
      rMultiple: points / risk,
      holdingBars: exitIndex - entryIndex + 1
    });

    // One position at a time: do not open another until this one exits.
    i = Math.max(i + 1, exitIndex + 1);
  }

  const wins = trades.filter(t => t.points > 0);
  const losses = trades.filter(t => t.points < 0);
  const grossProfit = wins.reduce((s, t) => s + t.points, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.points, 0));
  const netPoints = trades.reduce((s, t) => s + t.points, 0);
  const avgR = trades.length ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length : 0;
  let equity = 0, peak = 0, maxDrawdown = 0;
  for (const t of trades) {
    equity += t.points;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  return {
    tradeCount: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? wins.length / trades.length * 100 : 0,
    netPoints,
    averagePoints: trades.length ? netPoints / trades.length : 0,
    averageR: avgR,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    maxDrawdownPoints: maxDrawdown,
    dataBars: rows.length,
    firstBar: rows[0]?.time ?? null,
    lastBar: rows[rows.length - 1]?.time ?? null,
    trades: trades.slice(-maxReturnedTrades).reverse()
  };
}
