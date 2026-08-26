# Bank Offline Speed Test — ST-01

`Bank Offline ST-01.docx` — a bilingual (Hindi + English) offline speed test on the
**IBPS / SBI Clerk Preliminary** pattern.

| | |
|---|---|
| Questions | 100 |
| Marks | 100 (1 each) |
| Time | 60 minutes |
| Negative marking | 0.25 |

| Section | Questions | Count |
|---|---|---|
| I — English Language | 1–30 | 30 |
| II — Numerical Ability | 31–65 | 35 |
| III — Reasoning Ability | 66–100 | 35 |

The document contains the paper, a 10 × 10 answer key grid, and a worked
explanation for every question.

Per the usual bilingual convention the English Language section is in English only.
Elsewhere each question carries its Hindi rendering, except pure-arithmetic items
(e.g. `24 × 15 ÷ 6 + 38 = ?`) where the Hindi would be identical to the English.

## Regenerating

The paper is generated, not hand-laid-out, so ST-02 onward can reuse the machinery.

```bash
cd src && npm install && npm run build
```

Question content lives in `src/sec-english.js`, `src/sec-numerical.js` and
`src/sec-reasoning.js`. `src/build.js` renders the `.docx`; `src/rebalance.js`
permutes option order so the correct answers spread evenly across (a)–(e) —
it deliberately leaves option sets alone where the ordering carries meaning
(syllogism/inequality legends, ascending count options, error-detection parts).

## Checks

```bash
cd src && npm run verify
```

- `verify-math.js` recomputes every numeric answer independently of the answer key.
- `verify-puzzles.js` brute-forces the seating and floor puzzles to confirm the
  clue sets admit exactly one arrangement, and checks which coding-decoding words
  are actually determined by the given statements.

## Fonts

Hindi runs are set in **Nirmala UI** (ships with Windows). On a machine without it,
install Noto Sans Devanagari or map the font in Word, otherwise the Hindi will not shape.
