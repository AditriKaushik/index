import { gradeQuestion, buildMarksMap, computeRanks, scoreSheet, optionLetters, fmtScore }
  from '../netlify/functions/lib/evaluator.mjs';

let pass = 0, fail = 0;
const chk = (l, g, w) => {
  const ok = (typeof w === 'number' && typeof g === 'number') ? Math.abs(g - w) < 0.005 : JSON.stringify(g) === JSON.stringify(w);
  if (ok) { pass++; console.log(`  ok   ${l}`); }
  else { fail++; console.log(`  FAIL ${l} -> got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`); }
};

console.log('gradeQuestion (mirrors the PHP suite):');
chk('correct',           gradeQuestion('A', 'A'),    'correct');
chk('wrong',             gradeQuestion('A', 'B'),    'wrong');
chk('unattempted null',  gradeQuestion('A', null),   'unattempted');
chk('unattempted empty', gradeQuestion('A', ''),     'unattempted');
chk('case insensitive',  gradeQuestion('a', 'A'),    'correct');
chk('lowercase marked',  gradeQuestion('A', 'a'),    'correct');
chk('multi-key hit',     gradeQuestion('A,C', 'C'),  'correct');
chk('multi-key miss',    gradeQuestion('A,C', 'B'),  'wrong');
chk('multi-key spaced',  gradeQuestion('A, C', 'C'), 'correct');
chk('bonus marked',      gradeQuestion('*', 'D'),    'correct');
chk('bonus unmarked',    gradeQuestion('*', null),   'correct');
chk('dropped marked',    gradeQuestion('-', 'A'),    'dropped');
chk('dropped unmarked',  gradeQuestion('-', null),   'dropped');
chk('missing key',       gradeQuestion(null, 'A'),   'dropped');
chk('empty key',         gradeQuestion('', 'A'),     'dropped');

console.log('\nbuildMarksMap (+1/-0.25 default, section 2 overrides to +2/-0.5):');
const test = { total_questions: 10, marks_correct: 1.0, marks_wrong: -0.25 };
const sections = [
  { id: 1, q_from: 1, q_to: 5,  marks_correct: null, marks_wrong: null },
  { id: 2, q_from: 6, q_to: 10, marks_correct: 2.0,  marks_wrong: -0.5 },
];
const m = buildMarksMap(test, sections);
chk('q1 inherits correct', m.get(1).correct, 1.0);
chk('q1 inherits wrong',   m.get(1).wrong, -0.25);
chk('q1 section id',       m.get(1).sectionId, 1);
chk('q6 override correct', m.get(6).correct, 2.0);
chk('q6 override wrong',   m.get(6).wrong, -0.5);
chk('map covers all',      m.size, 10);
const m3 = buildMarksMap(test, [{ id: 9, q_from: 8, q_to: 99, marks_correct: 3.0, marks_wrong: null }]);
chk('clipped to paper',    m3.get(10).correct, 3.0);
chk('no q11 created',      m3.has(11), false);

console.log('\nscoreSheet - TEST A from the PHP suite (bonus + dropped):');
const tA = { total_questions: 10, marks_correct: 1.0, marks_wrong: -0.25 };
const keyA = {1:'A',2:'B',3:'C',4:'D',5:'A',6:'B',7:'C',8:'D',9:'*',10:'-'};
let r = scoreSheet(tA, [], keyA, {1:'A',2:'B',3:'C',4:'D',5:'A',6:'B',7:'C',8:'D',9:'A',10:'A'});
chk('R001 correct=9',     r.totals.correct, 9);
chk('R001 wrong=0',       r.totals.wrong, 0);
chk('R001 unattempted=1', r.totals.unattempted, 1);
chk('R001 score=9',       r.totals.score, 9.0);
chk('R001 max=9',         r.totals.maxScore, 9.0);
chk('R001 sums to 10',    r.totals.correct + r.totals.wrong + r.totals.unattempted, 10);

r = scoreSheet(tA, [], keyA, {1:'A',2:'B',3:'C',4:'D',5:'B',6:'A',7:'D',8:'A'});
chk('R002 correct=5',  r.totals.correct, 5);
chk('R002 wrong=4',    r.totals.wrong, 4);
chk('R002 score=4',    r.totals.score, 4.0);
chk('R002 sums to 10', r.totals.correct + r.totals.wrong + r.totals.unattempted, 10);

r = scoreSheet(tA, [], keyA, {});
chk('R003 blank sheet still gets bonus', r.totals.correct, 1);
chk('R003 unattempted=9', r.totals.unattempted, 9);
chk('R003 score=1',       r.totals.score, 1.0);

console.log('\nscoreSheet - TEST B (per-section marks):');
const tB = { total_questions: 10, marks_correct: 1.0, marks_wrong: -0.25 };
const keyB = Object.fromEntries([...Array(10)].map((_, i) => [i + 1, 'A']));
r = scoreSheet(tB, sections, keyB, Object.fromEntries([...Array(10)].map((_, i) => [i + 1, 'A'])));
chk('all correct = 5*1 + 5*2 = 15', r.totals.score, 15.0);
chk('max = 15',      r.totals.maxScore, 15.0);
chk('percentage 100', r.totals.percentage, 100.0);

r = scoreSheet(tB, sections, keyB, {1:'A',2:'A',3:'A',4:'A',5:'A',6:'B',7:'B',8:'B',9:'B',10:'B'});
chk('5 right + 5 wrong in double section = 2.5', r.totals.score, 2.5);
chk('Reasoning score 5',  r.perSection.get(1).score, 5.0);
chk('Quant score -2.5',   r.perSection.get(2).score, -2.5);
chk('Quant wrong 5',      r.perSection.get(2).wrong, 5);
chk('sections sum to total',
    r.perSection.get(1).score + r.perSection.get(2).score, r.totals.score);

console.log('\ncomputeRanks:');
let rk = computeRanks([{id:1,score:'55.00'},{id:2,score:'50.00'},{id:3,score:'40.00'},{id:4,score:'30.00'},{id:5,score:'10.00'}]);
chk('top rank',        rk.get(1).rank, 1);
chk('last rank',       rk.get(5).rank, 5);
chk('top percentile',  rk.get(1).percentile, 80.0);
chk('last percentile', rk.get(5).percentile, 0.0);

rk = computeRanks([{id:1,score:'60'},{id:2,score:'50'},{id:3,score:'50'},{id:4,score:'40'}]);
chk('tie a rank 2',    rk.get(2).rank, 2);
chk('tie b rank 2',    rk.get(3).rank, 2);
chk('skips to 4',      rk.get(4).rank, 4);
chk('tied percentile', rk.get(2).percentile, rk.get(3).percentile);

rk = computeRanks([{id:1,score:'5'},{id:2,score:'0'},{id:3,score:'-2.5'}]);
chk('negative last',   rk.get(3).rank, 3);
chk('top pct',         rk.get(1).percentile, 66.67);

rk = computeRanks([{id:1,score:'50'},{id:2,score:'50.00'},{id:3,score:'50.0'}]);
chk('score forms unify', [rk.get(1).rank,rk.get(2).rank,rk.get(3).rank].join(''), '111');

chk('empty input',     computeRanks([]).size, 0);
rk = computeRanks([{id:7,score:'12'}]);
chk('single rank',     rk.get(7).rank, 1);
chk('single pct',      rk.get(7).percentile, 0.0);

console.log('\nhelpers:');
chk('optionLetters 4', optionLetters(4), ['A','B','C','D']);
chk('optionLetters 5', optionLetters(5), ['A','B','C','D','E']);
chk('clamps low',      optionLetters(1), ['A','B']);
chk('fmtScore drops .00', fmtScore(9), '9');
chk('fmtScore keeps .25', fmtScore(-0.25), '-0.25');
chk('fmtScore 1.75',      fmtScore(1.75), '1.75');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
