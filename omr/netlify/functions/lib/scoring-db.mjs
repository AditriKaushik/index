/* =====================================================================
   The database side of scoring: read a sheet, score it with the pure
   engine, write the result back, then rank the test.
   ===================================================================== */

import { q, one, tx } from './db.mjs';
import { scoreSheet, computeRanks } from './evaluator.mjs';

export async function loadTest(testId) {
  return one('SELECT * FROM tests WHERE id = $1', [testId]);
}

export async function loadSections(testId) {
  return q('SELECT * FROM sections WHERE test_id = $1 ORDER BY sort_order, q_from', [testId]);
}

export async function loadKeyMap(testId) {
  const rows = await q('SELECT q_no, correct_option FROM answer_keys WHERE test_id = $1', [testId]);
  return new Map(rows.map((r) => [Number(r.q_no), r.correct_option]));
}

export async function loadMarkedMap(testId, candidateId) {
  const rows = await q(
    'SELECT q_no, marked_option FROM responses WHERE test_id = $1 AND candidate_id = $2',
    [testId, candidateId]
  );
  return new Map(rows.map((r) => [Number(r.q_no), r.marked_option]));
}

/**
 * Score one candidate and persist the result. Safe to re-run: it always
 * recomputes from the stored responses.
 */
export async function evaluateCandidate(test, sections, keyMap, candidateId) {
  const markedMap = await loadMarkedMap(test.id, candidateId);
  const { totals, perSection } = scoreSheet(test, sections, keyMap, markedMap);

  const submittedAt = await one(
    'SELECT submitted_at FROM test_candidates WHERE test_id = $1 AND candidate_id = $2',
    [test.id, candidateId]
  );

  return tx(async (client) => {
    const res = await client.query(
      `INSERT INTO results
         (test_id, candidate_id, attempted, correct, wrong, unattempted,
          score, max_score, percentage, submitted_at, evaluated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, NOW()),NOW())
       ON CONFLICT (test_id, candidate_id) DO UPDATE SET
         attempted = EXCLUDED.attempted, correct = EXCLUDED.correct,
         wrong = EXCLUDED.wrong, unattempted = EXCLUDED.unattempted,
         score = EXCLUDED.score, max_score = EXCLUDED.max_score,
         percentage = EXCLUDED.percentage, submitted_at = EXCLUDED.submitted_at,
         evaluated_at = NOW()
       RETURNING id`,
      [test.id, candidateId, totals.attempted, totals.correct, totals.wrong,
       totals.unattempted, totals.score, totals.maxScore, totals.percentage,
       submittedAt?.submitted_at ?? null]
    );

    const resultId = res.rows[0].id;

    for (const [sectionId, s] of perSection) {
      await client.query(
        `INSERT INTO section_results (result_id, section_id, correct, wrong, unattempted, score)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (result_id, section_id) DO UPDATE SET
           correct = EXCLUDED.correct, wrong = EXCLUDED.wrong,
           unattempted = EXCLUDED.unattempted, score = EXCLUDED.score`,
        [resultId, sectionId, s.correct, s.wrong, s.unattempted, s.score]
      );
    }

    return { resultId, totals };
  });
}

/** Recompute ranks and percentiles across every evaluated candidate. */
export async function rankTest(testId) {
  const rows = await q(
    `SELECT id, score, correct, submitted_at
       FROM results
      WHERE test_id = $1
   ORDER BY score DESC, correct DESC, submitted_at ASC, id ASC`,
    [testId]
  );

  const ranks = computeRanks(rows);
  if (ranks.size === 0) return 0;

  await tx(async (client) => {
    for (const [id, r] of ranks) {
      await client.query('UPDATE results SET rank_overall = $1, percentile = $2 WHERE id = $3',
        [r.rank, r.percentile, id]);
    }
  });

  return ranks.size;
}

/** Evaluate every submitted candidate of a test, then rank them. */
export async function evaluateTest(testId) {
  const test = await loadTest(testId);
  if (!test) return { evaluated: 0, ranked: 0 };

  const sections = await loadSections(testId);
  const keyMap = await loadKeyMap(testId);

  const rows = await q(
    "SELECT candidate_id FROM test_candidates WHERE test_id = $1 AND status = 'submitted'",
    [testId]
  );
  const ids = rows.map((r) => Number(r.candidate_id));

  for (const cid of ids) {
    await evaluateCandidate(test, sections, keyMap, cid);
  }

  // Drop results for anyone no longer marked submitted, so ranks stay honest.
  if (ids.length) {
    await q('DELETE FROM results WHERE test_id = $1 AND NOT (candidate_id = ANY($2::int[]))', [testId, ids]);
  } else {
    await q('DELETE FROM results WHERE test_id = $1', [testId]);
  }

  const ranked = await rankTest(testId);
  return { evaluated: ids.length, ranked };
}
