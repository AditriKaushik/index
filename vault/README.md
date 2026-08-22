# Vault — NSE intraday trading wiki

An LLM-maintained knowledge base, built on the
LLM Wiki pattern: you curate sources and ask questions,
the agent writes and maintains every page.

**Open this directory (`vault/`) as your Obsidian vault**, not the repo root.

## Layout

```
raw/     your sources. immutable — the agent reads, never writes
wiki/    the agent's output. summaries, concepts, setups, risk, trades
index.md catalog of every page — the retrieval layer
log.md   append-only chronology of what happened when
CLAUDE.md the schema — how the agent must behave in here
```

## Using it

**Add a source.** Drop a file in `raw/` and tell the agent to ingest it. It
reads the source, discusses the takeaways with you, writes a summary page, then
updates every affected page across the wiki and logs what changed. Supervised
one-at-a-time is the default — ask for batch mode if you're clearing a backlog.

**Ask a question.** The agent reads `index.md`, drills into the relevant pages,
and answers with citations. Good answers get filed back as new pages — that's
the point of the pattern. Explorations compound.

**Lint.** Ask for a health check periodically. It looks for contradictions,
stale rates, orphan pages, untested claims that have sat too long, and gaps
worth filling.

## The one convention worth knowing

Every page making a claim about edge carries a `status`:

`untested` → `backtested` → `live-validated`, or `rejected`.

Nothing moves to `backtested` without 100+ trades measured net of costs and
slippage. Rejected pages are kept, not deleted — why something failed is the
most valuable thing in a trading wiki.

Right now **everything is `untested`.** The wiki has one source: the framework
page in this repo, which is a design for a process, not evidence that it works.

## Obsidian setup

- **Graph view** is the real navigation — it shows hubs and orphans at a glance.
- **Web Clipper** (browser extension) converts articles to markdown; point it at
  `raw/`.
- **Attachments**: Settings → Files and links → Attachment folder path →
  `raw/assets/`. Then Settings → Hotkeys → "Download attachments for current
  file" → bind a key, so clipped images land on disk where the agent can read
  them.
- **Dataview** (plugin) queries the YAML frontmatter — e.g. every `untested`
  setup, or every page not updated in 90 days.

## Notes

Nothing in here is published. The GitHub Pages workflow uses an explicit file
allowlist, so `vault/` never reaches the deployed site.

This is educational and back-testing material, not investment advice.
