<?php
/**
 * Candidate-side OMR endpoint. Replies with JSON.
 *
 *   action=save     answers = {"12":"A","13":"","14":"C"}
 *   action=submit   locks the sheet and evaluates it
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/evaluator.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_fail('POST required.', 405);
}

if (!auth_candidate_id() || !auth_test_id()) {
    json_out(array('ok' => false, 'expired' => true,
                   'error' => 'Your session has expired. Please log in again.'), 401);
}
csrf_verify(true);

$pdo          = db();
$candidate_id = auth_candidate_id();
$test_id      = auth_test_id();
$action       = post('action');

$test = load_test($pdo, $test_id);
if (!$test) {
    json_fail('That test is no longer available.', 410);
}

$stmt = $pdo->prepare('SELECT * FROM test_candidates WHERE test_id = ? AND candidate_id = ?');
$stmt->execute(array($test_id, $candidate_id));
$attempt = $stmt->fetch();

if (!$attempt) {
    json_fail('You are not allotted to this test.', 403);
}
if ($attempt['status'] === 'submitted') {
    json_fail('Your sheet has already been submitted and cannot be changed.', 409);
}
if ($test['status'] !== 'open') {
    json_fail('This test is closed. No further changes can be saved.', 409);
}

$total   = (int)$test['total_questions'];
$letters = option_letters($test['option_count']);

/* =====================================================================
 * Save a batch of bubbles
 * =================================================================== */
if ($action === 'save') {

    $raw     = isset($_POST['answers']) ? (string)$_POST['answers'] : '';
    $answers = json_decode($raw, true);

    if (!is_array($answers)) {
        json_fail('Malformed answer batch.');
    }
    if (count($answers) > 500) {
        json_fail('Too many answers in one batch.');
    }

    $set   = $pdo->prepare(
        'INSERT INTO responses (test_id, candidate_id, q_no, marked_option)
         VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE marked_option = VALUES(marked_option)'
    );
    $clear = $pdo->prepare('DELETE FROM responses WHERE test_id=? AND candidate_id=? AND q_no=?');

    $saved   = 0;
    $skipped = 0;

    $pdo->beginTransaction();
    try {
        foreach ($answers as $q_no => $option) {
            $q = (int)$q_no;
            if ($q < 1 || $q > $total) { $skipped++; continue; }

            $option = strtoupper(trim((string)$option));

            if ($option === '') {
                $clear->execute(array($test_id, $candidate_id, $q));
                $saved++;
                continue;
            }
            if (!in_array($option, $letters, true)) { $skipped++; continue; }

            $set->execute(array($test_id, $candidate_id, $q, $option));
            $saved++;
        }
        $pdo->commit();
    } catch (Exception $ex) {
        $pdo->rollBack();
        json_fail('Could not save your answers. Please try again.', 500);
    }

    // Authoritative count, so the candidate's progress bar can never drift.
    $cnt = $pdo->prepare(
        "SELECT COUNT(*) FROM responses
          WHERE test_id=? AND candidate_id=? AND marked_option IS NOT NULL AND marked_option <> ''"
    );
    $cnt->execute(array($test_id, $candidate_id));

    json_ok(array('saved' => $saved, 'skipped' => $skipped, 'filled' => (int)$cnt->fetchColumn()));
}

/* =====================================================================
 * Submit and lock the sheet
 * =================================================================== */
if ($action === 'submit') {

    $pdo->prepare("UPDATE test_candidates SET status='submitted', submitted_at=NOW()
                    WHERE test_id=? AND candidate_id=? AND status <> 'submitted'")
        ->execute(array($test_id, $candidate_id));

    // Score it straight away so the branch sees live totals. Rank is filled in
    // later, when head office publishes the test.
    $key_map = load_key_map($pdo, $test_id);
    if ($key_map) {
        $sections = load_sections($pdo, $test_id);
        evaluate_candidate($pdo, $test, $sections, $key_map, $candidate_id);
    }

    json_ok(array('redirect' => 'result.php'));
}

json_fail('Unknown action.');
