---
type: risk
title: Position sizing
tags: [risk, sizing, rules]
created: 2026-08-22
updated: 2026-08-22
status: n/a
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## The rule

```
Risk per share = |Entry − Stop|
Quantity       = min( floor(₹risk ÷ Risk per share), floor(Capital ÷ Entry) )
```

Two binding constraints: the **rupee risk** you're willing to lose, and the
**capital** you actually have. Whichever produces the smaller quantity wins.

## Defaults

| Parameter | Value |
|---|---|
| Planned risk per trade | ₹300 |
| Capital / buy turnover | ~₹1,00,000 |
| Normal reward objective | 2R–2.5R |

₹300 on ₹1 lakh is 0.3% of capital per trade — conservative by the common
0.5–1% heuristic, and deliberately so given the daily limit sits at only 2R.

## What follows from it

**Stop distance determines size, not conviction.** A tight stop buys size; a wide
one costs it. This is the mechanism by which [[atr]] volatility-scaling reduces
quantity in fast conditions without any separate rule.

**The capital constraint binds on expensive stocks.** At ₹300 risk and a ₹1.50
stop distance the risk formula wants 200 shares; on a ₹2,000 stock, ₹1 lakh buys
50. Below roughly ₹500, the risk term binds; above it, capital does. Worth
knowing which regime a candidate sits in before assuming a full-size position.

**The stop is set by structure first.** Sizing consumes the stop distance as an
input; it never justifies moving the stop closer to buy more shares. Widening a
stop after entry to avoid realising a loss is prohibited outright
([[2026-08-10-1-lakh-nse-intraday-framework|framework]]).

## See also

[[daily-loss-limit]] · [[atr]] · [[transaction-costs]] · [[expectancy]]
