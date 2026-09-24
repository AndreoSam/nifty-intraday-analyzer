# NIFTY Intraday Analyzer — v0.1

A small Next.js dashboard for educational intraday analysis of NIFTY 50.

## What it does
- Pulls 5-minute or 15-minute NIFTY 50 candles from Yahoo Finance's chart feed.
- Calculates EMA 9/20/50, RSI(14), VWAP and ATR.
- Shows recent support/resistance.
- Produces heuristic bullish/bearish/sideways scenario percentages.
- Keeps the logic transparent so it can later be replaced with a backtested historical-pattern model.

## Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Important
This is a prototype, not a trading system. The scenario percentages are heuristic and must be backtested before real-money use. Market-data availability can change.

## Next version
Add NSE/BSE or broker API as the primary source, persistent candle storage, historical pattern matching, backtesting, Bank NIFTY/NIFTY FIN SERVICE tabs, alerts, and a model accuracy page.
