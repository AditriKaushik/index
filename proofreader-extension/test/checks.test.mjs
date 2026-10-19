// Run: node --test proofreader-extension/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../checks.js');

const cats = (t) => C.checkText(t).map((i) => i.category);

test('wrong arithmetic is flagged, right arithmetic is not', () => {
  assert.deepEqual(cats('If 25 + 17 = 43 then'), ['calculation']);
  assert.deepEqual(cats('20% of 450 = 80'), ['calculation']);
  assert.deepEqual(cats('Price 3.5 x 4 = 14.5'), ['calculation']);
  assert.deepEqual(cats('12 × 8 = 96'), []);
  assert.deepEqual(cats('Total = 1,250 + 750 = 2,000'), []);
  assert.deepEqual(cats('72 × 5/18 = 20 मीटर/सेकंड'), []);
  assert.deepEqual(cats('84 ÷ 4 = 21'), []);
  assert.deepEqual(cats('100/3 ≈ 33'), []);
  assert.deepEqual(cats('2.5 + 1.25 = 3.75'), []);
  assert.deepEqual(cats('25 + 17 = ?'), []);
});

test('evaluator respects precedence and brackets', () => {
  assert.equal(C.evaluate('2 + 3 × 4'), 14);
  assert.equal(C.evaluate('(2 + 3) × 4'), 20);
  assert.equal(C.evaluate('2^3 - 1'), 7);
  assert.ok(Number.isNaN(C.evaluate('2 + abc')));
});

test('spelling and repeated words', () => {
  assert.deepEqual(cats('Find the the value'), ['spelling']);
  assert.deepEqual(cats('The goverment recieved it'), ['spelling', 'spelling']);
  assert.deepEqual(cats('He said that that was fine'), []);
  assert.deepEqual(cats('राम धीरे धीरे चला'), []);
});

test('broken content markers', () => {
  assert.deepEqual(cats('Simplify \\frac{3}{4}'), ['broken']);
  assert.deepEqual(cats('A &amp; B'), ['broken']);
  assert.deepEqual(cats('Answer: undefined'), ['broken']);
});

test('Hindi danda and option labels', () => {
  assert.deepEqual(cats('राम घर जाता है |'), ['grammar']);
  assert.deepEqual(cats('(a) 10 (b) 12'), []);
  assert.deepEqual(cats('a) 10 b) 12'), []);
});

test('duplicate options', () => {
  assert.equal(C.checkOptions(['(a) 25', '(b) 30', '(c) 25', '(d) None']).length, 1);
  assert.equal(C.checkOptions(['(a) 25', '(b) 30', '(c) 35', '(d) 40']).length, 0);
});

test('near-duplicate similarity', () => {
  const a = C.shingles(C.normalize('Q1. If the cost price of an article is 450 and profit is 20%, find the selling price.'));
  const b = C.shingles(C.normalize('Q7. If the cost price of an article is 450 and the profit is 20%, find the selling price.'));
  assert.ok(C.jaccard(a, b) >= 0.6);
});
