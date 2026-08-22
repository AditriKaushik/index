---
type: risk
title: Transaction costs
tags: [costs, statutory, brokerage]
created: 2026-08-22
updated: 2026-08-22
status: n/a
sourced_on: 2026-08-10
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## Why this page ranks high

On a ₹1 lakh account targeting ~1%, costs are not a rounding error — they are a
first-order term. The seed source's own illustration has costs eating 40% of
gross [[expectancy]]. Any setup evaluated gross is evaluated wrong.

## Statutory and exchange components

NSE cash-equity **intraday** (no delivery). All figures
`sourced_on: 2026-08-10` — **verify before live use; these change.**

| Component | Rate | Applies to |
|---|---|---|
| STT | 0.025% | Sell side only |
| Stamp duty | 0.003% | Buy side only |
| NSE transaction charge | ₹2.97 per lakh | Each side |
| SEBI turnover fee | ₹10 per crore | Each side |
| GST | 18% | Brokerage + NSE transaction + SEBI fee |

GST does **not** apply to STT or stamp duty.

## Brokerage

| Broker | Intraday equity |
|---|---|
| Paytm Money | min(0.025% × turnover, ₹20) per side |
| IIFL Online Plus | 0.025% × turnover per side |

The cap is the whole difference: at turnovers above ₹80,000 per side Paytm's ₹20
cap binds and IIFL's uncapped percentage keeps climbing. At a ₹1 lakh position
that is roughly ₹20 vs ₹25 per side — small in absolute terms, but it recurs on
every one of 2–3 daily trades.

Tariffs are per-account and can differ from the published rate card.

## The break-even move

The framework's calculator solves for the gross percentage move needed to net a
given rupee amount after all of the above. That number, not the target price, is
what makes a trade worth taking: a setup whose realistic target is smaller than
the break-even move is a losing trade before it starts.

## Slippage

Not a charge, but belongs in the same bucket. The seed source is explicit that a
stop order does not guarantee the exit price, and that spread, gaps, news and
liquidity can enlarge losses beyond the planned stop. The evaluation standard in
[[expectancy]] therefore requires slippage to be included in any back-test.

## Tax

Intraday equity settled without delivery is generally a **speculative
transaction** for income tax (Section 43), reported separately in ITR-3. The
source warns specifically against modelling tax as a flat per-trade percentage —
it depends on the whole return. Not a per-trade cost; do not net it into
expectancy.

## See also

[[expectancy]] · [[position-sizing]] · [[daily-loss-limit]]
