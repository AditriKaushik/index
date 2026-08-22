/* =====================================================================
   Scoring and ranking engine.

   Marking rules
   -------------
     correct answer      -> + the marks_correct that applies to that question
     wrong answer        -> + the marks_wrong that applies (negative, e.g. -0.25)
     not attempted       -> 0
     key is 'A,C'        -> either option is accepted as correct
     key is '*'  (bonus) -> every candidate gets marks_correct, attempted or not
     key is '-'  (drop)  -> question withdrawn: no marks, no penalty, and its
                            marks come out of the maximum too
     no key row at all   -> treated as dropped, so an incomplete key can never
                            penalise a candidate

   A section may override the test's marking scheme; NULL on the section
   means "inherit from the test".
   ===================================================================== */

const num = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * Per-question map of the marks that apply, resolving section overrides.
 * @returns {Map<number,{correct:number,wrong:number,sectionId:number|null}>}
 */
export function buildMarksMap(test, sections) {
  const total = Number(test.total_questions);
  const map = new Map();

  for (let q = 1; q <= total; q++) {
    map.set(q, {
      correct: Number(test.marks_correct),
      wrong: Number(test.marks_wrong),
      sectionId: null,
    });
  }

  for (const sec of sections) {
    const from = Math.max(1, Number(sec.q_from));
    const to = Math.min(total, Number(sec.q_to));
    for (let q = from; q <= to; q++) {
      const entry = map.get(q);
      if (!entry) continue;
      entry.sectionId = Number(sec.id);
      if (num(sec.marks_correct) !== null) entry.correct = Number(sec.marks_correct);
      if (num(sec.marks_wrong) !== null) entry.wrong = Number(sec.marks_wrong);
    }
  }

  return map;
}

/**
 * Outcome of one question.
 * @returns {'correct'|'wrong'|'unattempted'|'dropped'}
 */
export function gradeQuestion(key, marked) {
  const k = key === null || key === undefined ? '' : String(key).trim();
  const m = marked === null || marked === undefined ? '' : String(marked).trim().toUpperCase();

  // No key uploaded, or explicitly withdrawn.
  if (k === '' || k === '-') return 'dropped';

  // Bonus question: full marks for everybody.
  if (k === '*') return 'correct';

  if (m === '') return 'unattempted';

  const accepted = k.toUpperCase().split(',').map((s) => s.trim());
  return accepted.includes(m) ? 'correct' : 'wrong';
}

/**
 * Score one sheet from its stored responses. Pure - no database access.
 *
 * @param {object} test
 * @param {Array}  sections
 * @param {Map|object} keyMap    q_no -> correct_option
 * @param {Map|object} markedMap q_no -> marked_option
 */
export function scoreSheet(test, sections, keyMap, markedMap) {
  const total = Number(test.total_questions);
  const marks = buildMarksMap(test, sections);
  const getKey = (q) => (keyMap instanceof Map ? keyMap.get(q) : keyMap[q]);
  const getMarked = (q) => (markedMap instanceof Map ? markedMap.get(q) : markedMap[q]);

  const tot = { correct: 0, wrong: 0, unattempted: 0, attempted: 0, score: 0, maxScore: 0 };
  const perSection = new Map();

  for (let q = 1; q <= total; q++) {
    const key = getKey(q) ?? null;
    const marked = getMarked(q) ?? null;
    const outcome = gradeQuestion(key, marked);

    const { correct: mc, wrong: mw, sectionId: sid } = marks.get(q);

    if (sid !== null && !perSection.has(sid)) {
      perSection.set(sid, { correct: 0, wrong: 0, unattempted: 0, score: 0 });
    }
    const sec = sid !== null ? perSection.get(sid) : null;

    if (marked !== null && marked !== '') tot.attempted++;

    if (outcome === 'dropped') {
      // Withdrawn: neutral for the candidate and removed from the maximum.
      // Bucketed with unattempted so the three counts still sum to the paper.
      tot.unattempted++;
      if (sec) sec.unattempted++;
      continue;
    }

    tot.maxScore += mc;

    if (outcome === 'correct') {
      tot.correct++;
      tot.score += mc;
      if (sec) { sec.correct++; sec.score += mc; }
    } else if (outcome === 'wrong') {
      tot.wrong++;
      tot.score += mw;
      if (sec) { sec.wrong++; sec.score += mw; }
    } else {
      tot.unattempted++;
      if (sec) sec.unattempted++;
    }
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  tot.score = round2(tot.score);
  tot.maxScore = round2(tot.maxScore);
  tot.percentage = tot.maxScore > 0 ? round2((tot.score / tot.maxScore) * 100) : 0;

  for (const s of perSection.values()) s.score = round2(s.score);

  return { totals: tot, perSection };
}

/**
 * Ranking maths, kept pure so it can be tested without a database.
 *
 * Standard competition ranking on score alone: equal scores share a rank and
 * the next rank skips accordingly (1, 2, 2, 4). Percentile is the share of
 * candidates scoring strictly below.
 *
 * @param {Array<{id:number, score:number|string}>} rows ordered best-first
 * @returns {Map<number,{rank:number, percentile:number}>}
 */
export function computeRanks(rows) {
  const out = new Map();
  const n = rows.length;
  if (n === 0) return out;

  // How many candidates sit strictly below each distinct score.
  const counts = new Map();
  for (const r of rows) {
    const s = Number(r.score);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  const below = new Map();
  let running = 0;
  for (const s of [...counts.keys()].sort((a, b) => a - b)) {
    below.set(s, running);
    running += counts.get(s);
  }

  let rank = 0;
  let seen = 0;
  let lastScore = null;

  for (const r of rows) {
    seen++;
    const s = Number(r.score);
    if (lastScore === null || s !== lastScore) {
      rank = seen; // competition ranking: skip over the tie block
      lastScore = s;
    }
    out.set(r.id, {
      rank,
      percentile: Math.round((below.get(s) / n) * 10000) / 100,
    });
  }

  return out;
}

/** Option letters valid for a test, e.g. 4 -> ['A','B','C','D']. */
export function optionLetters(count) {
  const n = Math.max(2, Math.min(5, Number(count) || 4));
  return 'ABCDE'.slice(0, n).split('');
}

/** Format a score for display, dropping a trailing ".00". */
export function fmtScore(value) {
  const s = Number(value).toFixed(2);
  return s.replace(/\.00$/, '');
}
