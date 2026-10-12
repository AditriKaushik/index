// Test engine: builds mock tests from an exam's question bank, scores attempts
// and turns attempts into topic-level analysis. Pure functions only (no DOM,
// no storage) so the same file runs in the browser and in `node --test`.

// ---------- random ----------
export function makeRng(seed = Date.now()) {
  // mulberry32: small, fast, seedable - good enough for shuffling questions
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Split `n` into integer parts proportional to `weights` (largest remainder).
export function apportion(n, weights) {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (n <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map(w => (Math.max(0, w) / total) * n);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((x, y) => y[0] - x[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

// ---------- marking ----------
// Marks for one question of a section. Sections may carry their own marks
// (e.g. NDA Maths 2.5/question vs GAT 4/question); the negative mark keeps
// the exam's wrong:correct ratio.
export function sectionMarking(exam, sectionId) {
  const m = exam.pattern.marking;
  const sec = exam.pattern.sections.find(s => s.id === sectionId);
  let correct = m.correct;
  if (sec && sec.marks && sec.questions) correct = +(sec.marks / sec.questions).toFixed(4);
  const ratio = m.correct ? m.wrong / m.correct : 0;
  // a section may override negative marking, e.g. SSC MTS Session I has none
  const wrong = typeof sec?.wrong === 'number' ? sec.wrong : +(correct * ratio).toFixed(4);
  return { correct, wrong, unattempted: m.unattempted || 0, ...(typeof m.numericalWrong === 'number' ? { numericalWrong: m.numericalWrong } : {}) };
}

// ---------- picking questions ----------
const DIFF_MIX = { easy: 0.3, medium: 0.5, hard: 0.2 };

// Pick `n` questions from `pool`, preferring unseen ones, then matching the
// difficulty mix, randomised by `rng`.
function pickFrom(pool, n, seen, rng, difficulty) {
  if (n <= 0) return [];
  let cands = pool;
  if (difficulty && difficulty !== 'mixed') {
    const exact = pool.filter(q => q.difficulty === difficulty);
    if (exact.length) cands = exact.length >= n ? exact : exact.concat(pool.filter(q => q.difficulty !== difficulty));
  }
  const fresh = shuffle(cands.filter(q => !seen.has(q.id)), rng);
  const old = shuffle(cands.filter(q => seen.has(q.id)), rng);
  if (difficulty && difficulty !== 'mixed') return fresh.concat(old).slice(0, n);
  // balance difficulty within the fresh questions first
  const want = apportion(n, Object.values(DIFF_MIX));
  const out = [];
  Object.keys(DIFF_MIX).forEach((d, i) => out.push(...fresh.filter(q => q.difficulty === d).slice(0, want[i])));
  for (const q of fresh.concat(old)) {
    if (out.length >= n) break;
    if (!out.includes(q)) out.push(q);
  }
  return out.slice(0, n);
}

// Pick `n` questions of one section spread across topics by weightage.
function pickSection(exam, sectionId, n, seen, rng, opts = {}) {
  const pool = exam.questions.filter(q => q.section === sectionId && (!opts.topics || opts.topics.includes(q.topic)));
  if (n >= pool.length) return pickFrom(pool, pool.length, seen, rng, opts.difficulty);
  const topics = exam.trendAnalysis.topics.filter(t => t.section === sectionId && (!opts.topics || opts.topics.includes(t.topic)));
  const byTopic = topics.map(t => pool.filter(q => q.topic === t.topic));
  const weights = topics.map((t, i) => (byTopic[i].length ? (opts.topicWeights?.[t.topic] ?? t.weightage ?? 1) : 0));
  const share = apportion(n, weights);
  let out = [];
  topics.forEach((t, i) => out.push(...pickFrom(byTopic[i], Math.min(share[i], byTopic[i].length), seen, rng, opts.difficulty)));
  if (out.length < n) {
    // topics that ran short: top up from whatever is left in the section
    const rest = pool.filter(q => !out.includes(q));
    out = out.concat(pickFrom(rest, n - out.length, seen, rng, opts.difficulty));
  }
  return out;
}

const avgSecondsPerQuestion = exam => (exam.pattern.durationMinutes * 60) / exam.pattern.totalQuestions;

// Questions that share a `passage` (RC passage, DI table, puzzle set) are
// served as a whole set, as in the real paper. When a set is pulled in, the
// same number of stand-alone questions of that section is dropped so the test
// length stays about the same.
function completeSets(exam, picked) {
  const inTest = new Set(picked.map(q => q.id));
  const added = {};
  for (const q of picked.slice()) {
    if (!q.passage) continue;
    for (const sib of exam.questions) {
      if (sib.passage === q.passage && !inTest.has(sib.id)) {
        picked.push(sib); inTest.add(sib.id);
        added[sib.section] = (added[sib.section] || 0) + 1;
      }
    }
  }
  for (const [sec, n] of Object.entries(added)) {
    let drop = n;
    for (let i = picked.length - 1; i >= 0 && drop > 0; i--) {
      if (picked[i].section === sec && !picked[i].passage) { picked.splice(i, 1); drop--; }
    }
  }
  return picked;
}

// Build a test. kinds:
//   full   – mirrors the real pattern (scaled down evenly if the bank is small)
//   custom – {sections?, topics?, count, difficulty}
//   weak   – {weakTopics: [{section, topic, score}], count}
// Options whose meaning depends on their position or on the other options
// ("All of the above", "Both A and R …", "1 and 2 only", bare letters) stay in order.
const FIXED_ORDER = /\b(all|none|both|neither)\b|\babove\b|\bonly\b|\band\b.*\d|^\(?[a-e1-5]\)?$|statement|assertion|reason|cannot be determined|data (is |are )?(in)?sufficient/i;
export const canShuffle = q => qType(q) !== 'numerical' && !q.options.some(o => FIXED_ORDER.test(String(o).trim()));

// Only questions an independent review scored ≥ MIN_RELEVANCE against the
// exam's previous-year papers (and re-solved) may be served. See data/RELEVANCE.md.
export const MIN_RELEVANCE = 90;
export const servable = q => q.verified === true && (q.relevance?.score ?? 0) >= MIN_RELEVANCE;

export function buildTest(exam, kind, opts = {}, seed = Date.now()) {
  exam = { ...exam, questions: exam.questions.filter(servable) };
  const rng = makeRng(seed);
  const seen = new Set(opts.seenIds || []);
  let picked = [];
  let scaled = false;
  let missing = [];
  const sections = exam.pattern.sections;

  if (kind === 'full') {
    const avail = sections.map(s => exam.questions.filter(q => q.section === s.id).length);
    // a section with no approved questions yet is left out rather than
    // shrinking the whole mock to one question per section
    missing = sections.filter((s, i) => !avail[i]).map(s => s.id);
    const scale = Math.min(1, ...sections.map((s, i) => (s.questions && avail[i] ? avail[i] / s.questions : 1)));
    scaled = scale < 1;
    sections.forEach(s => {
      const n = scaled ? Math.max(1, Math.round(s.questions * scale)) : s.questions;
      if (missing.includes(s.id)) return;
      picked.push(...pickSection(exam, s.id, n, seen, rng));
    });
  } else if (kind === 'custom') {
    const secIds = opts.sections?.length ? opts.sections : sections.map(s => s.id);
    const weights = secIds.map(id => sections.find(s => s.id === id)?.questions || 1);
    const avail = secIds.map(id => exam.questions.filter(q => q.section === id && (!opts.topics?.length || opts.topics.includes(q.topic))).length);
    const count = Math.min(opts.count || 20, avail.reduce((a, b) => a + b, 0));
    const share = apportion(count, weights.map((w, i) => (avail[i] ? w : 0)));
    secIds.forEach((id, i) => picked.push(...pickSection(exam, id, share[i], seen, rng, { topics: opts.topics?.length ? opts.topics : null, difficulty: opts.difficulty })));
    if (picked.length < count) {
      const rest = exam.questions.filter(q => secIds.includes(q.section) && (!opts.topics?.length || opts.topics.includes(q.topic)) && !picked.includes(q));
      picked = picked.concat(pickFrom(rest, count - picked.length, seen, rng, opts.difficulty));
    }
  } else if (kind === 'weak') {
    const weak = (opts.weakTopics || []).slice(0, 6);
    const count = opts.count || 20;
    if (weak.length) {
      // weaker topics get more questions
      const share = apportion(count, weak.map(w => 1.5 - (w.score ?? 0.5)));
      weak.forEach((w, i) => {
        const pool = exam.questions.filter(q => q.section === w.section && q.topic === w.topic && !picked.includes(q));
        picked.push(...pickFrom(pool, share[i], seen, rng));
      });
    }
    if (picked.length < count) {
      // not enough history/questions yet: fill from the highest-weightage topics
      const top = exam.trendAnalysis.topics.slice().sort((a, b) => b.weightage - a.weightage);
      const order = new Map(top.map((t, i) => [`${t.section}|${t.topic}`, i]));
      const rest = exam.questions.filter(q => !picked.includes(q))
        .sort((a, b) => (order.get(`${a.section}|${a.topic}`) ?? 999) - (order.get(`${b.section}|${b.topic}`) ?? 999));
      picked = picked.concat(pickFrom(rest.slice(0, Math.max(count * 2, 1)), count - picked.length, seen, rng));
    }
  } else {
    throw new Error(`unknown test kind ${kind}`);
  }

  picked = completeSets(exam, picked);

  // keep sections in pattern order, as in the real paper, and the questions of
  // one passage / DI set together
  const secOrder = new Map(sections.map((s, i) => [s.id, i]));
  const firstPos = new Map();
  picked.forEach((q, i) => { const k = q.passage ? `p:${q.passage}` : `q:${q.id}`; if (!firstPos.has(k)) firstPos.set(k, i); });
  const groupPos = q => firstPos.get(q.passage ? `p:${q.passage}` : `q:${q.id}`);
  picked.sort((a, b) => (secOrder.get(a.section) - secOrder.get(b.section)) || (groupPos(a) - groupPos(b)));

  const fullTime = kind === 'full' && !scaled;
  const durationSec = fullTime
    ? exam.pattern.durationMinutes * 60
    : Math.max(60, Math.round(picked.length * avgSecondsPerQuestion(exam) / 60) * 60);

  return {
    examId: exam.id,
    kind,
    scaled: scaled || missing.length > 0,
    missingSections: missing,
    seed,
    createdAt: new Date().toISOString(),
    durationSec,
    questionIds: picked.map(q => q.id),
    // shown option order per question (original indices), so the position of
    // the correct answer can't be memorised across tests
    optionOrder: Object.fromEntries(picked.filter(canShuffle).map(q => [q.id, shuffle(q.options.map((_, i) => i), rng)])),
  };
}

// ---------- scoring & analysis ----------
// Question types:
//   mcq (default) – answer: option index
//   msq           – answer: array of option indices (one or more correct).
//                   JEE Advanced rule: all correct → full; only correct options
//                   but not all → +(full/4) per option chosen; any wrong → negative.
//   numerical     – answer: number, optional tolerance (absolute, default 0.01)
export const qType = q => q.type || 'mcq';
export function isAnswered(q, a) {
  if (a === null || a === undefined || a === '') return false;
  return qType(q) === 'msq' ? Array.isArray(a) && a.length > 0 : true;
}
export function isCorrect(q, a) {
  if (!isAnswered(q, a)) return false;
  if (qType(q) === 'msq') return a.length === q.answer.length && q.answer.every(i => a.includes(i));
  if (qType(q) === 'numerical') return Math.abs(Number(a) - q.answer) <= (q.tolerance ?? 0.01) + 1e-9;
  return a === q.answer;
}
export function markAnswer(q, a, mk) {
  const answered = isAnswered(q, a);
  if (!answered) return { answered, ok: false, marks: mk.unattempted };
  if (isCorrect(q, a)) return { answered, ok: true, marks: mk.correct };
  if (qType(q) === 'msq' && a.every(i => q.answer.includes(i))) return { answered, ok: false, marks: +(mk.correct / 4 * a.length).toFixed(2) };
  if (qType(q) === 'numerical' && mk.numericalWrong !== undefined) return { answered, ok: false, marks: mk.numericalWrong };
  return { answered, ok: false, marks: mk.wrong };
}

// responses: { [questionId]: { answer: number|null, timeSec: number, marked: bool } }
export function scoreAttempt(exam, test, responses) {
  const byId = new Map(exam.questions.map(q => [q.id, q]));
  const qs = test.questionIds.map(id => byId.get(id)).filter(Boolean);
  const sec = {}, top = {};
  let score = 0, maxScore = 0, correct = 0, wrong = 0, skipped = 0, timeSec = 0;
  const items = [];

  for (const q of qs) {
    const r = responses[q.id] || {};
    const mk = sectionMarking(exam, q.section);
    const { answered, ok, marks } = markAnswer(q, r.answer, mk);
    score += marks; maxScore += mk.correct; timeSec += r.timeSec || 0;
    if (!answered) skipped++; else if (ok) correct++; else wrong++;

    const s = (sec[q.section] ||= { section: q.section, total: 0, correct: 0, wrong: 0, skipped: 0, score: 0, max: 0, timeSec: 0 });
    const tk = `${q.section}|${q.topic}`;
    const t = (top[tk] ||= { section: q.section, topic: q.topic, total: 0, correct: 0, wrong: 0, skipped: 0, timeSec: 0 });
    for (const o of [s, t]) {
      o.total++; o.timeSec += r.timeSec || 0;
      if (!answered) o.skipped++; else if (ok) o.correct++; else o.wrong++;
    }
    s.score += marks; s.max += mk.correct;
    items.push({ id: q.id, answer: answered ? r.answer : null, correct: ok, marks, timeSec: r.timeSec || 0 });
  }

  const attempted = correct + wrong;
  const round = x => Math.round(x * 100) / 100;
  for (const s of Object.values(sec)) { s.score = round(s.score); s.max = round(s.max); }
  return {
    score: round(score), maxScore: round(maxScore), correct, wrong, skipped,
    total: qs.length, attempted,
    accuracy: attempted ? correct / attempted : 0,
    timeSec,
    sections: Object.values(sec),
    topics: Object.values(top),
    items,
  };
}

// Combine topic results across all attempts of an exam (most recent weighted
// more) and rank topics weakest first. score: 0..1 (1 = mastered).
export function topicMastery(exam, results) {
  const agg = {};
  results.forEach((res, idx) => {
    const w = 1 + idx / Math.max(1, results.length); // later attempts count more
    for (const t of res.topics || []) {
      const a = (agg[`${t.section}|${t.topic}`] ||= { section: t.section, topic: t.topic, seen: 0, correct: 0, wrong: 0, skipped: 0, wSum: 0, wCorrect: 0, timeSec: 0 });
      a.seen += t.total; a.correct += t.correct; a.wrong += t.wrong; a.skipped += t.skipped; a.timeSec += t.timeSec;
      a.wSum += w * t.total; a.wCorrect += w * t.correct;
    }
  });
  const weight = new Map(exam.trendAnalysis.topics.map(t => [`${t.section}|${t.topic}`, t.weightage]));
  return Object.values(agg).map(a => {
    // shrink towards 50% when we have little evidence
    const score = (a.wCorrect + 1) / (a.wSum + 2);
    return { ...a, score, weightage: weight.get(`${a.section}|${a.topic}`) ?? 0, avgTime: a.seen ? a.timeSec / a.seen : 0 };
  }).sort((x, y) => (x.score - y.score) || (y.weightage - x.weightage));
}

// Plain-language advice from one result plus history.
export function recommendations(exam, result, mastery) {
  const tips = [];
  const secName = id => exam.pattern.sections.find(s => s.id === id)?.name || id;
  const avg = avgSecondsPerQuestion(exam);
  if (result.attempted && result.accuracy < 0.6 && exam.pattern.marking.wrong < 0)
    tips.push({ kind: 'warn', text: `Accuracy ${Math.round(result.accuracy * 100)}% with negative marking costs you marks — attempt only questions you can narrow to two options or fewer.` });
  if (result.skipped > result.total * 0.3)
    tips.push({ kind: 'info', text: `You left ${result.skipped} of ${result.total} unanswered. Practise timed sectional tests to build speed.` });
  const perQ = result.total ? result.timeSec / result.total : 0;
  if (perQ > avg * 1.2) tips.push({ kind: 'info', text: `You spent ${Math.round(perQ)}s per question; the real exam allows about ${Math.round(avg)}s.` });
  const secs = result.sections.slice().sort((a, b) => a.score / (a.max || 1) - b.score / (b.max || 1));
  if (secs.length > 1) tips.push({ kind: 'focus', text: `Weakest section this time: ${secName(secs[0].section)} (${secs[0].score}/${secs[0].max}). Strongest: ${secName(secs.at(-1).section)}.` });
  const weak = mastery.filter(m => m.score < 0.6 && m.seen >= 1).slice(0, 3);
  if (weak.length) tips.push({ kind: 'focus', text: `Revise next: ${weak.map(w => w.topic).join(', ')}. Use “Practise weak topics” to get a test built from these.` });
  const highYield = mastery.filter(m => m.weightage >= 8 && m.score < 0.7).slice(0, 2);
  if (highYield.length) tips.push({ kind: 'focus', text: `High-weightage topics still shaky: ${highYield.map(w => `${w.topic} (~${w.weightage}% of its section)`).join(', ')}.` });
  if (!tips.length) tips.push({ kind: 'good', text: 'Strong attempt! Try a full mock or raise the difficulty to “hard”.' });
  return tips;
}
