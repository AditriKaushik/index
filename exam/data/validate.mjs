// Validates every exam/data/exams/*.json against SCHEMA.md and prints a report.
// Usage: node exam/data/validate.mjs [file...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'exams');
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f));

const CATS = ['engineering','medical','university','ssc','banking','railway','upsc','defence','teaching','management','law','state','school','postgraduate'];
let bad = 0;
for (const file of files) {
  const errs = [], warns = [];
  let e;
  try { e = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (x) { console.log(`✗ ${file}: invalid JSON – ${x.message}`); bad++; continue; }
  const req = (cond, msg) => { if (!cond) errs.push(msg); };
  req(e.id && path.basename(file, '.json') === e.id, 'id must equal file name');
  for (const k of ['name','fullName','category','conductingBody','notification','pattern','trendAnalysis','resources','questions']) req(e[k] !== undefined, `missing ${k}`);
  req(CATS.includes(e.category), `bad category ${e.category}`);
  const secIds = new Set((e.pattern?.sections || []).map(s => s.id));
  req(secIds.size > 0, 'pattern.sections empty');
  const m = e.pattern?.marking || {};
  req(typeof m.correct === 'number' && typeof m.wrong === 'number', 'pattern.marking.correct/wrong must be numbers');
  const topics = new Map();
  for (const t of e.trendAnalysis?.topics || []) {
    if (!secIds.has(t.section)) errs.push(`topic "${t.topic}" has unknown section ${t.section}`);
    topics.set(`${t.section}|${t.topic}`, t);
  }
  // PYQ blueprint: archetypes seen in the last 3 years' papers (see RELEVANCE.md)
  const archetypes = new Map();
  for (const a of e.pyqBlueprint?.archetypes || []) {
    if (archetypes.has(a.id)) errs.push(`archetype ${a.id}: duplicate id`);
    if (!secIds.has(a.section)) errs.push(`archetype ${a.id}: unknown section ${a.section}`);
    if (!topics.has(`${a.section}|${a.topic}`)) errs.push(`archetype ${a.id}: topic "${a.topic}" not in trendAnalysis`);
    if (!a.pattern) errs.push(`archetype ${a.id}: pattern missing`);
    if (!Array.isArray(a.years) || a.years.length < 2) errs.push(`archetype ${a.id}: needs at least 2 PYQ years`);
    archetypes.set(a.id, a);
  }
  req(archetypes.size > 0, 'pyqBlueprint.archetypes missing');
  const ids = new Set();
  let verified = 0, relevant = 0, scoreSum = 0, ai = 0;
  const perSec = {};
  for (const q of e.questions || []) {
    const where = `question ${q.id}`;
    if (ids.has(q.id)) errs.push(`${where}: duplicate id`);
    ids.add(q.id);
    if (!secIds.has(q.section)) errs.push(`${where}: unknown section ${q.section}`);
    if (!Array.isArray(q.options) || q.options.length < 2) errs.push(`${where}: needs options`);
    else {
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) errs.push(`${where}: answer index out of range`);
      if (new Set(q.options.map(o => String(o).trim().toLowerCase())).size !== q.options.length) errs.push(`${where}: duplicate options`);
    }
    if (!q.question || !q.explanation) errs.push(`${where}: question/explanation missing`);
    if (!['easy','medium','hard'].includes(q.difficulty)) errs.push(`${where}: bad difficulty`);
    if (q.verified) verified++;
    const a = archetypes.get(q.archetype);
    if (!a) errs.push(`${where}: archetype "${q.archetype}" not in pyqBlueprint`);
    else if (a.section !== q.section || a.topic !== q.topic) errs.push(`${where}: archetype ${a.id} is for ${a.section}/${a.topic}`);
    const score = q.relevance?.score;
    if (typeof score !== 'number') errs.push(`${where}: relevance.score missing`);
    else if (score < 90) errs.push(`${where}: PYQ relevance ${score} < 90`);
    scoreSum += score || 0;
    if (!['ai', 'curated'].includes(q.source)) errs.push(`${where}: source must be "ai" or "curated"`);
    if (q.source === 'ai') ai++;
    if (topics.has(`${q.section}|${q.topic}`)) relevant++; else warns.push(`${where}: topic "${q.topic}" not in trendAnalysis`);
    perSec[q.section] = (perSec[q.section] || 0) + 1;
  }
  const n = (e.questions || []).length;
  const rel = n ? Math.round(100 * relevant / n) : 0;
  const ver = n ? Math.round(100 * verified / n) : 0;
  if (n && rel < 90) errs.push(`relevance ${rel}% < 90%`);
  if (n && ver < 100) errs.push(`only ${ver}% verified`);
  const status = errs.length ? '✗' : '✓';
  if (errs.length) bad++;
  const avg = n ? Math.round(scoreSum / n) : 0;
  console.log(`${status} ${e.id}: ${n} questions (${ai} AI), PYQ relevance avg ${avg}, syllabus ${rel}%, verified ${ver}%, archetypes ${archetypes.size}, per section ${JSON.stringify(perSec)}`);
  for (const x of errs.slice(0, 15)) console.log(`   error: ${x}`);
  for (const x of warns.slice(0, 5)) console.log(`   warn:  ${x}`);
}
process.exit(bad ? 1 : 0);
