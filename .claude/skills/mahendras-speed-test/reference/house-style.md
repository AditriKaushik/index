# House style — measured spec

All figures measured from the 2026 production PDFs (`BANK_GENERAL_ST30_2026`,
`SSC_GENERAL_ST30_2026`) with PyMuPDF. Units are PostScript points (1 pt = 1/72 in).

## Page

| | |
|---|---|
| Size | A4 — 595.276 × 841.89 pt |
| Content band, x | 55 → 543 (width **488**) |
| Content band, y | 87.6 → ~738 |
| Left margin | 55 |
| Right margin | 52.4 |

## Two-column grid

| | Left column | Right column |
|---|---|---|
| Question label x | 55 | 307 |
| Question text x | 92 | 344 |
| Column pitch | 252 | — |
| Text width | ~204 | ~199 |
| Gutter | ~11 | — |

The label sits in a 37 pt hanging gutter (`92 − 55`). Question text is **justified**.

Options that fit three-across use sub-columns at text-x **+0, +75, +138**
(i.e. 92 / 167 / 230 on the left, 344 / 419 / 482 on the right). Longer options drop to
two-across, then one per line.

Two rules the production papers follow and the template reproduces:

1. A trailing catch-all (`None of these`, `No error`, `इनमें से कोई नहीं`) is **excluded** when
   deciding the arrangement, and is allowed to span the rest of its row. Otherwise one long
   fifth option would push four short ones onto separate lines.
2. Both language columns use the **same** arrangement, decided from the English options. The
   Hindi strings are longer by character count and would otherwise pick a different grid,
   breaking the row alignment that is the whole point of the parallel layout.

## Type

| Role | Font | Size | Notes |
|---|---|---|---|
| English body | Times New Roman | 12 / 14.4 leading | justified |
| Hindi body | **Kokila** | 12 | Windows-native Devanagari |
| Section banner (English) | Arial Bold | 12.6 | e.g. `MATHS/` |
| Section banner (Hindi) | A-SuperHindi-1-Bold | 17 | e.g. `गणित` |
| Running header | Arial Bold Italic | 9 | `www.mahendras.org` |
| Footer paper title | Times New Roman Bold | 12 | `BANK GENERAL ST-30` |
| Footer page number | Arial Bold | 10 | reversed out of the black chevron |

Paragraph spacing between option lines ≈ 20.2 pt; within a wrapped paragraph ≈ 14.4 pt.

## Colours

| Element | RGB | Hex |
|---|---|---|
| Section banner fill | 0.812, 0.818, 0.824 | `#CFD1D3` |
| Header tab / footer bar | 0.820, 0.826, 0.832 | `#D1D3D5` |
| Chevron / rich black | 0.137, 0.122, 0.125 | `#231F20` |

## Chrome

**Header** — `www.mahendras.org` in Arial Bold Italic 9 pt at y 77–90, with a 51 × 11 grey tab
and a heavy rule. Sits right on odd pages, left on even pages.

**Footer** — band at y 740–760: a 326 × 20 grey bar carrying the paper title in Times Bold 12 pt
centred, a 50 × 20 `#231F20` chevron holding the page number, and the wordmark opposite.
Logo left / number right on odd pages; mirrored on even.

> **Why the chrome is stamped, not styled.** Chromium lays a `position: fixed` element out once
> against the document viewport and then repaints it on each page without recomputing. An element
> near the top of the page survives that; a footer ~650 pt down does not — on page 2 it wraps and
> swaps places with the header. Verified empirically, both with `top`/`bottom` offsets and with a
> fixed frame of explicit height. So `scripts/build.mjs` renders the body through Chromium and
> then stamps the header and footer onto the finished PDF with `pdf-lib`, which also makes
> odd/even mirroring trivial. Do not try to move the chrome back into CSS.

pdf-lib's standard fonts map cleanly onto the house fonts: `Times-Bold` for the footer title,
`Helvetica-Bold` for the page number, `Helvetica-BoldOblique` for the header URL.

## Watermark

The pen-in-hand emblem sits behind the text on **every** page: 395 x 395 pt, centred
(production files place it at (104,211)-(500,607) on odd pages and (98,228)-(494,623) on even —
i.e. page centre, give or take a few points). Sampled line colour is `#F2F3F3`.

In the source PDFs the emblem is a 256 x 221 JPEG whose levels span only 0-15 — visually solid
black until the levels are stretched, at which point the line art appears as light-on-dark. The
bundled `assets/watermark.png` is that recovered artwork, re-tinted and moved onto an alpha
channel. It is deliberately drawn square from a non-square source, which is what the production
files do, so the emblem is stretched slightly — matching them matters more than the aspect.

Because the watermark must sit *under* the text and pdf-lib only appends to a content stream,
`build.mjs` rebuilds the document: it draws the watermark on a fresh page, then stamps the
Chromium-rendered page on top as an embedded XObject, then the chrome. Page 1 therefore carries
three images (masthead logo, footer logo, watermark) and later pages two — the same counts as
the production files.

## Masthead (page 1 only)

```
        [logo.png]  SPEED TEST
              BANK GENERAL ST-30
        (FOR ALL BANK, INSURANCE & RELATED EXAMS)     <- BANK only

No. of Questions : 100 (Objective Type)      Date .............   Time : 60 Minutes
Total Marks : 100    Negative Marking : 1/4  Candidates Roll No. [ ][ ][ ][ ][ ][ ][ ][ ][ ]
Details of Sections in Question Paper :      Name of Candidate ...........................
Reasoning : 25, English : 25, Maths : 25, GA : 25
* In case of any discrepancy only the English      Centre Code .................
  version of that question will be considered as final.
```

Left block is a plain text stack; right block carries the roll-number boxes (9 cells).
`logo.png` already contains the wordmark, so the masthead sets only `SPEED TEST` beside it —
printing a text `Mahendra's` as well would double the wordmark.

## Section banner

Full content width (56 → 541), height 19, fill `#CFD1D3`, text centred, bilingual with a
slash and no space: `REASONING/तर्कशक्ति`, `ENGLISH/अंग्रेजी भाषा`, `MATHS/गणित`,
`GENERAL AWARENESS/सामान्य जागरूकता`. It spans **both** columns.

## Question numbering

Grouped directions carry a range — `Q.1-5.`, `Q.6-10.`, `Q26-29`, `Q34-38`.
Single questions are `Q-1` / `Q.11.` — the production files use both; the template emits
`Q.<n>` consistently, which is the dominant form.

## Observed section composition (ST-30, 2026)

**BANK** — Reasoning 1–25 (seating, syllogism, floor puzzle, odd-one-out, coding),
English 26–50 (fillers, sentence improvement, synonym in context, RC, cloze, para-jumble,
idiom, phrasal verb, error spotting, wrongly-used word), Maths 51–75 (average, fractions,
percentage, simplification, approximation), GA 76–100 (banking current affairs, appointments,
schemes, static GK).

**SSC** — Reasoning 1–25 (mirror image, figure counting, word formation, calendar, dice,
pattern completion, analogy, odd-one-out, matrix, series) — note SSC leans heavily on
**figure-based** questions, which need images placed in the item.
