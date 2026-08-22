---
type: meta
title: Open questions
tags: [meta]
created: 2026-08-22
updated: 2026-08-22
status: n/a
---

What the wiki doesn't know, roughly ranked by how much it blocks. Add to this on
every ingest and lint pass; strike items when a source or a test settles them.

Back to [[overview]].

## Blocking — nothing can be validated without these

1. **No back-test sample exists.** [[a-grade-long-breakout]] needs 100+ trades
   measured per the [[expectancy]] standard before its status can move off
   `untested`. Everything below is secondary to this.
2. **What is the RS measurement window?** [[relative-strength]] is defined as
   stock return − Nifty return but never says over what period. Since-open and
   trailing-30-minute RS are different signals; the ±0.30% threshold cannot
   transfer between them. Not back-testable until fixed.
3. **What counts as "repeatedly whipsawing through VWAP"?** Condition 1 of the
   setup is a veto with no threshold. How many crosses, in what window?

## Structural

4. **How often does an 8-of-8 A-grade setup actually occur?** If it's twice a
   month, the framework is a waiting game and the daily rules are near-moot. If
   it's daily, the filters are probably being read loosely. Measurable directly
   from historical data without any P&L.
5. **How much independent information do the eight filters carry?** Conditions
   2, 3 and 5 are plausibly near-duplicates. A correlation check would say
   whether the checklist can be shortened without loss.
6. **Which ATR multiplier and candle interval?** [[atr]] proposes 0.75–1.0 ×
   5-min ATR(14) with no basis. Two free parameters, no tested value.
7. **Is [[nifty-50]] the right benchmark for every candidate**, or should
   mid-caps be measured against a sector index?

## Costs and mechanics

8. **Are the statutory rates still current?** All of [[transaction-costs]] is
   `sourced_on: 2026-08-10`. Rates and tariffs change; confirm against NSE and
   the brokers directly.
9. **What is realistic slippage** on the liquid names actually being screened?
   [[expectancy]] requires it in the back-test and the framework offers no
   figure. Needs measurement from real fills, not an assumption.
10. **What does the account's real tax position look like?** Speculative-income
    treatment is noted but the framework deliberately doesn't model it. Not a
    per-trade cost — an annual one.

## Sources worth finding

- SEBI's study behind the "7 of 10 lose money" finding — the breakdown by
  turnover and holding period would be more useful than the headline.
- NSE circulars confirming current transaction charges.
- Anything on the base rate of intraday breakout failure in Indian large caps.
