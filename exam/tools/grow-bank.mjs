// Grows an exam's question bank with Claude, then proof-reads every new
// question with a second, independent pass. Only questions whose answer the
// checker reaches on its own (without being told) are kept.
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
import { apportion } from '../js/engine.js';

const MODEL = 'claude-opus-5-5';
const [examId, countArg, ...flags] = process.argv.slice(2);
if (!examId) { console.error('usage: node grow-bank.mjs <exam-id> [count] [--dry-run]'); process.exit(1); }
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'exams', `${examId}.json`);
const exam = JSON.parse(fs.readFileSync(file, 'utf8'));
const want = +countArg || 30;

// Plan: give each topic its weightage share of the exam, minus what the bank already holds,
// so the most under-covered high-weightage topics get filled first.
const total = exam.questions.length + want;
const secShare = apportion(total, exam.pattern.sections.map(s => s.questions || 1));
const plan = [];
exam.pattern.sections.forEach((s, i) => {
  const topics = exam.trendAnalysis.topics.filter(t => t.section === s.id);
  const target = apportion(secShare[i], topics.map(t => t.weightage));
  topics.forEach((t, j) => {
    const have = exam.questions.filter(q => q.section === s.id && q.topic === t.topic).length;
    if (target[j] > have) plan.push({ section: s.id, sectionName: s.name, topic: t.topic, need: target[j] - have, difficulty: t.difficulty });
  });
});
plan.sort((a, b) => b.need - a.need);
let budget = want;
for (const p of plan) { p.need = Math.min(p.need, budget); budget -= p.need; }
const work = plan.filter(p => p.need > 0);
console.table(work.map(({ sectionName, topic, need }) => ({ sectionName, topic, need })));
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
const Checked = z.object({ answer: z.number().int(), ambiguous: z.boolean(), issues: z.string() });

const examples = t => exam.questions.filter(q => q.topic === t).slice(0, 2).map(q => ({ question: q.question, options: q.options }));

async function generate(p) {
  const res = await client.messages.parse({
    model: MODEL, max_tokens: 16000,
    output_config: { effort: 'high', format: zodOutputFormat(Generated) },
    system: 'You write original practice questions for Indian competitive exams. Questions must match the real exam\'s recent style and difficulty, be factually correct as of 2026, have exactly one correct option, and never copy a real previous-year question.',
    messages: [{ role: 'user', content: JSON.stringify({
      task: `Write ${p.need} new MCQs`,
      exam: `${exam.name} — ${exam.pattern.stage}`,
      section: p.sectionName, topic: p.topic, typicalDifficulty: p.difficulty,
      optionsPerQuestion: nOpts,
      examTrend: exam.trendAnalysis.summary,
      styleExamples: examples(p.topic),
      avoidDuplicatesOf: exam.questions.filter(q => q.topic === p.topic).map(q => q.question.slice(0, 120)),
      format: 'answer = 0-based index of the correct option; plain text, unicode maths (no LaTeX); spread correct answers across positions',
    }) }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return [];
  return res.parsed_output.questions;
}

// Independent check: the checker never sees the intended answer.
async function check(q) {
  const res = await client.messages.parse({
    model: MODEL, max_tokens: 8000,
    output_config: { effort: 'high', format: zodOutputFormat(Checked) },
    messages: [{ role: 'user', content: `Solve this ${exam.name} question carefully. Return the 0-based index of the correct option. Set ambiguous=true if no option or more than one option is correct, or the wording is unclear/outdated.\n\n${q.question}\n\n${q.options.map((o, i) => `${i}. ${o}`).join('\n')}` }],
  });
  return res.parsed_output;
}

let nextId = Math.max(0, ...exam.questions.map(q => +(q.id.match(/(\d+)$/)?.[1] || 0))) + 1;
let kept = 0, dropped = 0;
for (const p of work) {
  const qs = await generate(p);
  for (const q of qs) {
    const ok = q.options.length === nOpts && q.answer >= 0 && q.answer < nOpts && new Set(q.options).size === nOpts;
    const c = ok ? await check(q) : null;
    if (!c || c.ambiguous || c.answer !== q.answer) { dropped++; console.log(`  ✗ dropped (${c ? c.issues || 'answer mismatch' : 'bad shape'}): ${q.question.slice(0, 70)}`); continue; }
    exam.questions.push({ id: `${exam.id}-${String(nextId++).padStart(3, '0')}`, section: p.section, topic: p.topic, ...q, verified: true });
    kept++;
  }
  fs.writeFileSync(file, JSON.stringify(exam, null, 2) + '\n'); // save after every topic
  console.log(`${p.topic}: bank now ${exam.questions.length}`);
}
console.log(`kept ${kept}, dropped ${dropped}`);
