---
type: concept
title: ATR (Average True Range)
tags: [indicator, volatility, stops]
created: 2026-08-22
updated: 2026-08-22
status: untested
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## Definition

The average of the true range — the greatest of (high − low), |high − previous
close|, |low − previous close| — over a lookback period. Here: ATR(14) on
5-minute candles.

## How it's used here

As a **stop-distance candidate**, not a stop rule. The seed source proposes
back-testing a stop around **0.75–1.0 × 5-minute ATR(14)**, with an important
qualifier: only where that distance also lies beyond a valid structural
invalidation ([[2026-08-10-1-lakh-nse-intraday-framework|framework]]). A stop
that is merely volatility-scaled but sits inside the level being traded is not
an acceptable stop.

The second-order effect matters more than the stop itself: because
[[position-sizing]] divides fixed rupee risk by stop distance, a wider ATR
automatically cuts quantity. Volatility scaling is therefore doing sizing work,
not just stop work.

## Caveats

Two free parameters (the multiplier and the candle interval) and no tested
value for either. `status: untested`.

## See also

[[position-sizing]] · [[a-grade-long-breakout]]
