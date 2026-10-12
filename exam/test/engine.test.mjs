import test from 'node:test';
import assert from 'node:assert/strict';
import { servable, canShuffle, buildTest, scoreAttempt, topicMastery, recommendations, apportion, sectionMarking } from '../js/engine.js';
import { accessStatus, recordTestStart, grantSupportPass, canRequestSupport, PLAN } from '../js/access.js';

// small synthetic exam: 2 sections, 3 topics, 40 questions
const exam = {
  id: 'demo',
  pattern: { durationMinutes: 60, totalQuestions: 50, totalMarks: 200, marking: { correct: 2, wrong: -0.5, unattempted: 0 },
    sections: [{ id: 'a', name: 'A', questions: 25, marks: 50 }, { id: 'b', name: 'B', questions: 25, marks: 150 }] },
  trendAnalysis: { topics: [
    { section: 'a', topic: 'x', weightage: 70 }, { section: 'a', topic: 'y', weightage: 30 },
    { section: 'b', topic: 'z', weightage: 100 }] },
  questions: [],
};
const diffs = ['easy', 'medium', 'medium', 'hard'];
for (let i = 0; i < 40; i++) {
  const sec = i < 20 ? 'a' : 'b';
  exam.questions.push({ id: 'q' + i, section: sec, topic: sec === 'b' ? 'z' : i % 3 ? 'x' : 'y', difficulty: diffs[i % 4], options: ['p', 'q', 'r', 's'], answer: i % 4, verified: true, relevance: { score: 95 } });
}

test('apportion keeps the total and the proportions', () => {
  assert.deepEqual(apportion(10, [70, 30]), [7, 3]);
  assert.equal(apportion(7, [1, 1, 1]).reduce((a, b) => a + b), 7);
  assert.deepEqual(apportion(5, [0, 0]), [0, 0]);
});

test('section marking keeps the negative ratio', () => {
  assert.deepEqual(sectionMarking(exam, 'a'), { correct: 2, wrong: -0.5, unattempted: 0 });
  assert.deepEqual(sectionMarking(exam, 'b'), { correct: 6, wrong: -1.5, unattempted: 0 });
});

test('full mock scales to the bank and keeps section ratio, no duplicates', () => {
  const t = buildTest(exam, 'full', {}, 42);
  assert.ok(t.scaled);
  assert.equal(new Set(t.questionIds).size, t.questionIds.length);
  const a = t.questionIds.filter(id => +id.slice(1) < 20).length;
  assert.equal(a, t.questionIds.length - a); // 25:25 pattern -> equal split
  assert.ok(t.durationSec > 0 && t.durationSec <= 3600);
});

test('full mock is deterministic for a seed and prefers unseen questions', () => {
  assert.deepEqual(buildTest(exam, 'full', {}, 7).questionIds, buildTest(exam, 'full', {}, 7).questionIds);
  const seen = exam.questions.slice(0, 10).map(q => q.id);
  const t = buildTest(exam, 'custom', { sections: ['a'], count: 10, seenIds: seen }, 1);
  assert.ok(t.questionIds.every(id => !seen.includes(id)));
});

test('custom respects topic and difficulty filters', () => {
  const t = buildTest(exam, 'custom', { sections: ['a'], topics: ['y'], count: 5, difficulty: 'mixed' }, 3);
  assert.ok(t.questionIds.length > 0);
  for (const id of t.questionIds) assert.equal(exam.questions.find(q => q.id === id).topic, 'y');
});

test('scoring applies negative marking and analysis finds weak topics', () => {
  const t = buildTest(exam, 'custom', { count: 20 }, 9);
  const responses = {};
  for (const id of t.questionIds) {
    const q = exam.questions.find(x => x.id === id);
    // get every 'x' question right, every 'z' wrong, skip 'y'
    responses[id] = { answer: q.topic === 'x' ? q.answer : q.topic === 'z' ? (q.answer + 1) % 4 : null, timeSec: 30 };
  }
  const r = scoreAttempt(exam, t, responses);
  assert.equal(r.correct + r.wrong + r.skipped, r.total);
  const expected = r.items.reduce((s, it) => s + it.marks, 0);
  assert.ok(Math.abs(r.score - expected) < 0.01);
  const m = topicMastery(exam, [r]);
  assert.equal(m[0].topic, 'z');
  const weak = buildTest(exam, 'weak', { weakTopics: m, count: 10 }, 5);
  const zCount = weak.questionIds.filter(id => exam.questions.find(q => q.id === id).topic === 'z').length;
  assert.ok(zCount >= 4, `weak test should focus on z, got ${zCount}`);
  assert.ok(recommendations(exam, r, m).length > 0);
});

test('access: free first day, then daily free quota, support pass unlocks', () => {
  const day1 = new Date('2026-10-10T09:00:00').getTime();
  let s = { firstSeen: day1 };
  for (let i = 0; i < 5; i++) { assert.ok(accessStatus(s, day1).allowed); s = recordTestStart(s, day1); }
  const day2 = new Date('2026-10-11T09:00:00').getTime();
  assert.equal(accessStatus(s, day2).reason, 'daily-free');
  for (let i = 0; i < PLAN.dailyFreeTests; i++) s = recordTestStart(s, day2);
  assert.equal(accessStatus(s, day2).allowed, false);
  assert.ok(canRequestSupport(s, day2));
  s = grantSupportPass(s, day2);
  assert.equal(accessStatus(s, day2).reason, 'pass');
  assert.equal(canRequestSupport(s, day2 + 86400000), false);
});

test('a section can switch off negative marking', () => {
  const e = { ...exam, pattern: { ...exam.pattern, sections: [{ ...exam.pattern.sections[0], wrong: 0 }, exam.pattern.sections[1]] } };
  assert.equal(sectionMarking(e, 'a').wrong, 0);
  assert.equal(sectionMarking(e, 'b').wrong, -1.5);
});

test('questions below 90 PYQ relevance or unverified are never served', () => {
  const e = { ...exam, questions: exam.questions.map((q, i) => (i % 2 ? { ...q, relevance: { score: 85 } } : i % 4 === 0 ? { ...q, verified: false } : q)) };
  const ok = new Set(e.questions.filter(servable).map(q => q.id));
  assert.equal(ok.size, 10);
  for (const kind of ['full', 'custom', 'weak']) {
    const t = buildTest(e, kind, { count: 40 }, 11);
    assert.ok(t.questionIds.length > 0);
    assert.ok(t.questionIds.every(id => ok.has(id)), kind);
  }
});

test('option order is shuffled per test except for order-dependent options', () => {
  const t = buildTest(exam, 'custom', { count: 20 }, 21);
  const perms = Object.values(t.optionOrder);
  assert.equal(perms.length, t.questionIds.length);
  for (const p of perms) assert.deepEqual(p.slice().sort(), [0, 1, 2, 3]);
  assert.ok(perms.some(p => p.join() !== '0,1,2,3'));
  assert.equal(canShuffle({ options: ['1 only', '2 only', 'Both 1 and 2', 'Neither 1 nor 2'] }), false);
  assert.equal(canShuffle({ options: ['A', 'B', 'C', 'D'] }), false);
  assert.equal(canShuffle({ options: ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'] }), true);
});
