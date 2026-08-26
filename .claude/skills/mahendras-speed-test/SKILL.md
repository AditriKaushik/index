---
name: mahendras-speed-test
description: Produce a Mahendra's Speed Test question paper (BANK / SSC / any stream) in the exact house print format - A4, two-column parallel bilingual layout, grey section banners, running header and chevron footer. Use whenever asked to create, draft or typeset a speed test, ST-xx paper, mock paper or practice set for Mahendra's. Only the content changes between papers; the format is fixed by this skill.
---

# Mahendra's Speed Test — house format

The layout is **fixed**. A new paper changes the content and the masthead strings, nothing else.
Everything in `reference/house-style.md` was measured off the 2026 production PDFs
(`BANK GENERAL ST-30`, `SSC GENERAL ST-30`) — treat those numbers as the spec, not as suggestions.

## Workflow

1. **Read `reference/house-style.md` first.** It carries the measured geometry, fonts, colours
   and the per-stream option conventions. Do not re-derive them.
2. **Write the content** as a JS module — copy `example/bank-st30.js` and replace the items.
   Content only: no styling, no layout, no page breaks.
3. **Render**: `npm install` once, then `node scripts/build.mjs <content.js> <out.pdf>`
   (needs Node 18+ and a Chromium; set `CHROME_PATH` if it is not on the usual paths).
4. **Verify** with `node scripts/verify.mjs <content.js>` — it checks question counts per section,
   option counts, missing Hindi, and duplicate answers. Fix what it reports.
5. **Look at the PDF.** Render pages to images and read them. Layout bugs (a question split badly
   across a page, a Hindi cell overflowing) are invisible in the content file.

## The two section modes — this is the rule people get wrong

| Section | Mode | Layout |
|---|---|---|
| English Language | `flow` | **English only**, text flows continuously left column → right column |
| Reasoning, Maths, GA / GS | `parallel` | **English left, Hindi right**, aligned question-for-question |

In `parallel` mode the same question number appears in *both* columns at the same vertical
position. It is not one long bilingual stream — it is two synchronised columns.

## Stream differences

|  | BANK | SSC |
|---|---|---|
| Options | `(1) (2) (3) (4) (5)` — five | `(A) (B) (C) (D)` — four |
| Negative marking | `1/4` | `0.25` |
| Fourth section | `GA` | `G.S.` |
| Masthead subtitle | `(FOR ALL BANK, INSURANCE & RELATED EXAMS)` | none |
| Fifth option | `(5) None of these / इनमें से कोई नहीं` is common | n/a |

Set these via `brand.optionStyle` (`numeric` | `alpha`) and the other `brand` fields —
never by editing the template.

## Non-negotiables

- **Sections are 25 questions each**, 100 total, 60 minutes.
- **Hindi is Kokila**, English is Times New Roman. Kokila ships with Windows. If Hindi renders
  as boxes, the font is missing — that is a machine problem, not a document problem.
- **Every `parallel` question needs its Hindi.** A missing `hi` leaves a blank right cell and is
  immediately visible. `verify.mjs` catches it.
- **Numbers, formulae and option values stay in Latin digits in the Hindi column too** — only the
  prose is translated. `(1) 6440.436` is identical on both sides.
- The disclaimer line *"In case of any discrepancy only the English version of that question will
  be considered as final"* is part of the masthead block. Keep it.

## Do not move the chrome into CSS

The running header and footer are stamped onto the rendered PDF by `build.mjs`, not styled in
`paper.css`. Chromium repaints `position: fixed` elements per page without recomputing them, so
a footer near the page bottom wraps and swaps with the header from page 2 onward. This was tested
and confirmed; `reference/house-style.md` records the detail. Stamping is also what makes the
odd/even mirroring work.

## Brand assets

Both live in `assets/` and were lifted out of the production PDFs, so they are the same files
InDesign uses — do not redraw or substitute them.

| File | What it is | Where it lands |
|---|---|---|
| `logo.png` | 487 x 78 mono emblem + `Mahendra's` lockup | masthead at 220 x 33 pt, footer at 121 x 18 pt |
| `watermark.png` | pen-in-hand emblem, `#F2F3F3` on transparency | 395 x 395 pt, centred, behind the text on every page |

The papers print greyscale, so `logo.png` is **monochrome by design**. Swapping in the colour
version will not match the production files. Both assets are optional — the template falls back
to a type wordmark and no watermark — but a paper that leaves the building should have them.

## Answer keys

The production question paper carries **no** answer key or solutions — those ship as a separate
booklet. Do not append a key to the paper unless asked. If a key is wanted, generate it as its
own document.
