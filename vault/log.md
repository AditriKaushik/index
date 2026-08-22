# Log

Append-only chronology. Never rewrite past entries. Each heading follows
`## [YYYY-MM-DD] operation | subject` so the file stays greppable:

```
grep "^## \[" log.md | tail -5
```

Operations: `ingest` · `query` · `lint` · `trade` · `schema`

---

## [2026-08-22] schema | Vault created

Instantiated the LLM Wiki pattern for NSE intraday trading. Wrote `CLAUDE.md`
(three layers, page conventions, the `status` honesty field, ingest/query/lint
workflows), `README.md`, `index.md`, this log, and four page templates.
Directory layout: `raw/` immutable, `wiki/` agent-owned with sources, setups,
instruments, concepts, risk, regime and trades.

Domain guardrails set: never invent a number; every edge claim carries a
`status`; tariffs and statutory rates carry `sourced_on` and expire at 6 months;
rejected ideas keep their pages.

## [2026-08-22] ingest | ₹1 Lakh NSE Intraday Framework

Seed ingest, from the framework page in this repository (`../index.html`,
prepared 10 Aug 2026).

**Created (11 pages):** [[2026-08-10-1-lakh-nse-intraday-framework]] ·
[[overview]] · [[open-questions]] · [[contradictions]] ·
[[a-grade-long-breakout]] · [[position-sizing]] · [[daily-loss-limit]] ·
[[transaction-costs]] · [[vwap]] · [[relative-strength]] · [[atr]] ·
[[opening-range]] · [[expectancy]] · [[nifty-50]]

**Status assigned:** everything touching edge is `untested` — the source is a
design for a process, not a record of one working. No sample exists.

**Raised:** 10 open questions, 3 of them blocking (no back-test sample; RS
measurement window undefined; "repeatedly whipsawing through VWAP" has no
threshold). One tension logged in [[contradictions]] between the 1% objective
and SEBI's 7-in-10 base rate.
