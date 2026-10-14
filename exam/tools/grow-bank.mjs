// Grows an exam's question bank with Claude. Every new question is
//   1. written to match one PYQ archetype from the exam's pyqBlueprint,
//   2. re-solved by an independent reviewer that never sees the intended answer, and
//   3. scored for PYQ relevance by that reviewer using data/RELEVANCE.md.
// Only questions with the same answer AND relevance ≥ 90 are kept.
//
//   cd exam/tools && npm install
//   ANTHROPIC_API_KEY=... node grow-bank.mjs ssc-cgl 40        # add up to 40 questions
//   node grow-bank.mjs ssc-cgl 40 --dry-run                     # show the plan only
//
// Afterwards run `node ../data/validate.mjs` and `node ../data/build-catalog.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { apportion, MIN_RELEVANCE } from '../js/engine.js';

const MODEL = 'claude-opus-5-5';
const here = path.dirname(fileURLToPath(import.meta.url));
const [examId, countArg, ...flags] = process.argv.slice(2);
if (!examId) { console.error('usage: node grow-bank.mjs <exam-id> [count] [--dry-run]'); process.exit(1); }
const file = path.join(here, '..', 'data', 'exams', `${examId}.json`);
const exam = JSON.parse(fs.readFileSync(file, 'utf8'));
const rubric = fs.readFileSync(path.join(here, '..', 'data', 'RELEVANCE.md'), 'utf8');
const archetypes = exam.pyqBlueprint?.archetypes || [];
if (!archetypes.length) { console.error(`${examId} has no pyqBlueprint.archetypes`); process.exit(1); }
const want = +countArg || 30;

// Plan: each section gets its pattern share of the final bank; inside a section each
// topic gets its weightage share, split evenly over that topic's archetypes. Fill the
// biggest gaps first.
const total = exam.questions.length + want;
const secShare = apportion(total, exam.pattern.sections.map(s => s.questions || 1));
const plan = [];
exam.pattern.sections.forEach((s, i) => {
  const topics = exam.trendAnalysis.topics.filter(t => t.section === s.id && archetypes.some(a => a.section === s.id && a.topic === t.topic));
  const target = apportion(secShare[i], topics.map(t => t.weightage));
  topics.forEach((t, j) => {
    const arch = archetypes.filter(a => a.section === s.id && a.topic === t.topic);
    apportion(target[j], arch.map(() => 1)).forEach((n, k) => {
      const have = exam.questions.filter(q => q.archetype === arch[k].id).length;
      if (n > have) plan.push({ section: s, archetype: arch[k], need: n - have });
    });
  });
});
plan.sort((a, b) => b.need - a.need);
let budget = want;
for (const p of plan) { p.need = Math.min(p.need, budget); budget -= p.need; }
const work = plan.filter(p => p.need > 0);
console.table(work.map(p => ({ section: p.section.id, archetype: p.archetype.id, topic: p.archetype.topic, need: p.need })));
if (flags.includes('--dry-run')) process.exit(0);

const client = new Anthropic();
const nOpts = exam.questions[0]?.options.length || 4;
const Generated = z.object({ questions: z.array(z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  question: z.string(),
  options: z.array(z.string()),
  answer: z.number().int(),
  explanation: z.string(),
})) });
const Review = z.object({
  answer: z.number().int(),
  ambiguous: z.boolean(),
  scores: z.object({ archetype: z.number(), syllabus: z.number(), difficulty: z.number(), wording: z.number(), correctness: z.number() }),
  note: z.string(),
});

async function generate(p) {
  const res = await client.messages.parse({
    model: MODEL, max_tokens: 16000,
    output_config: { effort: 'high', format: zodOutputFormat(Generated) },
    system: 'You write original practice questions for Indian competitive exams. Each question must be a faithful new instance of the given previous-year-paper (PYQ) pattern: same concept, format, difficulty, time budget and kind of distractors. Be factually correct as of 2026, have exactly one correct option, and never copy a real previous-year question.',
    messages: [{ role: 'user', content: JSON.stringify({
      task: `Write ${p.need} new MCQs`,
      exam: `${exam.name} — ${exam.pattern.stage}`,
      section: p.section.name,
      pyqPattern: p.archetype,
      examTrend: exam.trendAnalysis.summary,
      styleExamples: exam.questions.filter(q => q.archetype === p.archetype.id).slice(0, 2).map(q => ({ question: q.question, options: q.options })),
      avoidDuplicatesOf: exam.questions.filter(q => q.topic === p.archetype.topic).map(q => q.question.slice(0, 120)),
      optionsPerQuestion: nOpts,
      format: 'answer = 0-based index of the correct option; plain text, unicode maths (no LaTeX); spread correct answers across positions',
    }) }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return [];
  return res.parsed_output.questions;
}

// Independent review: never sees the intended answer or the writer's explanation.
async function review(q, archetype) {
  const res = await client.messages.parse({
    model: MODEL, max_tokens: 8000,
    output_config: { effort: 'high', format: zodOutputFormat(Review) },
    system: `You are an independent reviewer for ${exam.name}. Solve the question yourself, then score its relevance to the exam's previous-year papers strictly by this rubric:\n\n${rubric}`,
    messages: [{ role: 'user', content: JSON.stringify({
      exam: `${exam.name} — ${exam.pattern.stage}`,
      claimedPyqPattern: archetype,
      question: q.question,
      options: q.options.map((o, i) => `${i}. ${o}`),
      instructions: 'Return answer = 0-based index you get. ambiguous = true if no option or more than one option is correct, or wording/facts are unclear or outdated. scores: archetype 0-30, syllabus 0-20, difficulty 0-20, wording 0-20, correctness 0-10. note: one line on why.',
    }) }],
  });
  return res.stop_reason === 'refusal' ? null : res.parsed_output;
}

let nextId = Math.max(0, ...exam.questions.map(q => +(q.id.match(/(\d+)$/)?.[1] || 0))) + 1;
let kept = 0, dropped = 0;
for (const p of work) {
  for (const q of await generate(p)) {
    const shapeOk = q.options.length === nOpts && q.answer >= 0 && q.answer < nOpts && new Set(q.options).size === nOpts;
    const r = shapeOk ? await review(q, p.archetype) : null;
    const score = r ? Object.values(r.scores).reduce((a, b) => a + b, 0) : 0;
    if (!r || r.ambiguous || r.answer !== q.answer || score < MIN_RELEVANCE) {
      dropped++;
      console.log(`  ✗ dropped (${!r ? 'bad shape/refused' : r.answer !== q.answer ? 'answer mismatch' : r.ambiguous ? 'ambiguous' : `relevance ${score}`}): ${q.question.slice(0, 70)}`);
      continue;
    }
    exam.questions.push({
      id: `${exam.id}-${String(nextId++).padStart(3, '0')}`, section: p.section.id, topic: p.archetype.topic, ...q,
      source: 'ai', archetype: p.archetype.id,
      relevance: { score: Math.round(score), by: 'independent-review', note: r.note },
      verified: true,
    });
    kept++;
  }
  fs.writeFileSync(file, JSON.stringify(exam, null, 2) + '\n'); // save after every pattern
  console.log(`${p.archetype.id}: bank now ${exam.questions.length}`);
}
console.log(`kept ${kept}, dropped ${dropped}`);
