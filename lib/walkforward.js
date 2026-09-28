import { backtest } from '@/lib/backtest';

/**
 * Rolling out-of-sample validation.
 * No future candles are available to a fold's signal calculation.
 * The current strategy parameters are not tuned on the test window.
 */
export function walkForward(rows, options = {}) {
  const {
    trainBars = 26 * 20,
    testBars = 26 * 5,
    stepBars = 26 * 5,
    maxFolds = 8
  } = options;

  const folds = [];
  let testStart = Math.max(55, trainBars);
  let fold = 0;

  while (testStart < rows.length - 1 && fold < maxFolds) {
    const testEnd = Math.min(rows.length - 1, testStart + testBars - 1);
    if (testEnd <= testStart) break;

    const result = backtest(rows.slice(0, testEnd + 1), {
      startIndex: testStart,
      endIndex: testEnd,
      maxTrades: 500,
      maxReturnedTrades: 500
    });

    folds.push({
      fold: fold + 1,
      trainBars: testStart,
      testBars: testEnd - testStart + 1,
      testStart: rows[testStart]?.time ?? null,
      testEnd: rows[testEnd]?.time ?? null,
      ...result,
      trades: result.trades
    });

    testStart += stepBars;
    fold += 1;
  }

  // backtest() returns its retained trades newest-first; restore chronological
  // order before calculating equity and drawdown across the stitched OOS sample.
  const trades = folds.flatMap(f => f.trades).sort((a, b) => {
    const at = new Date(a.entryTime).getTime();
    const bt = new Date(b.entryTime).getTime();
    return at - bt;
  });
  const wins = trades.filter(t => t.points > 0).length;
  const losses = trades.filter(t => t.points < 0).length;
  const netPoints = trades.reduce((sum, t) => sum + t.points, 0);
  const grossProfit = trades.filter(t => t.points > 0).reduce((sum, t) => sum + t.points, 0);
  const grossLoss = Math.abs(trades.filter(t => t.points < 0).reduce((sum, t) => sum + t.points, 0));
  let equity = 0, peak = 0, maxDrawdown = 0;
  for (const t of trades) {
    equity += t.points;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  const activeFolds = folds.filter(f => f.tradeCount > 0).length;
  const profitableFolds = folds.filter(f => f.tradeCount > 0 && f.netPoints > 0).length;

  return {
    trainBars,
    testBars,
    stepBars,
    foldCount: folds.length,
    tradeCount: trades.length,
    wins,
    losses,
    winRate: trades.length ? wins / trades.length * 100 : 0,
    netPoints,
    averagePoints: trades.length ? netPoints / trades.length : 0,
    averageR: trades.length ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    maxDrawdownPoints: maxDrawdown,
    activeFolds,
    profitableFolds,
    foldConsistency: activeFolds ? profitableFolds / activeFolds * 100 : 0,
    folds: folds.map(f => ({
      fold: f.fold,
      trainBars: f.trainBars,
      testBars: f.testBars,
      testStart: f.testStart,
      testEnd: f.testEnd,
      tradeCount: f.tradeCount,
      winRate: f.winRate,
      netPoints: f.netPoints,
      averageR: f.averageR
    }))
  };
}
