---
type: concept
title: Relative strength (intraday)
tags: [indicator, screening]
created: 2026-08-22
updated: 2026-08-22
status: untested
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## Definition

The stock's intraday return minus the index's intraday return, over the same
window. Positive RS means the stock is outperforming [[nifty-50]] right now.

```
RS = stock intraday return (%) − Nifty intraday return (%)
```

## How it's used here

A screening filter: only take longs in stocks showing positive RS, and shorts in
stocks showing negative RS. The seed source suggests a back-testing threshold of
about **±0.30%**, explicitly as a starting parameter rather than a finding
([[2026-08-10-1-lakh-nse-intraday-framework|framework]]).

## Caveats

The measurement window is unspecified — RS since the open behaves differently
from RS over the last 30 minutes, and the threshold that works for one will not
transfer to the other. Nailing that down is a prerequisite for any back-test
that uses this filter.

`status: untested` — no sample has been run.

## See also

[[a-grade-long-breakout]] · [[vwap]] · [[nifty-50]]
