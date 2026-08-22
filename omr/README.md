# Mahendra's Online OMR Portal

Candidates write the paper offline, then fill their answer sheet here. The
portal scores every sheet against the official key, ranks all candidates and
releases the result.

Built as plain PHP + MySQL with no framework and no external dependencies —
it drops onto the same hosting that runs the existing speedtest site.

---

## What it does

**For the candidate**

* Logs in with roll number + registered mobile number
* Fills an on-screen OMR — tap the option marked on the paper
* Every bubble saves automatically; answers can be changed until submission
* Tapping a filled bubble erases it, like a rubber
* Works on a phone; keeps answers safe if the connection drops
* After the result is released: score, rank, percentile, sectional split and a
  question-by-question answer review

**For the branch / head office**

* Create tests with a configurable marking scheme
* Optional sections, each able to override the test's marks
* Upload the answer key by paste or CSV
* Import candidates by paste or CSV, allotted to a test in one step
* Open the test, watch sheets come in live, close it
* Evaluate & publish — scores and ranks computed and released together
* Merit list on screen and as a CSV download
* Reopen an individual sheet if a candidate needs to refill it

---

## Marking

Set per test, and optionally overridden per section.

| Outcome | Marks |
|---|---|
| Correct answer | `marks_correct` (default **+1**) |
| Wrong answer | `marks_wrong` (default **−0.25**) |
| Not attempted | **0** |

The answer key also supports two special entries:

| Key entry | Meaning |
|---|---|
| `A,C` | either option is accepted as correct |
| `*` | **bonus** — every candidate gets full marks, attempted or not |
| `-` | **dropped** — no marks, no penalty, and the question comes out of the maximum |

A question with no key row at all is treated as dropped, so an incomplete key
can never penalise anyone.

**Ranking.** Standard competition ranking on score: equal scores share a rank
and the next rank skips accordingly (1, 2, 2, 4). Display order breaks ties by
more correct answers, then by who submitted first.

**Percentile.** The share of candidates scoring strictly below this candidate,
so the bottom scorer is 0 and tied candidates get the same figure.

---

## Installation

**1. Copy the folder** to your web root, e.g. `/public_html/omr/`.

**2. Create the database and import the schema:**

```bash
mysql -u YOUR_USER -p -e "CREATE DATABASE mahendras_omr CHARACTER SET utf8mb4"
mysql -u YOUR_USER -p mahendras_omr < sql/schema.sql
```

**3. Set your database credentials** in `config/config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'mahendras_omr');
define('DB_USER', 'your_user');
define('DB_PASS', 'your_password');
```

**4. Log in** at `login.php` → *Branch / Office* tab:

```
Username: admin
Password: admin@123
```

**Change this password immediately** from the Candidates page.

### Requirements

* PHP 7.4 or newer, with PDO MySQL
* MySQL 5.7+ / MariaDB 10.2+
* HTTPS strongly recommended (session cookies are marked `secure` automatically)

---

## Running a test

1. **Tests → + New Test** — question count, options per question, marking scheme
2. **Sections** (optional) — for a sectional breakdown on every result
3. **Answer key** — paste or upload
4. **Candidates** — paste or upload `roll_no, name, mobile`
5. **Open for Filling** — candidates can now log in
6. **Close Filling** once everyone has submitted
7. **Evaluate & Publish Result** — scores, ranks and percentiles go live

Publishing always re-evaluates first, so released numbers match the key and the
sheets exactly as they stand at that moment. Changing the key after publishing
re-scores and re-ranks everyone automatically.

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

The header row is optional, tabs work as well as commas, and `+91` / spaces in
mobile numbers are stripped. A roll number that already exists has its name and
mobile updated rather than being duplicated.

---

## Layout

```
omr/
├── config/
│   ├── config.php          database credentials and app settings
│   └── db.php              PDO connection
├── includes/
│   ├── bootstrap.php       session start, included by every entry point
│   ├── auth.php            candidate and staff sessions, page guards
│   ├── helpers.php         escaping, CSRF, JSON replies
│   ├── evaluator.php       scoring and ranking engine
│   ├── importers.php       answer key and candidate list parsers
│   └── layout.php          shared chrome for staff pages
├── queries/
│   ├── loginauth.php       login endpoint (JSON)
│   ├── omr.php             save / submit endpoint (JSON)
│   └── admin.php           all staff actions
├── assets/
│   ├── css/app.css
│   └── js/omr.js           OMR sheet behaviour
├── sql/schema.sql
│
├── login.php               candidate + staff login
├── omr_filling.php         the OMR sheet
├── result.php              candidate's own result
├── dashboard.php           staff overview
├── tests.php               test list
├── test_edit.php           create / manage a test
├── candidates.php          candidate master + account settings
├── results.php             merit list
└── export.php              merit list as CSV
```

---

## Security notes

* Candidates authenticate with roll number **and** registered mobile; a wrong
  roll number and a wrong mobile give the same message, so the form never
  confirms whether a roll number exists
* Failed logins are throttled, with a lockout that doubles after five strikes
* Every state-changing request carries a CSRF token
* All SQL goes through prepared statements
* Staff passwords are bcrypt hashed, and old hashes are upgraded on login
* A submitted sheet is locked server-side — the check is not just in the browser
* Sessions time out after 3 hours idle (`SESSION_TIMEOUT_MIN`)
* Set `APP_DEBUG` to `false` on a live server (it already is)
