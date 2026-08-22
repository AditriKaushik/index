---
type: setup
title: A-grade long breakout
tags: [breakout, vwap, long]
created: 2026-08-22
updated: 2026-08-22
status: untested
direction: long
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## Idea in one line

Long a liquid, relatively strong stock breaking a defined level above [[vwap]]
on above-normal participation, entered on the hold or retest rather than the
breach.

## Conditions

All eight must hold. The seed source calls these "filters to test, not
guarantees" ([[2026-08-10-1-lakh-nse-intraday-framework|framework]]).

1. Broad market ([[nifty-50]]) constructive, not repeatedly whipsawing through
   VWAP.
2. Stock above [[vwap]] with positive short-term structure.
3. 9 EMA above 20 EMA on the execution chart.
4. RSI(14) roughly 55–70 — **confirmation only**, never a trigger.
5. Positive [[relative-strength]] versus Nifty.
6. Stronger-than-normal participation / volume on the breakout.
7. The breakout level or VWAP **holds on a retest**; no extended-candle chase.
8. Realistic target offers at least 2× planned risk, net of
   [[transaction-costs]].

Shorts reverse conditions 1–5 and 8; the structural logic is unchanged.

## Sequence

Establish the [[opening-range]] 09:15–09:30 without trading it. Identify the
regime — trending, ranging, or choppy. Screen only very liquid names showing RS
and participation. Wait for a defined breakout *close*, not a one-tick breach.
Prefer the hold or retest. Then write entry, stop, quantity, rupee risk, target
and estimated costs down **before** placing the order.

## Invalidation

The structural level that defined the breakout. [[atr]] offers a distance
candidate (0.75–1.0 × 5-min ATR(14)) but only where it sits beyond that level —
volatility does not override structure. The stop is never widened after entry.

## Target and sizing

2R–2.5R normal objective; condition 8 makes 2R a hard entry filter rather than a
hope. [[position-sizing]] converts the stop distance into quantity at ₹300
planned risk.

## Evidence

**None.** `status: untested`. No sample has been run against the
[[expectancy]] standard (100+ trades, net of costs and slippage). Every number
on this page is a starting parameter to be tested, not a result.

## Failure modes to watch for

- **Condition 7 is the discretionary one.** "Holds on a retest" has no
  mechanical definition, and it is the condition most likely to be rationalised
  in the moment.
- **Eight simultaneous filters is a lot.** Either A-grade setups are genuinely
  rare — in which case ₹0 days are the norm and that must be accepted — or the
  filters get quietly relaxed to manufacture trades. Which of these happens is
  worth measuring directly.
- **Conditions 2, 3 and 5 are correlated.** A stock above VWAP with 9 > 20 EMA
  usually has positive RS. Three filters, less than three filters' worth of
  independent information.

## See also

[[daily-loss-limit]] · [[vwap]] · [[relative-strength]] · [[atr]] ·
[[opening-range]]
