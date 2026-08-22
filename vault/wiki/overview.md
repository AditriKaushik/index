---
type: meta
title: Overview
tags: [synthesis]
created: 2026-08-22
updated: 2026-08-22
status: n/a
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

The current synthesis. Rewritten as sources accumulate — read this first, then
follow links.

## Where the wiki stands

**One source, zero evidence.** Everything here derives from the
[[2026-08-10-1-lakh-nse-intraday-framework|₹1 Lakh NSE Intraday Framework]]
(10 Aug 2026), which is a *design* for a trading process, not a record of one
working. Every edge claim carries `status: untested`. Nothing in this wiki has
been measured yet.

That is the honest state, and it should stay visible at the top of this page
until a back-test changes it.

## The shape of the framework

A ~₹1 lakh NSE cash-equity intraday process built risk-first:

- **Risk outranks return.** ₹300 planned risk per trade, ₹600 daily limit — two
  stops and the day is over. The +1% objective is a *stop-trading* condition,
  not a quota. See [[daily-loss-limit]].
- **Size is derived, never chosen.** Quantity falls out of stop distance and
  capital, so a wider stop mechanically cuts exposure. See [[position-sizing]].
- **One long setup, eight filters.** [[a-grade-long-breakout]] — above
  [[vwap]], 9 > 20 EMA, RSI(14) 55–70 as confirmation, positive
  [[relative-strength]], above-normal participation, entered on the retest, and
  only if the target clears 2R net.
- **Costs are a first-order term.** See [[transaction-costs]] — the seed
  source's own illustration has them consuming 40% of gross expectancy.
- **A defined bar for acceptance.** 100+ trades, net expectancy, profit factor,
  max drawdown, R multiples, slippage included. See [[expectancy]].

## What the framework gets right, structurally

The loss limit binds before the trade allowance does, by construction. Sizing
cannot be argued with. The target filter is applied *net* of costs, which is
where most retail frameworks quietly cheat. And a ₹0 day is explicitly valid —
the process does not require a trade to be taken.

## The load-bearing weaknesses

1. **No sample.** The single most important fact about this wiki.
2. **Condition 7 of the setup is discretionary.** "Holds on a retest" has no
   mechanical definition and is the likeliest thing to be rationalised live.
3. **Correlated filters.** Above-VWAP, 9 > 20 EMA and positive RS overlap
   substantially — eight conditions, fewer than eight independent constraints.
4. **Undefined windows.** RS has no stated measurement window; "repeatedly
   whipsawing" has no threshold. Neither is back-testable as written.
5. **Base rate is hostile.** SEBI: 7 of 10 individual intraday cash-equity
   traders lose money. Any thesis here has to beat that prior, not just look
   coherent.

Tensions between sources, once there is more than one, are tracked in
[[contradictions]].

## Next

The wiki cannot get more useful by adding more framework material. It needs
either measurement (a back-test sample) or genuinely new sources — broker cost
confirmations, SEBI studies, execution-quality data. See [[open-questions]].
