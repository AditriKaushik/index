---
type: concept
title: Expectancy and the evaluation standard
tags: [statistics, backtesting, evaluation]
created: 2026-08-22
updated: 2026-08-22
status: n/a
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## Definition

Expected rupee outcome per trade.

```
Gross expectancy = (Win% × Avg win) − (Loss% × Avg loss)
Net expectancy   = Gross expectancy − average charges and slippage
```

Net expectancy is the only version that decides anything. The gap between the
two is [[transaction-costs]], and on a ₹1 lakh account that gap is large enough
to invert a strategy's sign.

## The evaluation standard

The seed source sets a specific bar for accepting any setup
([[2026-08-10-1-lakh-nse-intraday-framework|framework]]):

- **100+ trades** in the sample
- judged on **net expectancy, profit factor, max drawdown, R multiples**
- **slippage included**

Supporting definitions: profit factor = gross wins ÷ gross losses; R multiple =
trade P&L ÷ initial planned risk; max drawdown = largest peak-to-trough decline.

## Worked example

45% wins × ₹750 average winner − 55% losses × ₹275 average loser = **₹186.25**
gross expectancy per trade. At ₹75 average costs and slippage, **₹111.25** net —
costs consume 40% of the edge in this illustration.

Note this is the source's illustration, not a measured result. No sample exists.

## Why it governs the wiki

This standard is what the `status` field in the schema encodes. A setup moves
from `untested` to `backtested` when it has been measured this way, and no
sooner.

## See also

[[transaction-costs]] · [[position-sizing]] · [[open-questions]]
