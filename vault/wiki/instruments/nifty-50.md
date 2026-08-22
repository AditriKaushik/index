---
type: instrument
title: Nifty 50
tags: [index, benchmark]
created: 2026-08-22
updated: 2026-08-22
status: n/a
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## What it is

NSE's 50-stock large-cap benchmark index. In this framework it is not traded —
it is the reference against which everything else is measured.

## Its two roles here

**Benchmark for [[relative-strength]].** RS is defined as the stock's intraday
return minus Nifty's over the same window, threshold ≈ ±0.30% for back-testing.

**Regime filter.** Condition 1 of [[a-grade-long-breakout]] requires the broad
market to be constructive and not repeatedly whipsawing through [[vwap]]. A
choppy Nifty vetoes the trade regardless of how good the stock looks.

## Open question

Whether Nifty is the right benchmark for every candidate. A mid-cap or a stock
in a sector moving against the index may be better measured against its sector
index. Untested either way — see [[open-questions]].

## See also

[[relative-strength]] · [[a-grade-long-breakout]]
