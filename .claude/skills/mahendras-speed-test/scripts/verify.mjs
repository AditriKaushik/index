#!/usr/bin/env node
// Structural checks on a Speed Test content module. Catches what a render will not show you.
//   node scripts/verify.mjs <content.js>
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const src = resolve(process.argv[2]);
const paper = (await import(pathToFileURL(src).href)).default;
const style = paper.brand.optionStyle || 'numeric';
const wantOpts = style === 'alpha' ? 4 : 5;

const problems = [];
const add = (sec, n, msg) => problems.push(`${sec} Q${n ?? '-'}: ${msg}`);

let total = 0, expectN = 1;
for (const sec of paper.sections) {
  const qs = sec.items.filter(i => i.n);
  total += qs.length;

  if (sec.count && qs.length !== sec.count)
    add(sec.name, null, `expected ${sec.count} questions, found ${qs.length}`);

  for (const it of sec.items) {
    if (it.dir) {
      if (!it.range) add(sec.name, null, `directions block has no range label`);
      if (sec.mode === 'parallel' && !it.hi) add(sec.name, null, `directions block "${String(it.en).slice(0,32)}…" has no Hindi`);
      continue;
    }
    if (it.n !== expectN) add(sec.name, it.n, `out of sequence — expected Q${expectN}`);
    expectN = it.n + 1;

    if (!it.en?.trim() && !it.stem && !it.passage) add(sec.name, it.n, 'no English text');
    if (sec.mode === 'parallel' && !it.hi?.trim()) add(sec.name, it.n, 'missing Hindi');
    if (!it.o?.length) add(sec.name, it.n, 'no options');
    else {
      if (it.o.length !== wantOpts) add(sec.name, it.n, `${it.o.length} options, house style is ${wantOpts}`);
      const seen = new Set(it.o.map(o => String(o).trim().toLowerCase()));
      if (seen.size !== it.o.length) add(sec.name, it.n, 'duplicate option text');
    }
    if (it.oh && it.o && it.oh.length !== it.o.length)
      add(sec.name, it.n, `Hindi options (${it.oh.length}) do not match English (${it.o.length})`);
    if (typeof it.ans === 'number' && (it.ans < 0 || it.ans >= (it.o?.length ?? 0)))
      add(sec.name, it.n, `answer index ${it.ans} out of range`);
  }
}

if (!paper.draft && total !== paper.brand.questions)
  problems.push(`paper: ${total} questions, masthead claims ${paper.brand.questions}`);
if (paper.draft) console.log('draft         : yes (question-count check skipped)');

// answer spread, when answers are present
const answers = paper.sections.flatMap(s => s.items.filter(i => typeof i.ans === 'number').map(i => i.ans));
if (answers.length) {
  const c = Array.from({ length: wantOpts }, (_, i) => answers.filter(a => a === i).length);
  const ideal = answers.length / wantOpts;
  console.log('answer spread :', c.map((n, i) => `${style === 'alpha' ? 'ABCD'[i] : i + 1}:${n}`).join('  '));
  if (c.some(n => n < ideal * 0.55 || n > ideal * 1.55))
    console.log('   ^ uneven — consider redistributing before publishing');
}

console.log(`sections      : ${paper.sections.length}`);
console.log(`questions     : ${total}`);
if (problems.length) { console.log(`\n${problems.length} problem(s):`); problems.forEach(p => console.log('  -', p)); process.exit(1); }
console.log('\nAll structural checks passed.');
