// Blind review, step 1: writes a review sheet for an exam with every question
// that still needs review - WITHOUT the answer key or explanation - so the
// reviewer has to solve each one independently.
//   node review-sheet.mjs <exam-id> <out.json> [--all]
// --all includes questions that already have a relevance score.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [id, out, flag] = process.argv.slice(2);
if (!id || !out) { console.error('usage: node review-sheet.mjs <exam-id> <out.json> [--all]'); process.exit(1); }
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'exams', `${id}.json`);
const e = JSON.parse(fs.readFileSync(file, 'utf8'));
const arch = new Map((e.pyqBlueprint?.archetypes || []).map(a => [a.id, a]));
const todo = e.questions.filter(q => flag === '--all' || typeof q.relevance?.score !== 'number' || q.verified !== true);
fs.writeFileSync(out, JSON.stringify({
  exam: `${e.name} — ${e.pattern.stage}`,
  timePerQuestionSec: Math.round(e.pattern.durationMinutes * 60 / e.pattern.totalQuestions),
  instructions: 'For each item: solve it yourself; give answer (0-based), ambiguous (true if 0 or 2+ options correct, unclear or outdated), scores per data/RELEVANCE.md {archetype 0-30, syllabus 0-20, difficulty 0-20, wording 0-20, correctness 0-10} and a one-line note. Save as {"<question id>": {answer, ambiguous, scores, note}, ...}.',
  items: todo.map(q => ({ id: q.id, section: q.section, topic: q.topic, difficulty: q.difficulty, claimedPattern: arch.get(q.archetype) || null, question: q.question, options: q.options })),
}, null, 2));
console.log(`${id}: ${todo.length} questions to review -> ${out}`);
