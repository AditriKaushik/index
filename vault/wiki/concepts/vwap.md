---
type: concept
title: VWAP
tags: [indicator, intraday, structure]
created: 2026-08-22
updated: 2026-08-22
status: n/a
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## Definition

Volume-Weighted Average Price — the average price of the session weighted by
volume traded at each price. It resets daily, which is what makes it an intraday
reference rather than a trend indicator.

## Mechanics

Cumulative (price × volume) ÷ cumulative volume, from the open. Early in the
session it is noisy and moves fast; by mid-morning it stabilises into a level
that a large share of the day's volume transacted around.

## How it's used here

Three distinct roles in [[a-grade-long-breakout]], worth keeping separate:

1. **A side filter** — longs require the stock trading above VWAP.
2. **A regime filter** — the broad market repeatedly whipsawing through VWAP is
   a reason to stand aside, not a reason to pick a side
   ([[2026-08-10-1-lakh-nse-intraday-framework|framework]]).
3. **A retest level** — a breakout that holds on a pullback to VWAP is preferred
   over chasing an extended candle.

## Caveats

VWAP's usefulness is asserted, not demonstrated, by the seed source. The
whipsaw filter in particular is a judgement call with no stated threshold — how
many crosses in what window counts as "repeatedly"? Logged in
[[open-questions]].

## See also

[[relative-strength]] · [[opening-range]] · [[a-grade-long-breakout]]
