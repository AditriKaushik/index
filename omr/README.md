# Mahendra's Online OMR Portal

Candidates write the paper offline, then fill their answer sheet here. The
portal scores every sheet against the official key, ranks all candidates and
releases the result.

Runs on **Netlify**. No PHP server, and no SQL to run by hand.

---

## Setup

### 1. Import the repository into Netlify

**Add new site → Import an existing project → GitHub**, and pick this
repository. Netlify reads `netlify.toml` at the repo root, so there is nothing
to type — no base directory, no build command, no publish directory.

### 2. Give it a database

In your new site: **Extensions → Netlify DB** (or **Project configuration →
Database**) and create one. Netlify sets `NETLIFY_DATABASE_URL` for you and the
portal picks it up automatically.

Prefer your own database? Create a free Postgres at **neon.tech**, copy the
**pooled** connection string, and set it as `DATABASE_URL` instead.

**The tables are created automatically** the first time the site is opened.
There is no schema file to run.

### 3. Add the login secret

**Site configuration → Environment variables**, add one:

| Key | Value |
|---|---|
| `SESSION_SECRET` | any long random string of your own, 16+ characters |

Mash the keyboard. Nobody ever types it — it only signs login cookies.
Changing it later logs everyone out.

### 4. Redeploy and open the site

Trigger a redeploy so the function picks up the variables, then open your
Netlify URL.

**If anything is still missing, the login page will say so** — which variable,
where to set it, what to do next. When it looks normal, you are ready.

Sign in on the **Branch / Office** tab:

```
Username: admin
Password: admin@123
```

**Change this password immediately** from the Candidates page. Until you do,
the login page will keep reminding you.

---

## Running a test

1. **Tests → + New Test** — question count, options per question, marking scheme
2. **Sections** (optional) — for a sectional breakdown on every result
3. **Answer key** — paste it or choose a CSV
4. **Candidates** — paste or upload `roll_no, name, mobile`
5. **Open for Filling** — candidates can now log in
6. **Close Filling** once everyone has submitted
7. **Evaluate & Publish Result** — scores, ranks and percentiles go live

Publishing always re-evaluates first, so released numbers match the key and the
sheets exactly as they stand at that moment. Changing the key after publishing
re-scores and re-ranks everyone automatically.

### Marking

Set per test, and optionally overridden per section.

| Outcome | Marks |
|---|---|
| Correct answer | `marks_correct` (default **+1**) |
| Wrong answer | `marks_wrong` (default **−0.25**) |
| Not attempted | **0** |

The answer key also supports:

| Key entry | Meaning |
|---|---|
| `A,C` | either option accepted as correct |
| `*` | **bonus** — every candidate gets full marks, attempted or not |
| `-` | **dropped** — no marks, no penalty, and it comes out of the maximum |

A question with no key row at all is treated as dropped, so an incomplete key
can never penalise anyone.

**Ranking** is standard competition ranking on score: equal scores share a rank
and the next rank skips accordingly (1, 2, 2, 4). **Percentile** is the share of
candidates scoring strictly below.

### Answer key formats

```
1 A          question number, then the option
1,A          comma, colon, dot or dash all work
4 A,C        either option accepted
5 *          bonus
6 -          dropped
ABCDABCDA…   a bare run of letters, taken from Q1 onwards
```

### Candidate list format

```
roll_no,name,mobile
MHS24001,Asha Verma,9876543210
MHS24002,"Iyer, Ramesh",+91 98765 43211
```

Header row optional, tabs work as well as commas, and `+91` and spaces are
stripped from mobile numbers. An existing roll number has its name and mobile
updated rather than being duplicated.

---

## Layout

```
omr/
├── netlify.toml              routing, headers, build
├── dev-server.mjs            run it locally without deploying
│
├── public/                   the static site
│   ├── index.html            candidate + staff login, and setup diagnosis
│   ├── omr.html              the OMR sheet
│   ├── result.html           candidate's own result
│   ├── admin.html            staff console
│   └── assets/{css,js}
│
├── netlify/functions/
│   ├── api.mjs               every API route, in one function
│   └── lib/
│       ├── schema.mjs        the tables, and the code that creates them
│       ├── db.mjs            Postgres pool
│       ├── auth.mjs          signed-cookie sessions, scrypt passwords
│       ├── evaluator.mjs     scoring and ranking, pure functions
│       ├── scoring-db.mjs    reads sheets, writes results, ranks a test
│       └── importers.mjs     answer key and candidate list parsers
│
└── tests/                    149 tests
```

---

## Running it locally

```bash
cd omr
npm install
createdb omr        # empty is fine - the tables create themselves

DATABASE_URL='postgres://localhost/omr' \
SESSION_SECRET='any-long-string-for-local-use' \
  node dev-server.mjs 8888
```

Then open `http://127.0.0.1:8888`. The dev server serves `public/` and routes
`/api/*` to the same function Netlify runs, so what you see locally is what
deploys.

## Tests

```bash
node tests/evaluator.test.mjs    # 64 - marking rules and ranking maths
node tests/importers.test.mjs    # 30 - answer key and candidate parsers
node tests/api.test.mjs          # 55 - every API route, against a real database
```

The API suite needs `DATABASE_URL` and `SESSION_SECRET`, starts by proving the
schema builds itself on a blank database, and resets the tables it uses — so
point it at a scratch database, never at live data. It is repeatable.

---

## Security notes

* Candidates authenticate with roll number **and** registered mobile; a wrong
  roll number and a wrong mobile give the same message, so the form never
  confirms whether a roll number exists
* Sessions are signed cookies — `HttpOnly`, `Secure`, `SameSite=Lax`, 3 hours
* Every mutating request must carry an `X-OMR-Request` header, which a
  cross-site form cannot set — this blocks CSRF
* All SQL goes through parameterised queries
* Staff passwords are hashed with scrypt, and the seeded login's hash is
  generated on your own database rather than shipped in this repository
* A submitted sheet is locked server-side, not just in the browser
* The database URL and `SESSION_SECRET` live in Netlify's environment, never in
  the repository
