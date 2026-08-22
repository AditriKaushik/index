---
type: source
title: ₹1 Lakh NSE Intraday Framework
tags: [framework, costs, risk, seed]
created: 2026-08-22
updated: 2026-08-22
published: 2026-08-10
sourced_on: 2026-08-10
raw: ../index.html
url: 
---

The framework page published in this repository. It is the seed source for this
wiki — every page created on 2026-08-22 derives from it. Self-described as
educational / back-testing material for a ~₹1 lakh NSE cash-equity intraday
account on Paytm Money or IIFL Online Plus.

## What it says

**The objective is framed as a ceiling, not a quota.** +1% net is a
stop-trading objective on favourable days. The page states plainly that a 1%
daily return cannot be guaranteed, and that a stop order does not guarantee the
exit price.

**Risk is subordinating.** The daily loss limit outranks the daily objective.
Defaults: ₹300 planned risk per trade, ₹600 daily planned loss limit, 2–3 trades
maximum, 2R–2.5R normal reward objective, new entries preferred ~09:30–14:45.
Three stop conditions: +₹1,000 net reached, −₹600 reached, or no A-grade setup
(a ₹0 day is explicitly valid).

**An eight-condition A-grade long checklist** — broad market constructive and
not whipsawing VWAP; stock above VWAP with positive short-term structure; 9 EMA
above 20 EMA; RSI(14) roughly 55–70 as confirmation only; positive relative
strength vs Nifty; stronger-than-normal participation on the breakout; the level
or VWAP holds on retest with no extended-candle chase; realistic target at least
2× planned risk. Shorts reverse the directional conditions. The page calls these
"filters to test, not guarantees".

**Workflow**: 09:15–09:30 establish the opening range and avoid opening noise;
identify regime (trending / ranging / choppy); screen only very liquid stocks
with relative strength and participation; wait for a defined breakout close, not
a one-tick breach; prefer a hold or retest of the level or VWAP; write entry,
stop, quantity, rupee risk, target and estimated costs before ordering; never
widen a stop to avoid realising a loss.

**Sizing formula**: `Quantity = min( floor(₹risk ÷ |Entry − Stop|), floor(Capital ÷ Entry) )`.

**ATR stop idea**: back-test a stop around 0.75–1.0 × 5-minute ATR(14), but only
where that stop also sits beyond a valid structure invalidation. Higher
volatility should reduce quantity.

**Relative strength**: RS = stock intraday return % − Nifty intraday return %,
with a suggested back-testing threshold of about ±0.30%.

**Evaluation standard**: 100+ trades, judged on net expectancy, profit factor,
max drawdown and R multiples, with slippage included. Worked example — 45% wins
× ₹750 average winner − 55% losses × ₹275 average loser = ₹186.25 gross
expectancy per trade; at ₹75 average costs/slippage, ₹111.25 net.

## Numbers and rates

Cost model for NSE cash-equity intraday, as implemented in the page's calculator
(`sourced_on: 2026-08-10` — verify before live use):

| Component | Rate |
|---|---|
| STT | 0.025%, sell side only |
| Stamp duty | 0.003%, buy side only |
| NSE transaction charge | ₹2.97 per lakh, each side |
| SEBI turnover fee | ₹10 per crore (0.0001%) |
| GST | 18% on brokerage + NSE transaction + SEBI fee |
| Brokerage — Paytm Money | min(0.025% × turnover, ₹20) per side |
| Brokerage — IIFL Online Plus | 0.025% × turnover per side |

## Tax treatment

Intraday share transactions settled without delivery are generally treated as
**speculative transactions** for income tax; ITR-3 materials capture
intraday/speculative business income separately. The page warns against
subtracting a universal tax percentage per trade, and defers to a qualified
professional.

## Cited authorities

NSE (SEBI turnover fees, stamp duty, GST, STT); NSE circular on the ₹2.97/lakh
cash-market transaction charge; Paytm Money stocks pricing; IIFL Capital
brokerage charges; SEBI's finding that 7 of 10 individual intraday cash-equity
traders made losses; Income Tax Section 43 speculative-transaction definition;
ITR-3 2026.

## Bearing on the wiki

Seeded [[transaction-costs]], [[position-sizing]], [[daily-loss-limit]],
[[expectancy]], [[vwap]], [[relative-strength]], [[atr]], [[opening-range]],
[[a-grade-long-breakout]] and [[nifty-50]].

## Open threads

Every edge claim here is explicitly untested — the page presents filters to
back-test, not validated results. The 100-trade sample it calls for does not
exist yet. See [[open-questions]].
