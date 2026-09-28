# Index Setup Scanner

A Next.js intraday index scanner using Yahoo Finance chart candles. It scans NIFTY 50, BANK NIFTY, FINNIFTY and MIDCPNIFTY and hides weak/mixed setups.

## What it shows
- 5-minute or 15-minute candles across the supported index feed symbols.
- Directional bias based on EMA alignment, session VWAP, RSI, recent momentum, range breakout and available volume confirmation.
- Only candidate setups are shown; weak/mixed setups are filtered out.
- WATCH vs TRIGGERED status, breakout trigger, ATR-based planning target/stop, supporting reasons and cautions.

## Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Important limitations
This is a transparent heuristic scanner, not a trained or backtested predictive model. Its confluence score is not a win probability. Yahoo Finance data may be delayed, incomplete, or unavailable. Index spot levels are not option premiums, and the app does not place orders. Confirm candle closes, contract availability, option liquidity, expiry, and risk independently before making any trade. No target or stop is guaranteed.
