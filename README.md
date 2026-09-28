# Index Setup Scanner

A Next.js intraday index scanner using Yahoo Finance chart candles. It scans NIFTY 50, BANK NIFTY, FINNIFTY and MIDCPNIFTY and hides weak/mixed setups.

## What it shows
- 5-minute or 15-minute candles across the supported index feed symbols.
- Directional bias based on EMA alignment, session VWAP, RSI, recent momentum, range breakout and available volume confirmation.
- Only candidate setups are shown; weak/mixed setups are filtered out.
- WATCH vs TRIGGERED status, breakout trigger, ATR-based planning target/stop, supporting reasons and cautions.

## Historical validation

The dashboard includes a historical-validation panel. It evaluates the current trigger rules on available 15-minute candles over Yahoo Finance's historical window (up to 60 days), with signal decisions based only on closed candles and entries at the next candle's open. It permits one open simulated trade at a time, uses a 12-bar maximum holding period, and assumes the stop fills first if a candle touches both stop and target. It reports trade count, win rate, net index points, average R, profit factor, and maximum drawdown.

This is a basic falsification tool, not proof of a profitable strategy. The sample can be small, the data feed can be incomplete, and OHLC candles cannot establish intrabar order or realistic fills. It tests spot-index points, not options. It excludes brokerage, STT, GST, exchange charges, bid/ask spread, slippage, latency, and option time decay/IV. Do not interpret its results as expected returns or a forecast. The next research step is a longer, broker-grade dataset, explicit costs, walk-forward out-of-sample evaluation, and forward paper trading before live use.

## Research principles

- Avoid look-ahead bias: only use data available at the decision time.
- Separate strategy development from chronological out-of-sample evaluation; do not repeatedly tune against the same test period.
- Include realistic execution costs and test whether any edge survives them.
- Track drawdown and trade count alongside win rate; a high win rate alone is not sufficient.
- Treat the scanner's confluence score as a rule-based score, not a probability of success.

## Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Important limitations
This is a transparent heuristic scanner, not a trained or backtested predictive model. Its confluence score is not a win probability. Yahoo Finance data may be delayed, incomplete, or unavailable. Index spot levels are not option premiums, and the app does not place orders. Confirm candle closes, contract availability, option liquidity, expiry, and risk independently before making any trade. No target or stop is guaranteed.
