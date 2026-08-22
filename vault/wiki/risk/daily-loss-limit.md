---
type: risk
title: Daily rules and loss limit
tags: [risk, rules, discipline]
created: 2026-08-22
updated: 2026-08-22
status: n/a
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---

## The governing principle

> Risk first: the daily objective is subordinate to the daily loss limit.

The +1% objective is a **stop-trading condition on good days**, not a quota to be
met. The seed source states outright that a 1% daily return cannot be
guaranteed.

## The defaults

| Rule | Value |
|---|---|
| Planned risk per trade | ₹300 |
| Daily planned loss limit | ₹600 |
| Maximum trades | 2–3 |
| Preferred new-entry window | ~09:30–14:45 |

## Stop-trading triggers

Any one of these ends the session:

- **+₹1,000 net reached** — take the day.
- **−₹600 reached** — the limit is two full stops; there is no third.
- **No A-grade setup** — a ₹0 day is explicitly valid.

## Why the numbers interlock

₹600 ÷ ₹300 = exactly **two losing trades**. Against a 2–3 trade maximum, that
means a day can end on losses before the trade allowance is used — which is the
point. The loss limit binds first by construction.

The +₹1,000 / −₹600 asymmetry means one good day covers roughly 1.7 bad ones,
consistent with the 2R–2.5R reward objective in [[position-sizing]].

The 14:45 cutoff on *new* entries leaves room to manage an open position into
the close without opening fresh exposure into the final volatility.

## The prohibition that matters most

Never increase risk after a loss to recover the day. This is the one rule whose
violation compounds — it converts a ₹600 planned loss into an unplanned one, and
it is the failure mode behind SEBI's finding that 7 of 10 individual intraday
cash-equity traders lose money.

Log every violation in the trade post-mortem, honestly. `rule_violation: true`
is a field in the trade template for exactly this reason.

## See also

[[position-sizing]] · [[a-grade-long-breakout]] · [[expectancy]]
