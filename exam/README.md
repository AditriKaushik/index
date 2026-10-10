# MockPariksha — mock tests for Indian competitive exams

**Live (after merge to `main`):** https://aditrikaushik.github.io/index/exam/

## What it does (सरल भाषा में)

1. **Exam list & notifications** — national exams (SSC, banking, railways, JEE, NEET, UPSC, defence, teaching, MBA, law, state police, school entrance) with the latest notification status, dates and official links.
2. **Auto-generated mock test** — every test is built fresh from the exam's question bank, following the real pattern (sections, marks, negative marking, time) and the topic weightage found by analysing the last 3 years' papers.
3. **Result & analysis** — score, accuracy, time per question, section-wise and topic-wise performance, full solutions, and plain-language advice.
4. **Practise weak topics** — one tap builds a test from the topics you are weakest in. You can also build your own test (sections, topics, difficulty, number of questions).
5. **Fair pricing** — first day unlimited and free; afterwards 1 free test every day forever; cheap day/week/month passes; and a free "support pass" for anyone who can't pay. Results and analysis are always free.

## Quality ("proof-read, 90%+ relevance")

Every question is original (modelled on, never copied from, previous papers), tagged to a syllabus topic, and re-solved independently before it is marked `verified`.
`node exam/data/validate.mjs` refuses any exam whose bank is below **90% syllabus relevance** or **100% verified**, has duplicate options, a bad answer key, etc. CI runs it on every PR.

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
| Add questions with AI | `cd exam/tools && npm install && ANTHROPIC_API_KEY=… node grow-bank.mjs ssc-cgl 40` |
| Change prices / free tests | edit `PLAN` in `exam/js/access.js` |

## Not done yet (needs a decision or an account from the owner)

- **Payments:** the pass buttons show "coming soon". Real UPI payments need a payment-gateway account (e.g. Razorpay/Cashfree) **and** a small server that verifies payments and issues passes — today the free/pass rules run on the user's phone, so they are an honour system.
- **Accounts & cross-device progress:** progress is saved on the device only. Login (phone OTP) needs the same server.
- **Bigger question banks:** each exam starts with ~60 verified questions, so full mocks are scaled down while keeping the real section ratio. `tools/grow-bank.mjs` can grow banks to full-paper size and beyond.
- **Notifications auto-refresh:** status was researched once (date in each file). A scheduled job can re-check official sites regularly.
