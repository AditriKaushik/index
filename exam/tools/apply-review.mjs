// Blind review, step 2: compares the reviewer's independent answers with the
// answer key and records the PYQ relevance score. A question is kept only if
// the reviewer reached the same answer, did not flag it ambiguous, and scored
// it >= 90 (data/RELEVANCE.md). Everything else is removed from the bank.
//   node apply-review.mjs <exam-id> <review-results.json> [--keep-failed]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_RELEVANCE } from '../js/engine.js';

const [id, resultsFile, flag] = process.argv.slice(2);
if (!id || !resultsFile) { console.error('usage: node apply-review.mjs <exam-id> <results.json> [--keep-failed]'); process.exit(1); }
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'exams', `${id}.json`);
const e = JSON.parse(fs.readFileSync(file, 'utf8'));
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const LIMITS = { archetype: 30, syllabus: 20, difficulty: 20, wording: 20, correctness: 10 };
const stats = { kept: 0, mismatch: 0, ambiguous: 0, low: 0, unreviewed: 0 };
const failed = [];
e.questions = e.questions.filter(q => {
  const r = results[q.id];
  if (!r) { if (typeof q.relevance?.score === 'number' && q.verified) return true; stats.unreviewed++; return flag === '--keep-failed'; }
  const score = Object.entries(LIMITS).reduce((s, [k, max]) => s + Math.max(0, Math.min(max, Number(r.scores?.[k]) || 0)), 0);
  const why = r.answer !== q.answer ? 'mismatch' : r.ambiguous ? 'ambiguous' : score < MIN_RELEVANCE ? 'low' : null;
  if (why) {
    stats[why]++;
    failed.push({ id: q.id, why, score, reviewerAnswer: r.answer, key: q.answer, note: r.note });
    return flag === '--keep-failed';
  }
  q.relevance = { score, by: 'independent-review', note: String(r.note || '').slice(0, 300) };
  q.verified = true;
  stats.kept++;
  return true;
});
fs.writeFileSync(file, JSON.stringify(e, null, 2) + '\n');
console.log(`${id}: ${JSON.stringify(stats)}; bank now ${e.questions.length}`);
for (const f of failed) console.log(`  ✗ ${f.id} ${f.why} (score ${f.score}, reviewer ${f.reviewerAnswer} vs key ${f.key}): ${f.note || ''}`);
