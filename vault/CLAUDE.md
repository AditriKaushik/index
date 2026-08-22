# Wiki schema — NSE intraday trading

This directory is an **LLM-maintained wiki**. A human curates sources and asks
questions; the agent writes and maintains every page under `wiki/`. This file is
the schema: it defines the layout, the conventions, and the workflows. Read it
before touching anything in this directory.

## Three layers

| Layer | Path | Who owns it |
|---|---|---|
| Raw sources | `raw/` | The human. **Immutable** — read from it, never write to it, never edit or "tidy" a source. |
| The wiki | `wiki/` | The agent. Create, update, cross-reference, and reorganise freely. |
| The schema | `CLAUDE.md` (this file) | Both, jointly. Propose changes when a convention stops fitting; don't rewrite it silently. |

`index.md` (catalog) and `log.md` (chronology) sit at the vault root and are
agent-maintained.

## Domain guardrails

This wiki is about discretionary NSE cash-equity intraday trading on a ~₹1 lakh
account. Some rules matter more here than in a general knowledge base:

1. **Never invent a number.** Statutory rates (STT, stamp duty, SEBI turnover
   fee, exchange charges, GST), broker tariffs, and any statistic must be traced
   to a source page. If a number is a guess or a modelling assumption, mark it
   inline as `(assumption)`.
2. **Every claim about edge carries a `status`.** A setup that sounds plausible
   is not a setup that works. See the `status` field below. Do not let an
   `untested` claim drift into the overview as though it were established.
3. **Rates and tariffs go stale.** Anything sourced from a broker tariff page or
   an exchange circular gets a `sourced_on` date, and the lint pass flags them
   after 6 months.
4. **This is educational / back-testing material, not investment advice.** Don't
   write pages in the register of a recommendation ("buy X"). Write them as
   hypotheses, rules, and evidence.
5. **Record losses as carefully as wins.** A wiki that quietly accumulates only
   the trades that worked is worse than no wiki.

## Directory map

```
vault/
├── CLAUDE.md            this schema
├── README.md            human-facing quickstart
├── index.md             catalog of every wiki page (agent-maintained)
├── log.md               append-only chronology (agent-maintained)
├── raw/                 immutable sources — articles, circulars, PDFs, exports
│   └── assets/          images downloaded alongside clipped sources
└── wiki/
    ├── overview.md      the current synthesis — start here
    ├── open-questions.md   what we don't know yet, ranked
    ├── contradictions.md   where sources disagree, unresolved
    ├── sources/         one page per ingested source
    ├── setups/          trade setups and entry patterns
    ├── instruments/     indices, stocks, sectors
    ├── concepts/        indicators, market structure, terminology
    ├── risk/            sizing, limits, costs, drawdown
    ├── regime/          dated notes on market state
    ├── trades/          post-mortems of actual trades
    └── _templates/      page skeletons — copy, don't link to these
```

## Page conventions

**Filenames** are lowercase kebab-case, one topic per file: `vwap.md`,
`opening-range-breakout.md`. Source pages are prefixed with their publication
date: `2026-08-10-nse-transaction-charge-circular.md`. Trade post-mortems use
`YYYY-MM-DD-symbol.md`.

**Every page opens with YAML frontmatter:**

```yaml
---
type: concept          # source | setup | instrument | concept | risk | regime | trade | meta
title: VWAP
tags: [indicator, intraday]
created: 2026-08-22
updated: 2026-08-22
status: backtested     # see below — omit on type: source and type: trade
sources: ["[[2026-08-10-1-lakh-nse-intraday-framework]]"]
---
```

`status` is the honesty field, and it is the one convention most worth being
strict about:

| status | meaning |
|---|---|
| `untested` | Plausible, read somewhere, never checked against data. The default. |
| `backtested` | Checked over a stated sample (record the sample size on the page). |
| `live-validated` | Held up in real trades with real costs and slippage. |
| `rejected` | Tested and failed. **Keep the page** — write down why it failed. |
| `n/a` | Definitional, not a claim about edge (e.g. "what STT is"). |

**Body structure** is loose, but concept/setup/risk pages should carry, in order:
a one-paragraph definition, the mechanics, what the sources say (with links),
current status and evidence, and a "See also" line. Keep pages short enough to
read in one screen; split rather than sprawl.

**Linking.** Use Obsidian wikilinks — `[[vwap]]` or `[[vwap|the VWAP page]]`.
Obsidian resolves by filename across folders, so no paths. Link generously: the
graph view is the navigation. Every page should have at least one inbound link
from somewhere other than `index.md`.

**Citation.** When a wiki page states something drawn from a source, link the
source page inline, not just in frontmatter: `STT is 0.025% on the sell side
([[2026-08-10-1-lakh-nse-intraday-framework|framework]])`.

## Workflows

### Ingest — one source at a time, supervised

The human drops a file into `raw/` and says to process it. The default mode is
**supervised**: stay in conversation, don't disappear for fifteen file writes.

1. Read the source in full. If it has local images in `raw/assets/`, read the
   text first, then view the images that matter.
2. **Discuss before writing.** Report the key takeaways and say which pages you
   expect to create or update, and what conflicts you noticed with what's
   already in the wiki. Wait for direction on emphasis.
3. Write `wiki/sources/<date>-<slug>.md` — a summary of what the source
   actually says, not what you think of it. Include a link or path back to the
   raw file.
4. Update every affected page: entity, concept, setup, and risk pages that this
   source strengthens, contradicts, or extends. A substantial source will touch
   5–15 pages. Bump `updated` on each; adjust `status` if the evidence moved.
5. Record disagreements in `[[contradictions]]` rather than silently
   overwriting the older claim, and note what would settle it.
6. Add any new gaps to `[[open-questions]]`.
7. Update `index.md` and append to `log.md`.
8. Report back: pages created, pages updated, contradictions raised.

*Batch mode* exists for backlogs — process the queue with less discussion, then
give one consolidated report. Ask before using it.

### Query — answer, then file the answer

1. Read `index.md` first to find candidate pages, then drill into them. Read
   `raw/` only when the wiki demonstrably lacks the detail.
2. Answer with citations to wiki pages (which in turn cite sources).
3. **Offer to file good answers back into the wiki.** A comparison, an analysis,
   a connection between two setups — that's a new page, not chat history. If the
   human accepts, write it, link it, index it, and log it as a `query` entry.
4. If the wiki couldn't answer, that's a finding: add it to
   `[[open-questions]]` and say what source would fill the gap.

### Lint — periodic health check

Run when asked. Report findings, then act on the ones approved:

- Contradictions between pages that aren't recorded in `[[contradictions]]`.
- Stale claims a newer source superseded.
- Tariffs, statutory rates, or circular-sourced numbers with a `sourced_on`
  older than 6 months.
- Orphan pages (no inbound links) and dead wikilinks.
- Concepts referenced repeatedly but with no page of their own.
- `untested` claims that have been sitting in the wiki long enough to deserve a
  back-test, and anything in `overview.md` resting on `untested` pages.
- Pages where `updated` is far behind the sources they cite.
- Gaps a web search or a specific document could fill.

## index.md and log.md

**`index.md` is content-oriented** — every wiki page listed under its category
with a wikilink, a one-line summary, and its `status`. It is the retrieval layer;
keep it accurate or queries degrade. Update it on every ingest.

**`log.md` is chronological and append-only.** Never rewrite past entries. Each
entry starts with a fixed-format heading so the file stays greppable:

```
## [2026-08-22] ingest | ₹1 Lakh NSE Intraday Framework
```

Operation is one of `ingest`, `query`, `lint`, `trade`, `schema`. Under the
heading: what changed, in a few lines. `grep "^## \[" log.md | tail -5` should
give a useful recent history.

## Conventions to keep

- Write in plain prose. No filler openers, no restating the question.
- Prefer editing an existing page over creating a near-duplicate; prefer
  splitting a bloated page over letting it sprawl.
- Don't delete a page because it turned out to be wrong — set
  `status: rejected` and write down what killed it. Negative results are the
  most valuable thing in a trading wiki.
- This vault is a git repo. Commit after an ingest or a lint pass, with the
  operation and source in the message.
