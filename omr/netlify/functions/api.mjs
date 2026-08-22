/* =====================================================================
   Mahendra's Online OMR Portal - the whole API in one function.

   Netlify routes /api/* here (see netlify.toml). The path after /api
   selects the handler.
   ===================================================================== */

import { db, q, one, scalar, tx, connectionString } from './lib/db.mjs';
import {
  hashPassword, verifyPassword, signSession, readSession,
  sessionCookie, clearCookie, normaliseMobile,
} from './lib/auth.mjs';
import { optionLetters, gradeQuestion, fmtScore } from './lib/evaluator.mjs';
import { parseAnswerKey, parseCandidateList } from './lib/importers.mjs';
import { seedPasswordUnchanged, SEED_USERNAME, SEED_PASSWORD } from './lib/schema.mjs';
import {
  loadTest, loadSections, loadKeyMap, loadMarkedMap,
  evaluateCandidate, evaluateTest,
} from './lib/scoring-db.mjs';

/* ---------------- replies ---------------- */

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

const ok = (body = {}, headers = {}) => json({ ok: true, ...body }, 200, headers);
const fail = (error, status = 400) => json({ ok: false, error }, status);

/* ---------------- guards ---------------- */

function candidateOf(session) {
  if (!session || session.kind !== 'candidate') return null;
  return session;
}

function staffOf(session) {
  if (!session || session.kind !== 'staff') return null;
  return session;
}

/**
 * Cross-site forms cannot set a custom header without triggering a CORS
 * preflight, so requiring one blocks CSRF without a token round-trip.
 */
function csrfOk(request) {
  return request.headers.get('x-omr-request') === '1';
}

/* =====================================================================
   Handlers
   =================================================================== */

async function login(request) {
  const body = await request.json().catch(() => ({}));

  /* ---- candidate: roll number + registered mobile ---- */
  if (body.kind === 'candidate') {
    const roll = String(body.roll_no ?? '').trim();
    const mobile = normaliseMobile(body.mobile);

    if (!roll || mobile.length !== 10) {
      return fail('Please enter your roll number and your 10-digit registered mobile number.');
    }

    const cand = await one('SELECT id, roll_no, name, mobile FROM candidates WHERE roll_no = $1', [roll]);

    // One message for both failures, so the form never confirms a roll exists.
    if (!cand || normaliseMobile(cand.mobile) !== mobile) {
      await new Promise((r) => setTimeout(r, 300));
      return fail('Roll number and mobile number do not match our records.');
    }

    const tests = await q(
      `SELECT t.id, t.name, t.status, tc.status AS attempt_status
         FROM test_candidates tc
         JOIN tests t ON t.id = tc.test_id
        WHERE tc.candidate_id = $1 AND t.status IN ('open','published')
     ORDER BY CASE t.status WHEN 'open' THEN 0 ELSE 1 END, t.id DESC`,
      [cand.id]
    );

    if (!tests.length) {
      return fail('No test is open for you at the moment. Please check with your branch.');
    }

    let chosen = null;
    if (body.test_id) {
      chosen = tests.find((t) => Number(t.id) === Number(body.test_id)) ?? null;
      if (!chosen) return fail('That test is not available for you.');
    } else if (tests.length === 1) {
      chosen = tests[0];
    } else {
      return json({
        ok: false,
        choose_test: tests.map((t) => ({
          id: Number(t.id),
          name: t.name
            + (t.status === 'published' ? '  (result out)'
              : t.attempt_status === 'submitted' ? '  (submitted)' : ''),
        })),
      });
    }

    const token = signSession({
      kind: 'candidate',
      id: Number(cand.id),
      roll: cand.roll_no,
      name: cand.name,
      testId: Number(chosen.id),
    });

    const done = chosen.attempt_status === 'submitted' || chosen.status === 'published';
    return ok({ redirect: done ? '/result' : '/omr' }, { 'set-cookie': sessionCookie(token) });
  }

  /* ---- staff: username + password ---- */
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');

  if (!username || !password) return fail('Please enter your username and password.');

  const staff = await one('SELECT * FROM branches WHERE username = $1', [username]);

  if (!staff || !verifyPassword(password, staff.password_hash)) {
    await new Promise((r) => setTimeout(r, 300));
    return fail('Incorrect username or password.');
  }
  if (!staff.active) return fail('This login has been disabled. Please contact head office.');

  const token = signSession({
    kind: 'staff',
    id: Number(staff.id),
    name: staff.name,
    username: staff.username,
    role: staff.role,
  });

  return ok({ redirect: '/admin' }, { 'set-cookie': sessionCookie(token) });
}

async function me(session) {
  if (!session) return json({ ok: false, signed_in: false }, 200);
  return ok({ signed_in: true, ...session });
}

/* ---------------- candidate ---------------- */

async function sheet(session) {
  const cand = candidateOf(session);
  if (!cand) return fail('Your session has expired. Please log in again.', 401);

  const test = await loadTest(cand.testId);
  if (!test) return fail('That test is no longer available.', 410);

  const attempt = await one(
    'SELECT * FROM test_candidates WHERE test_id = $1 AND candidate_id = $2',
    [cand.testId, cand.id]
  );
  if (!attempt) return fail('You are not allotted to this test.', 403);

  if (attempt.status === 'submitted' || test.status !== 'open') {
    return ok({ locked: true, redirect: '/result' });
  }

  if (attempt.status === 'pending') {
    await q(
      "UPDATE test_candidates SET status='in_progress', started_at=NOW() WHERE test_id=$1 AND candidate_id=$2",
      [cand.testId, cand.id]
    );
  }

  const sections = await loadSections(cand.testId);
  const marked = await loadMarkedMap(cand.testId, cand.id);
  const answers = {};
  for (const [k, v] of marked) if (v) answers[k] = v;

  return ok({
    locked: false,
    candidate: { roll: cand.roll, name: cand.name },
    test: {
      id: Number(test.id),
      code: test.code,
      name: test.name,
      total: Number(test.total_questions),
      letters: optionLetters(test.option_count),
      marks_correct: fmtScore(test.marks_correct),
      marks_wrong: fmtScore(test.marks_wrong),
    },
    sections: sections.map((s) => ({
      id: Number(s.id), name: s.name,
      from: Number(s.q_from), to: Number(s.q_to),
      marks_correct: fmtScore(s.marks_correct ?? test.marks_correct),
      marks_wrong: fmtScore(s.marks_wrong ?? test.marks_wrong),
      overridden: s.marks_correct !== null || s.marks_wrong !== null,
    })),
    answers,
  });
}

async function save(request, session) {
  const cand = candidateOf(session);
  if (!cand) return json({ ok: false, expired: true, error: 'Your session has expired. Please log in again.' }, 401);

  const test = await loadTest(cand.testId);
  if (!test) return fail('That test is no longer available.', 410);

  const attempt = await one(
    'SELECT status FROM test_candidates WHERE test_id=$1 AND candidate_id=$2',
    [cand.testId, cand.id]
  );
  if (!attempt) return fail('You are not allotted to this test.', 403);
  if (attempt.status === 'submitted') {
    return fail('Your sheet has already been submitted and cannot be changed.', 409);
  }
  if (test.status !== 'open') {
    return fail('This test is closed. No further changes can be saved.', 409);
  }

  const body = await request.json().catch(() => ({}));
  const answers = body.answers;
  if (!answers || typeof answers !== 'object') return fail('Malformed answer batch.');

  const entries = Object.entries(answers);
  if (entries.length > 500) return fail('Too many answers in one batch.');

  const total = Number(test.total_questions);
  const letters = optionLetters(test.option_count);
  let saved = 0;
  let skipped = 0;

  await tx(async (client) => {
    for (const [rawQ, rawOpt] of entries) {
      const qn = Number(rawQ);
      if (!Number.isInteger(qn) || qn < 1 || qn > total) { skipped++; continue; }

      const opt = String(rawOpt ?? '').trim().toUpperCase();

      if (opt === '') {
        await client.query('DELETE FROM responses WHERE test_id=$1 AND candidate_id=$2 AND q_no=$3',
          [cand.testId, cand.id, qn]);
        saved++;
        continue;
      }
      if (!letters.includes(opt)) { skipped++; continue; }

      await client.query(
        `INSERT INTO responses (test_id, candidate_id, q_no, marked_option)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (test_id, candidate_id, q_no)
         DO UPDATE SET marked_option = EXCLUDED.marked_option, updated_at = NOW()`,
        [cand.testId, cand.id, qn, opt]
      );
      saved++;
    }
  });

  const filled = await scalar(
    `SELECT COUNT(*) FROM responses
      WHERE test_id=$1 AND candidate_id=$2 AND marked_option IS NOT NULL AND marked_option <> ''`,
    [cand.testId, cand.id]
  );

  return ok({ saved, skipped, filled: Number(filled) });
}

async function submit(session) {
  const cand = candidateOf(session);
  if (!cand) return json({ ok: false, expired: true, error: 'Your session has expired.' }, 401);

  const test = await loadTest(cand.testId);
  if (!test) return fail('That test is no longer available.', 410);
  if (test.status !== 'open') return fail('This test is closed.', 409);

  const attempt = await one(
    'SELECT status FROM test_candidates WHERE test_id=$1 AND candidate_id=$2',
    [cand.testId, cand.id]
  );
  if (!attempt) return fail('You are not allotted to this test.', 403);
  if (attempt.status === 'submitted') return fail('Your sheet has already been submitted.', 409);

  await q(
    `UPDATE test_candidates SET status='submitted', submitted_at=NOW()
      WHERE test_id=$1 AND candidate_id=$2 AND status <> 'submitted'`,
    [cand.testId, cand.id]
  );

  // Score it straight away so the branch sees live totals. Rank is filled in
  // later, when head office publishes the test.
  const keyMap = await loadKeyMap(cand.testId);
  if (keyMap.size) {
    const sections = await loadSections(cand.testId);
    await evaluateCandidate(test, sections, keyMap, cand.id);
  }

  return ok({ redirect: '/result' });
}

async function result(session) {
  const cand = candidateOf(session);
  if (!cand) return fail('Your session has expired. Please log in again.', 401);

  const test = await loadTest(cand.testId);
  if (!test) return fail('That test is no longer available.', 410);

  const attempt = await one(
    'SELECT * FROM test_candidates WHERE test_id=$1 AND candidate_id=$2',
    [cand.testId, cand.id]
  );
  if (!attempt) return fail('You are not allotted to this test.', 403);

  if (attempt.status !== 'submitted' && test.status === 'open') {
    return ok({ state: 'filling', redirect: '/omr' });
  }

  const published = test.status === 'published';
  const row = await one('SELECT * FROM results WHERE test_id=$1 AND candidate_id=$2',
    [cand.testId, cand.id]);

  const base = {
    candidate: { roll: cand.roll, name: cand.name },
    test: { code: test.code, name: test.name },
    submitted_at: attempt.submitted_at,
  };

  if (!published || !row) return ok({ state: 'submitted', ...base });

  const totalRanked = Number(await scalar('SELECT COUNT(*) FROM results WHERE test_id=$1', [cand.testId]));
  const sections = await loadSections(cand.testId);
  const keyMap = await loadKeyMap(cand.testId);
  const marked = await loadMarkedMap(cand.testId, cand.id);

  const secRows = await q('SELECT * FROM section_results WHERE result_id=$1', [row.id]);
  const secById = new Map(secRows.map((r) => [Number(r.section_id), r]));

  // Question-by-question review.
  const review = [];
  for (let n = 1; n <= Number(test.total_questions); n++) {
    const key = keyMap.get(n) ?? null;
    const mine = marked.get(n) ?? '';
    review.push({
      q: n,
      mine,
      key: key === '*' || key === '-' ? key : (key ?? ''),
      outcome: gradeQuestion(key, mine),
    });
  }

  return ok({
    state: 'published',
    ...base,
    letters: optionLetters(test.option_count),
    score: {
      score: fmtScore(row.score),
      max_score: fmtScore(row.max_score),
      percentage: fmtScore(row.percentage),
      correct: Number(row.correct),
      wrong: Number(row.wrong),
      unattempted: Number(row.unattempted),
      rank: row.rank_overall === null ? null : Number(row.rank_overall),
      percentile: row.percentile === null ? null : fmtScore(row.percentile),
      total_ranked: totalRanked,
    },
    sections: sections.map((s) => {
      const sr = secById.get(Number(s.id));
      return sr ? {
        name: s.name, from: Number(s.q_from), to: Number(s.q_to),
        correct: Number(sr.correct), wrong: Number(sr.wrong),
        unattempted: Number(sr.unattempted), score: fmtScore(sr.score),
      } : null;
    }).filter(Boolean),
    section_starts: Object.fromEntries(sections.map((s) => [Number(s.q_from), s.name])),
    review,
  });
}

/* =====================================================================
   Staff
   =================================================================== */

async function adminOverview() {
  const counts = {
    tests: Number(await scalar('SELECT COUNT(*) FROM tests')),
    open: Number(await scalar("SELECT COUNT(*) FROM tests WHERE status='open'")),
    candidates: Number(await scalar('SELECT COUNT(*) FROM candidates')),
    submitted: Number(await scalar("SELECT COUNT(*) FROM test_candidates WHERE status='submitted'")),
  };

  const tests = await q(
    `SELECT t.*,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.test_id=t.id) AS allotted,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.test_id=t.id AND tc.status='submitted') AS submitted,
            (SELECT COUNT(*) FROM answer_keys k WHERE k.test_id=t.id) AS key_rows
       FROM tests t ORDER BY t.id DESC`
  );

  return ok({
    counts,
    tests: tests.map((t) => ({
      id: Number(t.id), code: t.code, name: t.name, status: t.status,
      total_questions: Number(t.total_questions),
      option_count: Number(t.option_count),
      marks_correct: fmtScore(t.marks_correct),
      marks_wrong: fmtScore(t.marks_wrong),
      duration_minutes: Number(t.duration_minutes),
      allotted: Number(t.allotted), submitted: Number(t.submitted),
      key_rows: Number(t.key_rows),
      created_at: t.created_at,
    })),
  });
}

async function adminTest(testId) {
  const test = await loadTest(testId);
  if (!test) return fail('Test not found.', 404);

  const sections = await loadSections(testId);
  const keyMap = await loadKeyMap(testId);

  return ok({
    test: {
      id: Number(test.id), code: test.code, name: test.name, status: test.status,
      total_questions: Number(test.total_questions),
      option_count: Number(test.option_count),
      marks_correct: fmtScore(test.marks_correct),
      marks_wrong: fmtScore(test.marks_wrong),
      duration_minutes: Number(test.duration_minutes),
    },
    sections: sections.map((s) => ({
      id: Number(s.id), name: s.name, q_from: Number(s.q_from), q_to: Number(s.q_to),
      marks_correct: s.marks_correct === null ? '' : fmtScore(s.marks_correct),
      marks_wrong: s.marks_wrong === null ? '' : fmtScore(s.marks_wrong),
    })),
    key: Object.fromEntries(keyMap),
    key_rows: keyMap.size,
    allotted: Number(await scalar('SELECT COUNT(*) FROM test_candidates WHERE test_id=$1', [testId])),
    submitted: Number(await scalar("SELECT COUNT(*) FROM test_candidates WHERE test_id=$1 AND status='submitted'", [testId])),
  });
}

async function saveTest(request, staff) {
  const b = await request.json().catch(() => ({}));

  const id = Number(b.id ?? 0);
  const code = String(b.code ?? '').trim();
  const name = String(b.name ?? '').trim();
  const total = Number(b.total_questions);
  const opts = Number(b.option_count ?? 4);
  const mc = Number(b.marks_correct);
  let mw = Number(b.marks_wrong);
  const mins = Number(b.duration_minutes ?? 0) || 0;

  if (!code || !name) return fail('Test code and name are required.');
  if (!Number.isInteger(total) || total < 1 || total > 500) {
    return fail('Number of questions must be between 1 and 500.');
  }
  if (!Number.isInteger(opts) || opts < 2 || opts > 5) {
    return fail('Options per question must be between 2 and 5.');
  }
  if (!Number.isFinite(mc) || !Number.isFinite(mw)) return fail('Marks must be numbers.');
  if (mw > 0) mw = -mw; // accept 0.25 and store -0.25

  try {
    if (id) {
      await q(
        `UPDATE tests SET code=$1, name=$2, total_questions=$3, option_count=$4,
                marks_correct=$5, marks_wrong=$6, duration_minutes=$7 WHERE id=$8`,
        [code, name, total, opts, mc, mw, mins, id]
      );
      // Shrinking the paper would orphan answers past the new end.
      await q('DELETE FROM responses   WHERE test_id=$1 AND q_no>$2', [id, total]);
      await q('DELETE FROM answer_keys WHERE test_id=$1 AND q_no>$2', [id, total]);
      return ok({ id, message: 'Test updated.' });
    }

    const row = await one(
      `INSERT INTO tests (code, name, total_questions, option_count,
                          marks_correct, marks_wrong, duration_minutes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [code, name, total, opts, mc, mw, mins, staff.id]
    );
    return ok({ id: Number(row.id), message: 'Test created. Now add its answer key and allot candidates.' });
  } catch (err) {
    if (err.code === '23505') return fail('That test code is already in use. Please pick another.');
    throw err;
  }
}

async function saveSections(request) {
  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  const test = await loadTest(testId);
  if (!test) return fail('Test not found.', 404);

  const total = Number(test.total_questions);
  const rows = [];
  const errors = [];

  for (const raw of (Array.isArray(b.sections) ? b.sections : [])) {
    const name = String(raw.name ?? '').trim();
    if (!name) continue;

    const from = Number(raw.q_from);
    const to = Number(raw.q_to);

    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > total) {
      errors.push(`"${name}": question range must sit inside 1-${total}.`);
      continue;
    }

    const mcRaw = String(raw.marks_correct ?? '').trim();
    const mwRaw = String(raw.marks_wrong ?? '').trim();
    let mc = mcRaw === '' ? null : Number(mcRaw);
    let mw = mwRaw === '' ? null : Number(mwRaw);
    if (mc !== null && !Number.isFinite(mc)) { errors.push(`"${name}": correct marks must be a number.`); continue; }
    if (mw !== null && !Number.isFinite(mw)) { errors.push(`"${name}": wrong marks must be a number.`); continue; }
    if (mw !== null && mw > 0) mw = -mw;

    rows.push({ name, from, to, mc, mw, order: rows.length });
  }

  // Overlapping sections would make a question's marks ambiguous.
  for (const a of rows) {
    for (const c of rows) {
      if (a.order >= c.order) continue;
      if (a.from <= c.to && c.from <= a.to) errors.push(`"${a.name}" and "${c.name}" overlap.`);
    }
  }

  if (errors.length) return fail(errors.join(' '));

  await tx(async (client) => {
    await client.query('DELETE FROM sections WHERE test_id=$1', [testId]);
    for (const r of rows) {
      await client.query(
        `INSERT INTO sections (test_id, name, q_from, q_to, marks_correct, marks_wrong, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [testId, r.name, r.from, r.to, r.mc, r.mw, r.order]
      );
    }
  });

  return ok({ message: rows.length ? `${rows.length} section(s) saved.` : 'Sections cleared.' });
}

async function saveKey(request) {
  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  const test = await loadTest(testId);
  if (!test) return fail('Test not found.', 404);

  const parsed = parseAnswerKey(b.text, Number(test.total_questions), optionLetters(test.option_count));
  if (parsed.key.size === 0) {
    return fail('No usable answers found. ' + parsed.errors.slice(0, 3).join(' '));
  }

  await tx(async (client) => {
    await client.query('DELETE FROM answer_keys WHERE test_id=$1', [testId]);
    for (const [qn, opt] of parsed.key) {
      await client.query('INSERT INTO answer_keys (test_id, q_no, correct_option) VALUES ($1,$2,$3)',
        [testId, qn, opt]);
    }
  });

  let message = `${parsed.key.size} of ${test.total_questions} answers saved.`;
  let level = 'ok';
  if (parsed.errors.length) {
    message += ' Skipped: ' + parsed.errors.slice(0, 5).join(' ');
    level = 'warn';
  }

  // A changed key invalidates every score already computed for this test.
  const done = Number(await scalar('SELECT COUNT(*) FROM results WHERE test_id=$1', [testId]));
  if (done) {
    const out = await evaluateTest(testId);
    message += ` Key changed, so ${out.evaluated} sheet(s) were re-evaluated and re-ranked.`;
  }

  return ok({ message, level });
}

async function importCandidates(request, staff) {
  const b = await request.json().catch(() => ({}));
  const parsed = parseCandidateList(b.text);

  if (!parsed.rows.length) {
    return fail('No candidates imported. ' + parsed.errors.slice(0, 3).join(' '));
  }

  const testId = Number(b.test_id ?? 0) || null;
  const branchId = staff.role === 'admin' ? null : staff.id;

  let added = 0, updated = 0, allotted = 0;

  await tx(async (client) => {
    for (const r of parsed.rows) {
      const existing = await client.query('SELECT id FROM candidates WHERE roll_no=$1', [r.roll_no]);
      let cid;

      if (existing.rows.length) {
        cid = existing.rows[0].id;
        await client.query('UPDATE candidates SET name=$1, mobile=$2 WHERE id=$3', [r.name, r.mobile, cid]);
        updated++;
      } else {
        const ins = await client.query(
          'INSERT INTO candidates (roll_no, name, mobile, branch_id) VALUES ($1,$2,$3,$4) RETURNING id',
          [r.roll_no, r.name, r.mobile, branchId]
        );
        cid = ins.rows[0].id;
        added++;
      }

      if (testId) {
        const a = await client.query(
          'INSERT INTO test_candidates (test_id, candidate_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [testId, cid]
        );
        allotted += a.rowCount;
      }
    }
  });

  let message = `${added} added, ${updated} updated`;
  if (testId) message += `, ${allotted} newly allotted to this test`;
  message += '.';

  let level = 'ok';
  if (parsed.errors.length) {
    message += ` Skipped ${parsed.errors.length} line(s): ` + parsed.errors.slice(0, 3).join(' ');
    level = 'warn';
  }

  return ok({ message, level, added, updated, allotted });
}

async function listCandidates(url) {
  const search = (url.searchParams.get('q') ?? '').trim();
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const per = 50;

  const where = search ? 'WHERE c.roll_no ILIKE $1 OR c.name ILIKE $1 OR c.mobile ILIKE $1' : '';
  const args = search ? [`%${search}%`] : [];

  const total = Number(await scalar(`SELECT COUNT(*) FROM candidates c ${where}`, args));
  const rows = await q(
    `SELECT c.id, c.roll_no, c.name, c.mobile, b.name AS branch_name,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.candidate_id=c.id) AS tests_allotted,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.candidate_id=c.id AND tc.status='submitted') AS tests_done
       FROM candidates c LEFT JOIN branches b ON b.id=c.branch_id
       ${where}
   ORDER BY c.roll_no
      LIMIT ${per} OFFSET ${(page - 1) * per}`,
    args
  );

  return ok({
    total, page, pages: Math.max(1, Math.ceil(total / per)),
    candidates: rows.map((c) => ({
      id: Number(c.id), roll_no: c.roll_no, name: c.name, mobile: c.mobile,
      branch_name: c.branch_name, tests_allotted: Number(c.tests_allotted),
      tests_done: Number(c.tests_done),
    })),
  });
}

async function setStatus(request) {
  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  const status = String(b.status ?? '');

  const test = await loadTest(testId);
  if (!test) return fail('Test not found.', 404);
  if (!['draft', 'open', 'closed', 'published'].includes(status)) return fail('Unknown status.');

  let extra = '';

  if (status === 'open') {
    const allot = Number(await scalar('SELECT COUNT(*) FROM test_candidates WHERE test_id=$1', [testId]));
    if (!allot) return fail('Allot at least one candidate before opening the test.');
  }

  if (status === 'published') {
    const keys = Number(await scalar('SELECT COUNT(*) FROM answer_keys WHERE test_id=$1', [testId]));
    if (!keys) return fail('Upload the answer key before publishing the result.');
    // Publishing always re-evaluates, so released numbers match the key and
    // the sheets exactly as they stand at that moment.
    const out = await evaluateTest(testId);
    extra = ` Evaluated ${out.evaluated} sheet(s) and ranked ${out.ranked} candidate(s).`;
  }

  await q('UPDATE tests SET status=$1 WHERE id=$2', [status, testId]);

  const said = {
    draft: 'moved back to draft', open: 'opened for filling',
    closed: 'closed', published: 'published to candidates',
  };
  return ok({ message: `Test ${said[status]}.${extra}` });
}

async function reEvaluate(request) {
  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  if (!(await loadTest(testId))) return fail('Test not found.', 404);

  const keys = Number(await scalar('SELECT COUNT(*) FROM answer_keys WHERE test_id=$1', [testId]));
  if (!keys) return fail('There is no answer key for this test yet.');

  const out = await evaluateTest(testId);
  return ok({ message: `Evaluated ${out.evaluated} sheet(s) and ranked ${out.ranked} candidate(s).` });
}

async function adminResults(url) {
  const testId = Number(url.searchParams.get('test_id'));
  const search = (url.searchParams.get('q') ?? '').trim();

  const test = await loadTest(testId);
  if (!test) return fail('Test not found.', 404);

  const stats = await one(
    `SELECT COUNT(*) AS n, MAX(score) AS hi, MIN(score) AS lo, AVG(score) AS avg
       FROM results WHERE test_id=$1`, [testId]
  );
  const pending = Number(await scalar(
    "SELECT COUNT(*) FROM test_candidates WHERE test_id=$1 AND status <> 'submitted'", [testId]
  ));

  const args = [testId];
  let extra = '';
  if (search) { args.push(`%${search}%`); extra = ' AND (c.roll_no ILIKE $2 OR c.name ILIKE $2)'; }

  const rows = await q(
    `SELECT r.*, c.roll_no, c.name, c.mobile
       FROM results r JOIN candidates c ON c.id = r.candidate_id
      WHERE r.test_id = $1 ${extra}
   ORDER BY r.score DESC, r.correct DESC, r.submitted_at ASC`,
    args
  );

  const waiting = await q(
    `SELECT c.id, c.roll_no, c.name, c.mobile, tc.status, tc.started_at
       FROM test_candidates tc JOIN candidates c ON c.id = tc.candidate_id
      WHERE tc.test_id = $1 AND tc.status <> 'submitted'
   ORDER BY c.roll_no`,
    [testId]
  );

  return ok({
    test: { id: Number(test.id), code: test.code, name: test.name, status: test.status },
    stats: {
      n: Number(stats.n),
      hi: stats.n ? fmtScore(stats.hi) : null,
      lo: stats.n ? fmtScore(stats.lo) : null,
      avg: stats.n ? fmtScore(Math.round(Number(stats.avg) * 100) / 100) : null,
      pending,
    },
    results: rows.map((r) => ({
      candidate_id: Number(r.candidate_id),
      rank: r.rank_overall === null ? null : Number(r.rank_overall),
      roll_no: r.roll_no, name: r.name,
      correct: Number(r.correct), wrong: Number(r.wrong), unattempted: Number(r.unattempted),
      score: fmtScore(r.score), max_score: fmtScore(r.max_score),
      percentage: fmtScore(r.percentage),
      percentile: r.percentile === null ? null : fmtScore(r.percentile),
      submitted_at: r.submitted_at,
    })),
    waiting: waiting.map((w) => ({
      id: Number(w.id), roll_no: w.roll_no, name: w.name, mobile: w.mobile,
      status: w.status, started_at: w.started_at,
    })),
  });
}

async function exportCsv(url) {
  const testId = Number(url.searchParams.get('test_id'));
  const test = await loadTest(testId);
  if (!test) return fail('Test not found.', 404);

  const sections = await loadSections(testId);
  const rows = await q(
    `SELECT r.*, c.roll_no, c.name, c.mobile
       FROM results r JOIN candidates c ON c.id = r.candidate_id
      WHERE r.test_id = $1
   ORDER BY r.score DESC, r.correct DESC, r.submitted_at ASC`,
    [testId]
  );

  const secRows = sections.length
    ? await q(
        `SELECT sr.* FROM section_results sr
           JOIN results r ON r.id = sr.result_id WHERE r.test_id = $1`, [testId])
    : [];
  const byResult = new Map();
  for (const r of secRows) {
    if (!byResult.has(Number(r.result_id))) byResult.set(Number(r.result_id), new Map());
    byResult.get(Number(r.result_id)).set(Number(r.section_id), r);
  }

  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const head = ['Rank', 'Roll No', 'Name', 'Mobile', 'Correct', 'Wrong', 'Not Attempted',
                'Attempted', 'Score', 'Max Score', 'Percentage', 'Percentile', 'Submitted At'];
  for (const s of sections) {
    head.push(`${s.name} - Correct`, `${s.name} - Wrong`, `${s.name} - Score`);
  }

  const lines = [head.map(esc).join(',')];

  for (const r of rows) {
    const line = [
      r.rank_overall ?? '', r.roll_no, r.name,
      // Leading apostrophe stops Excel eating the leading digit as a number.
      `'${r.mobile}`,
      r.correct, r.wrong, r.unattempted, r.attempted,
      fmtScore(r.score), fmtScore(r.max_score), fmtScore(r.percentage),
      r.percentile === null ? '' : fmtScore(r.percentile),
      r.submitted_at ? new Date(r.submitted_at).toISOString() : '',
    ];
    const secMap = byResult.get(Number(r.id));
    for (const s of sections) {
      const sr = secMap?.get(Number(s.id));
      line.push(sr ? sr.correct : '', sr ? sr.wrong : '', sr ? fmtScore(sr.score) : '');
    }
    lines.push(line.map(esc).join(','));
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const filename = `${String(test.code).replace(/[^A-Za-z0-9_-]+/g, '_')}_merit_list_${stamp}.csv`;

  return new Response('﻿' + lines.join('\n'), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function reopenSheet(request) {
  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  const candId = Number(b.candidate_id);

  await q(
    `UPDATE test_candidates SET status='in_progress', submitted_at=NULL
      WHERE test_id=$1 AND candidate_id=$2`, [testId, candId]
  );
  await q('DELETE FROM results WHERE test_id=$1 AND candidate_id=$2', [testId, candId]);

  return ok({ message: 'Sheet reopened. The candidate can log in and edit it while the test is open.' });
}

async function unallot(request) {
  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  const candId = Number(b.candidate_id);

  await q('DELETE FROM test_candidates WHERE test_id=$1 AND candidate_id=$2', [testId, candId]);
  await q('DELETE FROM responses       WHERE test_id=$1 AND candidate_id=$2', [testId, candId]);
  await q('DELETE FROM results         WHERE test_id=$1 AND candidate_id=$2', [testId, candId]);

  return ok({ message: 'Candidate removed from this test.' });
}

async function allotAll(request) {
  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  if (!(await loadTest(testId))) return fail('Test not found.', 404);

  const before = Number(await scalar('SELECT COUNT(*) FROM test_candidates WHERE test_id=$1', [testId]));
  await q(
    `INSERT INTO test_candidates (test_id, candidate_id)
     SELECT $1, id FROM candidates ON CONFLICT DO NOTHING`, [testId]
  );
  const after = Number(await scalar('SELECT COUNT(*) FROM test_candidates WHERE test_id=$1', [testId]));

  return ok({ message: `${after - before} candidate(s) allotted.` });
}

async function deleteTest(request, staff) {
  if (staff.role !== 'admin') return fail('Only a head office login can do this.', 403);

  const b = await request.json().catch(() => ({}));
  const testId = Number(b.test_id);
  const test = await loadTest(testId);

  if (!test) return fail('Test not found.', 404);
  if (String(b.confirm_code ?? '') !== test.code) {
    return fail('Type the test code exactly to confirm deletion. Nothing was deleted.');
  }

  await q('DELETE FROM tests WHERE id=$1', [testId]);
  return ok({ message: `Test "${test.name}" and all its sheets were deleted.` });
}

async function changePassword(request, staff) {
  const b = await request.json().catch(() => ({}));
  const current = String(b.current_password ?? '');
  const next = String(b.new_password ?? '');
  const again = String(b.confirm_password ?? '');

  const hash = await scalar('SELECT password_hash FROM branches WHERE id=$1', [staff.id]);

  if (!hash || !verifyPassword(current, hash)) return fail('Your current password is not correct.');
  if (next.length < 8) return fail('The new password must be at least 8 characters.');
  if (next !== again) return fail('The two new passwords do not match.');

  await q('UPDATE branches SET password_hash=$1 WHERE id=$2', [hashPassword(next), staff.id]);
  return ok({ message: 'Password changed.' });
}

async function addStaff(request, staff) {
  if (staff.role !== 'admin') return fail('Only a head office login can do this.', 403);

  const b = await request.json().catch(() => ({}));
  const username = String(b.username ?? '').trim();
  const name = String(b.name ?? '').trim();
  const password = String(b.password ?? '');
  const role = b.role === 'admin' ? 'admin' : 'branch';

  if (!username || !name) return fail('Username and branch name are required.');
  if (password.length < 8) return fail('The password must be at least 8 characters.');

  try {
    await q('INSERT INTO branches (username, password_hash, name, role) VALUES ($1,$2,$3,$4)',
      [username, hashPassword(password), name, role]);
  } catch (err) {
    if (err.code === '23505') return fail('That username is already taken.');
    throw err;
  }

  return ok({ message: `Login created for ${name}.` });
}


/**
 * Setup diagnosis. Deliberately open: it reports only whether the site is
 * configured, never any credential or data. The login page calls it so a
 * misconfigured deploy explains itself instead of failing with a blank error.
 */
async function health() {
  const checks = [];
  let allOk = true;

  const secret = process.env.SESSION_SECRET || '';
  const secretOk = secret.length >= 16;
  checks.push({
    id: 'secret',
    label: 'Login secret',
    ok: secretOk,
    detail: secretOk
      ? 'SESSION_SECRET is set.'
      : 'SESSION_SECRET is missing or shorter than 16 characters. Add it in Netlify under Site configuration → Environment variables, then redeploy.',
  });
  if (!secretOk) allOk = false;

  const cs = connectionString();
  if (!cs) {
    checks.push({
      id: 'database',
      label: 'Database',
      ok: false,
      detail: 'No database is connected. In Netlify, either add a Netlify DB, or set DATABASE_URL to a Postgres connection string, then redeploy.',
    });
    return json({ ok: false, checks });
  }

  try {
    // Any query also applies the schema, so this proves both at once.
    const n = Number(await scalar('SELECT COUNT(*) FROM branches'));
    checks.push({ id: 'database', label: 'Database', ok: true, detail: 'Connected.' });
    checks.push({
      id: 'schema', label: 'Tables', ok: true,
      detail: `Ready. ${n} login${n === 1 ? '' : 's'} configured.`,
    });
  } catch (err) {
    checks.push({
      id: 'database', label: 'Database', ok: false,
      detail: 'The database is configured but could not be reached. Check the connection string is the pooled one and that the database is awake.',
    });
    return json({ ok: false, checks });
  }

  try {
    if (await seedPasswordUnchanged(db())) {
      checks.push({
        id: 'password', label: 'Default password', ok: false, warn: true,
        detail: `The "${SEED_USERNAME}" login still uses its published default password. Sign in and change it from the Candidates page.`,
      });
      allOk = false;
    }
  } catch { /* not important enough to fail the check */ }

  return json({ ok: allOk, checks });
}

/* =====================================================================
   Router
   =================================================================== */

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .replace(/\/+$/, '') || '/';

  const method = request.method.toUpperCase();
  const mutating = method !== 'GET' && method !== 'HEAD';

  if (mutating && !csrfOk(request)) {
    return fail('Bad request origin.', 403);
  }

  let session;
  try {
    session = readSession(request);
  } catch {
    return fail('The server is not configured: SESSION_SECRET is missing.', 500);
  }

  try {
    /* ---- public ---- */
    if (path === '/login' && method === 'POST') return await login(request);
    if (path === '/logout') {
      // Reached as a plain link as well as by fetch, so redirect rather than
      // leaving the visitor looking at JSON.
      return new Response(null, {
        status: 302,
        headers: { location: '/', 'set-cookie': clearCookie() },
      });
    }
    if (path === '/me') return await me(session);
    if (path === '/health') return await health();

    /* ---- candidate ---- */
    if (path === '/sheet' && method === 'GET') return await sheet(session);
    if (path === '/save' && method === 'POST') return await save(request, session);
    if (path === '/submit' && method === 'POST') return await submit(session);
    if (path === '/result' && method === 'GET') return await result(session);

    /* ---- staff ---- */
    if (path.startsWith('/admin')) {
      const staff = staffOf(session);
      if (!staff) return fail('Your session has expired. Please log in again.', 401);

      if (path === '/admin/overview' && method === 'GET') return await adminOverview();
      if (path === '/admin/test' && method === 'GET') return await adminTest(Number(url.searchParams.get('id')));
      if (path === '/admin/test' && method === 'POST') return await saveTest(request, staff);
      if (path === '/admin/sections' && method === 'POST') return await saveSections(request);
      if (path === '/admin/key' && method === 'POST') return await saveKey(request);
      if (path === '/admin/candidates' && method === 'GET') return await listCandidates(url);
      if (path === '/admin/candidates' && method === 'POST') return await importCandidates(request, staff);
      if (path === '/admin/allot-all' && method === 'POST') return await allotAll(request);
      if (path === '/admin/status' && method === 'POST') return await setStatus(request);
      if (path === '/admin/evaluate' && method === 'POST') return await reEvaluate(request);
      if (path === '/admin/results' && method === 'GET') return await adminResults(url);
      if (path === '/admin/export' && method === 'GET') return await exportCsv(url);
      if (path === '/admin/reopen' && method === 'POST') return await reopenSheet(request);
      if (path === '/admin/unallot' && method === 'POST') return await unallot(request);
      if (path === '/admin/delete-test' && method === 'POST') return await deleteTest(request, staff);
      if (path === '/admin/password' && method === 'POST') return await changePassword(request, staff);
      if (path === '/admin/staff' && method === 'POST') return await addStaff(request, staff);
    }

    return fail('Unknown endpoint.', 404);
  } catch (err) {
    console.error('API error', path, err);
    return fail('Something went wrong on the server. Please try again.', 500);
  }
}
