# MockPariksha — mock tests for Indian competitive exams

**Live (after merge to `main`):** https://aditrikaushik.github.io/index/exam/

## What it does (सरल भाषा में)

1. **Exam list & notifications** — national exams (SSC, banking, railways, JEE, NEET, UPSC, defence, teaching, MBA, law, state police, school entrance) with the latest notification status, dates and official links.
2. **Auto-generated mock test** — every test is built fresh from the exam's question bank, following the real pattern (sections, marks, negative marking, time) and the topic weightage found by analysing the last 3 years' papers.
3. **Result & analysis** — score, accuracy, time per question, section-wise and topic-wise performance, full solutions, and plain-language advice.
4. **Practise weak topics** — one tap builds a test from the topics you are weakest in. You can also build your own test (sections, topics, difficulty, number of questions).
5. **Fair pricing** — first day unlimited and free; afterwards 1 free test every day forever; cheap day/week/month passes; and a free "support pass" for anyone who can't pay. Results and analysis are always free.

## Quality: AI questions with PYQ relevance of 90 or more

Every question a student sees has passed this pipeline (details in `data/RELEVANCE.md`):

1. **PYQ blueprint.** For each exam, the question *patterns* that actually appeared in the last 3 years' papers (concept, format, typical trap, years seen) are listed in `pyqBlueprint`. They are described in our own words; no real question is copied.
2. **AI writing.** Claude writes new questions, each one a fresh instance of a single blueprint pattern, in the real format: passage/DI sets, multi-correct, numerical (TITA), match-the-list, and SVG figures for non-verbal reasoning.
3. **Blind independent review.** A separate reviewer gets a sheet *without the answer key* (`tools/review-sheet.mjs`), solves every question (with scripts for maths and brute force for puzzles), checks recent facts on the web, and scores PYQ relevance out of 100.
4. **Gate.** `tools/apply-review.mjs` keeps a question only if the reviewer's answer matches the key, nothing is ambiguous, and the score is **90 or more**. The validator and the test engine both refuse anything else, so a student can never be served an unreviewed or low-scoring question.

Current bank: 39 exams, 4,350 questions (2,858 AI-written). Every exam's average PYQ relevance is 91 or more, and no question scores below 90.

## Folder layout

```
exam/
├─ index.html, styles.css      the website
├─ js/engine.js                builds tests, scores, analysis (pure functions)
├─ js/access.js                free / pass rules (edit PLAN to change prices)
├─ js/app.js, js/store.js      screens and on-device storage
├─ data/exams/<id>.json        one file per exam: notification, pattern, 3-year trend, question bank
├─ data/catalog.json           generated index of all exams (node exam/data/build-catalog.mjs)
├─ data/SCHEMA.md              format of an exam file + proof-reading checklist
├─ data/validate.mjs           quality gate
├─ tools/grow-bank.mjs         grows a bank with Claude + independent answer check (needs API key)
└─ test/                       unit tests: node --test exam/test/*.test.mjs
```

## Common jobs

| Job | Command |
| --- | --- |
| Run locally | `cd exam && python3 -m http.server 8000` then open http://localhost:8000 |
| Check all data | `node exam/data/validate.mjs` |
| Rebuild the exam list after editing data | `node exam/data/build-catalog.mjs` |
| Add questions with AI (writer + blind reviewer, keeps only ≥ 90) | Actions tab → "MockPariksha – add AI questions" (needs the `ANTHROPIC_API_KEY` secret), or locally `cd exam/tools && npm install && ANTHROPIC_API_KEY=… node grow-bank.mjs ssc-cgl 40` |
| Change prices / free tests | edit `PLAN` in `exam/js/access.js` |

## Not done yet (needs a decision or an account from the owner)

- **Payments:** the pass buttons show "coming soon". Real UPI payments need a payment-gateway account (e.g. Razorpay/Cashfree) **and** a small server that verifies payments and issues passes — today the free/pass rules run on the user's phone, so they are an honour system.
- **Accounts & cross-device progress:** progress is saved on the device only. Login (phone OTP) needs the same server.
- **Bigger question banks:** most exams have 100–175 approved questions, so a full mock may be shorter than the real paper (the section ratio is kept). The Actions workflow can keep growing the banks once an API key is added.
- **Notifications auto-refresh:** status was researched once (date in each file). A scheduled job can re-check official sites regularly.
