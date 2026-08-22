<?php
/**
 * Scoring and ranking engine.
 *
 * Marking rules
 * -------------
 *   correct answer      -> + the marks_correct that applies to that question
 *   wrong answer        -> + the marks_wrong that applies (stored negative, e.g. -0.25)
 *   not attempted       -> 0
 *   key is 'A,C'        -> either option is accepted as correct
 *   key is '*'  (bonus) -> every candidate gets marks_correct, attempted or not
 *   key is '-'  (drop)  -> question withdrawn: no marks, no penalty, and its
 *                          marks come out of the maximum too
 *   no key row at all   -> treated as dropped, so an incomplete key can never
 *                          penalise a candidate
 *
 * A section may override the test's marking scheme; a NULL on the section
 * means "inherit from the test".
 */

/**
 * Build a per-question map of the marks that apply, resolving section overrides.
 *
 * @return array  q_no => array('correct' => float, 'wrong' => float, 'section_id' => int|null)
 */
function build_marks_map(array $test, array $sections)
{
    $map   = array();
    $total = (int)$test['total_questions'];

    for ($q = 1; $q <= $total; $q++) {
        $map[$q] = array(
            'correct'    => (float)$test['marks_correct'],
            'wrong'      => (float)$test['marks_wrong'],
            'section_id' => null,
        );
    }

    foreach ($sections as $sec) {
        $from = max(1, (int)$sec['q_from']);
        $to   = min($total, (int)$sec['q_to']);
        for ($q = $from; $q <= $to; $q++) {
            $map[$q]['section_id'] = (int)$sec['id'];
            if ($sec['marks_correct'] !== null) {
                $map[$q]['correct'] = (float)$sec['marks_correct'];
            }
            if ($sec['marks_wrong'] !== null) {
                $map[$q]['wrong'] = (float)$sec['marks_wrong'];
            }
        }
    }

    return $map;
}

/**
 * Decide the outcome of one question.
 *
 * @return string  one of: correct, wrong, unattempted, dropped
 */
function grade_question($key, $marked)
{
    $key    = $key === null ? '' : trim((string)$key);
    $marked = $marked === null ? '' : strtoupper(trim((string)$marked));

    // No key uploaded, or explicitly withdrawn.
    if ($key === '' || $key === '-') {
        return 'dropped';
    }

    // Bonus question: full marks for everybody.
    if ($key === '*') {
        return 'correct';
    }

    if ($marked === '') {
        return 'unattempted';
    }

    $accepted = array_map('trim', explode(',', strtoupper($key)));
    return in_array($marked, $accepted, true) ? 'correct' : 'wrong';
}

/**
 * Score one candidate's sheet and write results + section_results.
 * Safe to re-run: it recomputes from the stored responses every time.
 *
 * @return array the computed totals
 */
function evaluate_candidate(PDO $pdo, array $test, array $sections, array $key_map, $candidate_id)
{
    $test_id = (int)$test['id'];
    $total   = (int)$test['total_questions'];
    $marks   = build_marks_map($test, $sections);

    // The candidate's filled bubbles.
    $stmt = $pdo->prepare('SELECT q_no, marked_option FROM responses WHERE test_id = ? AND candidate_id = ?');
    $stmt->execute(array($test_id, $candidate_id));
    $marked_map = array();
    foreach ($stmt->fetchAll() as $row) {
        $marked_map[(int)$row['q_no']] = $row['marked_option'];
    }

    $tot = array('correct' => 0, 'wrong' => 0, 'unattempted' => 0, 'attempted' => 0,
                 'score' => 0.0, 'max_score' => 0.0);
    $per_section = array();

    for ($q = 1; $q <= $total; $q++) {
        $key     = isset($key_map[$q]) ? $key_map[$q] : null;
        $marked  = isset($marked_map[$q]) ? $marked_map[$q] : null;
        $outcome = grade_question($key, $marked);

        $mc  = $marks[$q]['correct'];
        $mw  = $marks[$q]['wrong'];
        $sid = $marks[$q]['section_id'];

        if ($sid !== null && !isset($per_section[$sid])) {
            $per_section[$sid] = array('correct' => 0, 'wrong' => 0, 'unattempted' => 0, 'score' => 0.0);
        }

        if ($marked !== null && $marked !== '') {
            $tot['attempted']++;
        }

        $delta = 0.0;

        if ($outcome === 'dropped') {
            // Withdrawn: neutral for the candidate and removed from the maximum.
            // Bucketed with unattempted so the three counts still sum to the paper.
            $tot['unattempted']++;
            if ($sid !== null) { $per_section[$sid]['unattempted']++; }
            continue;
        }

        $tot['max_score'] += $mc;

        if ($outcome === 'correct') {
            $tot['correct']++;
            $delta = $mc;
            if ($sid !== null) { $per_section[$sid]['correct']++; }
        } elseif ($outcome === 'wrong') {
            $tot['wrong']++;
            $delta = $mw;
            if ($sid !== null) { $per_section[$sid]['wrong']++; }
        } else {
            $tot['unattempted']++;
            if ($sid !== null) { $per_section[$sid]['unattempted']++; }
        }

        $tot['score'] += $delta;
        if ($sid !== null) { $per_section[$sid]['score'] += $delta; }
    }

    $tot['score']      = round($tot['score'], 2);
    $tot['max_score']  = round($tot['max_score'], 2);
    $tot['percentage'] = $tot['max_score'] > 0
        ? round($tot['score'] / $tot['max_score'] * 100, 2)
        : 0.0;

    // When the candidate submitted, if we know.
    $sub = $pdo->prepare('SELECT submitted_at FROM test_candidates WHERE test_id = ? AND candidate_id = ?');
    $sub->execute(array($test_id, $candidate_id));
    $submitted_at = $sub->fetchColumn();
    if (!$submitted_at) {
        $submitted_at = date('Y-m-d H:i:s');
    }

    $pdo->prepare(
        'INSERT INTO results
            (test_id, candidate_id, attempted, correct, wrong, unattempted,
             score, max_score, percentage, submitted_at, evaluated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE
            attempted=VALUES(attempted), correct=VALUES(correct), wrong=VALUES(wrong),
            unattempted=VALUES(unattempted), score=VALUES(score), max_score=VALUES(max_score),
            percentage=VALUES(percentage), submitted_at=VALUES(submitted_at), evaluated_at=NOW()'
    )->execute(array(
        $test_id, $candidate_id, $tot['attempted'], $tot['correct'], $tot['wrong'],
        $tot['unattempted'], $tot['score'], $tot['max_score'], $tot['percentage'], $submitted_at,
    ));

    $rid = $pdo->prepare('SELECT id FROM results WHERE test_id = ? AND candidate_id = ?');
    $rid->execute(array($test_id, $candidate_id));
    $result_id = (int)$rid->fetchColumn();

    if ($result_id && $per_section) {
        $ins = $pdo->prepare(
            'INSERT INTO section_results (result_id, section_id, correct, wrong, unattempted, score)
             VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
                correct=VALUES(correct), wrong=VALUES(wrong),
                unattempted=VALUES(unattempted), score=VALUES(score)'
        );
        foreach ($per_section as $sid => $s) {
            $ins->execute(array($result_id, $sid, $s['correct'], $s['wrong'],
                                $s['unattempted'], round($s['score'], 2)));
        }
    }

    $tot['result_id'] = $result_id;
    return $tot;
}

/**
 * Pure ranking maths, kept separate from the database so it can be tested.
 *
 * @param array $rows rows of array('id','score',...) already ordered best-first
 * @return array id => array('rank' => int, 'percentile' => float)
 */
function compute_ranks(array $rows)
{
    $n = count($rows);
    if ($n === 0) {
        return array();
    }

    // How many candidates sit strictly below each distinct score.
    $counts = array();
    foreach ($rows as $r) {
        $s = (string)(float)$r['score'];
        $counts[$s] = isset($counts[$s]) ? $counts[$s] + 1 : 1;
    }
    $below = array();
    $running = 0;
    foreach (array_reverse(array_keys($counts)) as $s) {
        $below[$s] = $running;
        $running  += $counts[$s];
    }

    $out        = array();
    $rank       = 0;
    $seen       = 0;
    $last_score = null;

    foreach ($rows as $r) {
        $seen++;
        $score = (string)(float)$r['score'];
        if ($last_score === null || $score !== $last_score) {
            $rank = $seen;           // competition ranking: skip over the tie block
            $last_score = $score;
        }
        $out[$r['id']] = array(
            'rank'       => $rank,
            'percentile' => round($below[$score] / $n * 100, 2),
        );
    }

    return $out;
}

/**
 * Recompute ranks and percentiles across every evaluated candidate of a test.
 *
 * Rank is standard competition ranking on score alone, so equal scores share a
 * rank and the next rank skips accordingly (1, 2, 2, 4). Display order breaks
 * ties by more correct answers, then by who submitted first.
 *
 * Percentile = share of candidates scoring strictly below this candidate.
 *
 * @return int number of candidates ranked
 */
function rank_test(PDO $pdo, $test_id)
{
    $stmt = $pdo->prepare(
        'SELECT id, score, correct, submitted_at
           FROM results
          WHERE test_id = ?
       ORDER BY score DESC, correct DESC, submitted_at ASC, id ASC'
    );
    $stmt->execute(array((int)$test_id));
    $rows = $stmt->fetchAll();

    $ranks = compute_ranks($rows);
    if (!$ranks) {
        return 0;
    }

    $upd = $pdo->prepare('UPDATE results SET rank_overall = ?, percentile = ? WHERE id = ?');
    foreach ($ranks as $id => $r) {
        $upd->execute(array($r['rank'], $r['percentile'], $id));
    }

    return count($ranks);
}

/** Load a test row, or null. */
function load_test(PDO $pdo, $test_id)
{
    $stmt = $pdo->prepare('SELECT * FROM tests WHERE id = ?');
    $stmt->execute(array((int)$test_id));
    $row = $stmt->fetch();
    return $row ? $row : null;
}

/** Load a test's sections in question order. */
function load_sections(PDO $pdo, $test_id)
{
    $stmt = $pdo->prepare('SELECT * FROM sections WHERE test_id = ? ORDER BY sort_order ASC, q_from ASC');
    $stmt->execute(array((int)$test_id));
    return $stmt->fetchAll();
}

/** Load a test's answer key as q_no => correct_option. */
function load_key_map(PDO $pdo, $test_id)
{
    $stmt = $pdo->prepare('SELECT q_no, correct_option FROM answer_keys WHERE test_id = ?');
    $stmt->execute(array((int)$test_id));
    $map = array();
    foreach ($stmt->fetchAll() as $r) {
        $map[(int)$r['q_no']] = $r['correct_option'];
    }
    return $map;
}

/**
 * Evaluate every submitted candidate of a test, then rank them.
 *
 * @return array array('evaluated' => int, 'ranked' => int)
 */
function evaluate_test(PDO $pdo, $test_id)
{
    $test = load_test($pdo, $test_id);
    if (!$test) {
        return array('evaluated' => 0, 'ranked' => 0);
    }

    $sections = load_sections($pdo, $test_id);
    $key_map  = load_key_map($pdo, $test_id);

    $stmt = $pdo->prepare(
        "SELECT candidate_id FROM test_candidates WHERE test_id = ? AND status = 'submitted'"
    );
    $stmt->execute(array((int)$test_id));
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($ids as $cid) {
        evaluate_candidate($pdo, $test, $sections, $key_map, (int)$cid);
    }

    // Drop results for anyone no longer marked submitted, so ranks stay honest.
    if ($ids) {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $del = $pdo->prepare("DELETE FROM results WHERE test_id = ? AND candidate_id NOT IN ($in)");
        $del->execute(array_merge(array((int)$test_id), $ids));
    } else {
        $pdo->prepare('DELETE FROM results WHERE test_id = ?')->execute(array((int)$test_id));
    }

    $ranked = rank_test($pdo, $test_id);

    return array('evaluated' => count($ids), 'ranked' => $ranked);
}
