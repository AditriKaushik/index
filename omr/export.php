<?php
/**
 * Merit list as a CSV download.
 */
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/evaluator.php';
require_staff();

$pdo     = db();
$test_id = get_int('test_id');
$test    = load_test($pdo, $test_id);

if (!$test) {
    http_response_code(404);
    die('Test not found.');
}

$sections = load_sections($pdo, $test_id);

$stmt = $pdo->prepare(
    'SELECT r.*, c.roll_no, c.name, c.mobile
       FROM results r
       JOIN candidates c ON c.id = r.candidate_id
      WHERE r.test_id = ?
   ORDER BY r.score DESC, r.correct DESC, r.submitted_at ASC'
);
$stmt->execute(array($test_id));
$rows = $stmt->fetchAll();

// Sectional scores, keyed result_id => section_id => score.
$sec_scores = array();
if ($sections) {
    $ss = $pdo->prepare(
        'SELECT sr.result_id, sr.section_id, sr.correct, sr.wrong, sr.score
           FROM section_results sr
           JOIN results r ON r.id = sr.result_id
          WHERE r.test_id = ?'
    );
    $ss->execute(array($test_id));
    foreach ($ss->fetchAll() as $r) {
        $sec_scores[(int)$r['result_id']][(int)$r['section_id']] = $r;
    }
}

$filename = preg_replace('/[^A-Za-z0-9_\-]+/', '_', $test['code']) . '_merit_list_' . date('Ymd_Hi') . '.csv';

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');

$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");   // BOM, so Excel opens it as UTF-8

$head = array('Rank', 'Roll No', 'Name', 'Mobile', 'Correct', 'Wrong', 'Not Attempted',
              'Attempted', 'Score', 'Max Score', 'Percentage', 'Percentile', 'Submitted At');
foreach ($sections as $s) {
    $head[] = $s['name'] . ' - Correct';
    $head[] = $s['name'] . ' - Wrong';
    $head[] = $s['name'] . ' - Score';
}
fputcsv($out, $head);

foreach ($rows as $r) {
    $line = array(
        $r['rank_overall'] !== null ? (int)$r['rank_overall'] : '',
        $r['roll_no'],
        $r['name'],
        // Leading apostrophe stops Excel eating the leading digit as a number.
        "'" . $r['mobile'],
        (int)$r['correct'],
        (int)$r['wrong'],
        (int)$r['unattempted'],
        (int)$r['attempted'],
        fmt_score($r['score']),
        fmt_score($r['max_score']),
        fmt_score($r['percentage']),
        $r['percentile'] !== null ? fmt_score($r['percentile']) : '',
        $r['submitted_at'],
    );
    foreach ($sections as $s) {
        $sr = isset($sec_scores[(int)$r['id']][(int)$s['id']]) ? $sec_scores[(int)$r['id']][(int)$s['id']] : null;
        $line[] = $sr ? (int)$sr['correct'] : '';
        $line[] = $sr ? (int)$sr['wrong'] : '';
        $line[] = $sr ? fmt_score($sr['score']) : '';
    }
    fputcsv($out, $line);
}

fclose($out);
