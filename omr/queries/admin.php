<?php
/**
 * Staff actions. Ordinary form posts: each one redirects back with a flash
 * message rather than replying in JSON.
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/evaluator.php';
require_once __DIR__ . '/../includes/importers.php';

require_staff();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('../dashboard.php');
}
csrf_verify();

$pdo    = db();
$action = post('action');

/**
 * Resolve the "return to" page.
 *
 * This script lives in /queries/, so a bare "test_edit.php?id=3" would resolve
 * against /queries/ and 404. Every page is rewritten to sit one level up, and
 * only known page names are accepted so the parameter can never be turned into
 * an open redirect.
 */
function safe_back($raw)
{
    $raw = str_replace(array("\r", "\n", "\0"), '', trim((string)$raw));

    // Anything absolute, protocol-relative or with a scheme points off-site.
    if ($raw === '' || $raw[0] === '/' || strpos($raw, '//') === 0 || strpos($raw, ':') !== false) {
        return '../dashboard.php';
    }

    $raw   = ltrim($raw, './');
    $parts = explode('?', $raw, 2);
    $page  = $parts[0];

    $allowed = array('dashboard.php', 'tests.php', 'test_edit.php', 'candidates.php', 'results.php');
    if (!in_array($page, $allowed, true)) {
        return '../dashboard.php';
    }

    return '../' . $page . (isset($parts[1]) && $parts[1] !== '' ? '?' . $parts[1] : '');
}

$back = safe_back(post('back'));

/** Read pasted text, or an uploaded file if one was given. */
function uploaded_text($field_text, $field_file)
{
    if (!empty($_FILES[$field_file]['tmp_name']) && is_uploaded_file($_FILES[$field_file]['tmp_name'])) {
        if ($_FILES[$field_file]['size'] > 2 * 1024 * 1024) {
            return array('', 'That file is larger than 2 MB.');
        }
        $raw = file_get_contents($_FILES[$field_file]['tmp_name']);
        return array($raw === false ? '' : $raw, null);
    }
    return array(post($field_text), null);
}

/* =====================================================================
 * Create or update a test
 * =================================================================== */
if ($action === 'save_test') {

    $id     = post_int('id');
    $code   = post('code');
    $name   = post('name');
    $total  = post_int('total_questions');
    $opts   = post_int('option_count', 4);
    $mc     = (float)post('marks_correct', DEFAULT_MARKS_CORRECT);
    $mw     = (float)post('marks_wrong', DEFAULT_MARKS_WRONG);
    $mins   = post_int('duration_minutes');

    if ($code === '' || $name === '')      { flash('err', 'Test code and name are required.'); redirect($back); }
    if ($total < 1 || $total > 500)        { flash('err', 'Number of questions must be between 1 and 500.'); redirect($back); }
    if ($opts < 2 || $opts > 5)            { flash('err', 'Options per question must be between 2 and 5.'); redirect($back); }
    if ($mw > 0)                           { $mw = -$mw; }  // accept 0.25 and store -0.25

    try {
        if ($id) {
            // Shrinking the paper would orphan answers, so clear anything past the new end.
            $pdo->prepare(
                'UPDATE tests SET code=?, name=?, total_questions=?, option_count=?,
                        marks_correct=?, marks_wrong=?, duration_minutes=? WHERE id=?'
            )->execute(array($code, $name, $total, $opts, $mc, $mw, $mins, $id));

            $pdo->prepare('DELETE FROM responses   WHERE test_id=? AND q_no>?')->execute(array($id, $total));
            $pdo->prepare('DELETE FROM answer_keys WHERE test_id=? AND q_no>?')->execute(array($id, $total));

            flash('ok', 'Test updated.');
        } else {
            $pdo->prepare(
                'INSERT INTO tests (code, name, total_questions, option_count,
                                    marks_correct, marks_wrong, duration_minutes, created_by)
                 VALUES (?,?,?,?,?,?,?,?)'
            )->execute(array($code, $name, $total, $opts, $mc, $mw, $mins, auth_staff_id()));
            $id = (int)$pdo->lastInsertId();
            flash('ok', 'Test created. Now add its answer key and allot candidates.');
        }
    } catch (PDOException $ex) {
        flash('err', $ex->getCode() === '23000'
            ? 'That test code is already in use. Please pick another.'
            : 'Could not save the test.');
        redirect($back);
    }

    redirect('../test_edit.php?id=' . $id);
}

/* =====================================================================
 * Replace a test's sections
 * =================================================================== */
if ($action === 'save_sections') {

    $test_id = post_int('test_id');
    $test    = load_test($pdo, $test_id);
    if (!$test) { flash('err', 'Test not found.'); redirect($back); }

    $names = isset($_POST['sec_name'])    ? (array)$_POST['sec_name']    : array();
    $froms = isset($_POST['sec_from'])    ? (array)$_POST['sec_from']    : array();
    $tos   = isset($_POST['sec_to'])      ? (array)$_POST['sec_to']      : array();
    $mcs   = isset($_POST['sec_correct']) ? (array)$_POST['sec_correct'] : array();
    $mws   = isset($_POST['sec_wrong'])   ? (array)$_POST['sec_wrong']   : array();

    $rows   = array();
    $errors = array();

    foreach ($names as $i => $nm) {
        $nm = trim((string)$nm);
        if ($nm === '') { continue; }

        $from = isset($froms[$i]) ? (int)$froms[$i] : 0;
        $to   = isset($tos[$i])   ? (int)$tos[$i]   : 0;

        if ($from < 1 || $to < $from || $to > (int)$test['total_questions']) {
            $errors[] = '"' . $nm . '": question range must sit inside 1-' . (int)$test['total_questions'] . '.';
            continue;
        }

        $mc = (isset($mcs[$i]) && trim($mcs[$i]) !== '') ? (float)$mcs[$i] : null;
        $mw = (isset($mws[$i]) && trim($mws[$i]) !== '') ? (float)$mws[$i] : null;
        if ($mw !== null && $mw > 0) { $mw = -$mw; }

        $rows[] = array($test_id, $nm, $from, $to, $mc, $mw, count($rows));
    }

    // Overlapping sections would make a question's marks ambiguous.
    foreach ($rows as $a) {
        foreach ($rows as $b) {
            if ($a[6] >= $b[6]) { continue; }
            if ($a[2] <= $b[3] && $b[2] <= $a[3]) {
                $errors[] = '"' . $a[1] . '" and "' . $b[1] . '" overlap.';
            }
        }
    }

    if ($errors) {
        flash('err', implode(' ', $errors));
        redirect($back);
    }

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM sections WHERE test_id=?')->execute(array($test_id));
    if ($rows) {
        $ins = $pdo->prepare(
            'INSERT INTO sections (test_id, name, q_from, q_to, marks_correct, marks_wrong, sort_order)
             VALUES (?,?,?,?,?,?,?)'
        );
        foreach ($rows as $r) { $ins->execute($r); }
    }
    $pdo->commit();

    flash('ok', $rows ? count($rows) . ' section(s) saved.' : 'Sections cleared.');
    redirect($back);
}

/* =====================================================================
 * Upload / paste the answer key
 * =================================================================== */
if ($action === 'save_key') {

    $test_id = post_int('test_id');
    $test    = load_test($pdo, $test_id);
    if (!$test) { flash('err', 'Test not found.'); redirect($back); }

    list($text, $file_err) = uploaded_text('key_text', 'key_file');
    if ($file_err) { flash('err', $file_err); redirect($back); }

    $letters = option_letters($test['option_count']);
    $parsed  = parse_answer_key($text, (int)$test['total_questions'], $letters);

    if (!$parsed['key']) {
        flash('err', 'No usable answers found. ' . implode(' ', array_slice($parsed['errors'], 0, 3)));
        redirect($back);
    }

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM answer_keys WHERE test_id=?')->execute(array($test_id));
    $ins = $pdo->prepare('INSERT INTO answer_keys (test_id, q_no, correct_option) VALUES (?,?,?)');
    foreach ($parsed['key'] as $q => $opt) {
        $ins->execute(array($test_id, $q, $opt));
    }
    $pdo->commit();

    $msg = count($parsed['key']) . ' of ' . (int)$test['total_questions'] . ' answers saved.';
    if ($parsed['errors']) {
        $msg .= ' Skipped: ' . implode(' ', array_slice($parsed['errors'], 0, 5));
        flash('warn', $msg);
    } else {
        flash('ok', $msg);
    }

    // A changed key invalidates every score already computed for this test.
    $done = (int)$pdo->query("SELECT COUNT(*) FROM results WHERE test_id=" . (int)$test_id)->fetchColumn();
    if ($done) {
        $out = evaluate_test($pdo, $test_id);
        flash('ok', 'Key changed, so ' . $out['evaluated'] . ' sheet(s) were re-evaluated and re-ranked.');
    }

    redirect($back);
}

/* =====================================================================
 * Import candidates, optionally allotting them to a test
 * =================================================================== */
if ($action === 'import_candidates') {

    list($text, $file_err) = uploaded_text('cand_text', 'cand_file');
    if ($file_err) { flash('err', $file_err); redirect($back); }

    $parsed = parse_candidate_list($text);
    if (!$parsed['rows']) {
        flash('err', 'No candidates imported. ' . implode(' ', array_slice($parsed['errors'], 0, 3)));
        redirect($back);
    }

    $test_id = post_int('test_id');
    $branch  = auth_is_admin() ? null : auth_staff_id();

    $find = $pdo->prepare('SELECT id FROM candidates WHERE roll_no=?');
    $ins  = $pdo->prepare('INSERT INTO candidates (roll_no, name, mobile, branch_id) VALUES (?,?,?,?)');
    $upd  = $pdo->prepare('UPDATE candidates SET name=?, mobile=? WHERE id=?');
    $alt  = $pdo->prepare('INSERT IGNORE INTO test_candidates (test_id, candidate_id) VALUES (?,?)');

    $added = 0; $updated = 0; $allotted = 0;

    $pdo->beginTransaction();
    foreach ($parsed['rows'] as $r) {
        $find->execute(array($r['roll_no']));
        $existing = $find->fetchColumn();

        if ($existing) {
            $upd->execute(array($r['name'], $r['mobile'], $existing));
            $cid = (int)$existing;
            $updated++;
        } else {
            $ins->execute(array($r['roll_no'], $r['name'], $r['mobile'], $branch));
            $cid = (int)$pdo->lastInsertId();
            $added++;
        }

        if ($test_id) {
            $alt->execute(array($test_id, $cid));
            $allotted += $alt->rowCount();
        }
    }
    $pdo->commit();

    $msg = $added . ' added, ' . $updated . ' updated';
    if ($test_id) { $msg .= ', ' . $allotted . ' newly allotted to this test'; }
    $msg .= '.';
    if ($parsed['errors']) {
        $msg .= ' Skipped ' . count($parsed['errors']) . ' line(s): '
              . implode(' ', array_slice($parsed['errors'], 0, 3));
        flash('warn', $msg);
    } else {
        flash('ok', $msg);
    }

    redirect($back);
}

/* =====================================================================
 * Allot every existing candidate to a test
 * =================================================================== */
if ($action === 'allot_all') {

    $test_id = post_int('test_id');
    if (!load_test($pdo, $test_id)) { flash('err', 'Test not found.'); redirect($back); }

    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO test_candidates (test_id, candidate_id)
         SELECT ?, id FROM candidates'
    );
    $stmt->execute(array($test_id));

    flash('ok', $stmt->rowCount() . ' candidate(s) allotted.');
    redirect($back);
}

/* =====================================================================
 * Change a test's status
 * =================================================================== */
if ($action === 'set_status') {

    $test_id = post_int('test_id');
    $status  = post('status');
    $test    = load_test($pdo, $test_id);

    if (!$test) { flash('err', 'Test not found.'); redirect($back); }
    if (!in_array($status, array('draft', 'open', 'closed', 'published'), true)) {
        flash('err', 'Unknown status.');
        redirect($back);
    }

    // Guard rails on the two states that matter to candidates.
    if ($status === 'open') {
        $allot = (int)$pdo->query('SELECT COUNT(*) FROM test_candidates WHERE test_id=' . (int)$test_id)->fetchColumn();
        if (!$allot) {
            flash('err', 'Allot at least one candidate before opening the test.');
            redirect($back);
        }
    }

    if ($status === 'published') {
        $keys = (int)$pdo->query('SELECT COUNT(*) FROM answer_keys WHERE test_id=' . (int)$test_id)->fetchColumn();
        if (!$keys) {
            flash('err', 'Upload the answer key before publishing the result.');
            redirect($back);
        }
        // Publishing always re-evaluates and re-ranks, so the released
        // numbers match the key and the sheets as they now stand.
        $out = evaluate_test($pdo, $test_id);
        flash('ok', 'Evaluated ' . $out['evaluated'] . ' sheet(s) and ranked ' . $out['ranked'] . ' candidate(s).');
    }

    $pdo->prepare('UPDATE tests SET status=? WHERE id=?')->execute(array($status, $test_id));

    $said = array('draft' => 'moved back to draft', 'open' => 'opened for filling',
                  'closed' => 'closed', 'published' => 'published to candidates');
    flash('ok', 'Test ' . $said[$status] . '.');
    redirect($back);
}

/* =====================================================================
 * Re-evaluate and re-rank on demand
 * =================================================================== */
if ($action === 'evaluate') {

    $test_id = post_int('test_id');
    if (!load_test($pdo, $test_id)) { flash('err', 'Test not found.'); redirect($back); }

    $keys = (int)$pdo->query('SELECT COUNT(*) FROM answer_keys WHERE test_id=' . (int)$test_id)->fetchColumn();
    if (!$keys) { flash('err', 'There is no answer key for this test yet.'); redirect($back); }

    $out = evaluate_test($pdo, $test_id);
    flash('ok', 'Evaluated ' . $out['evaluated'] . ' sheet(s) and ranked ' . $out['ranked'] . ' candidate(s).');
    redirect($back);
}

/* =====================================================================
 * Unlock one candidate's sheet so they can fill it again
 * =================================================================== */
if ($action === 'reopen_sheet') {

    $test_id = post_int('test_id');
    $cand_id = post_int('candidate_id');

    $pdo->prepare("UPDATE test_candidates SET status='in_progress', submitted_at=NULL
                    WHERE test_id=? AND candidate_id=?")
        ->execute(array($test_id, $cand_id));
    $pdo->prepare('DELETE FROM results WHERE test_id=? AND candidate_id=?')
        ->execute(array($test_id, $cand_id));

    flash('ok', 'Sheet reopened. The candidate can log in and edit it while the test is open.');
    redirect($back);
}

/* =====================================================================
 * Remove a candidate from a test
 * =================================================================== */
if ($action === 'unallot') {

    $test_id = post_int('test_id');
    $cand_id = post_int('candidate_id');

    $pdo->prepare('DELETE FROM test_candidates WHERE test_id=? AND candidate_id=?')
        ->execute(array($test_id, $cand_id));
    $pdo->prepare('DELETE FROM responses WHERE test_id=? AND candidate_id=?')
        ->execute(array($test_id, $cand_id));
    $pdo->prepare('DELETE FROM results WHERE test_id=? AND candidate_id=?')
        ->execute(array($test_id, $cand_id));

    flash('ok', 'Candidate removed from this test.');
    redirect($back);
}

/* =====================================================================
 * Delete a test outright (head office only)
 * =================================================================== */
if ($action === 'delete_test') {
    require_admin();

    $test_id = post_int('test_id');
    $confirm = post('confirm_code');
    $test    = load_test($pdo, $test_id);

    if (!$test) { flash('err', 'Test not found.'); redirect($back); }
    if ($confirm !== $test['code']) {
        flash('err', 'Type the test code exactly to confirm deletion. Nothing was deleted.');
        redirect($back);
    }

    $pdo->prepare('DELETE FROM tests WHERE id=?')->execute(array($test_id));
    flash('ok', 'Test "' . $test['name'] . '" and all its sheets were deleted.');
    redirect('../tests.php');
}

/* =====================================================================
 * Change your own password
 * =================================================================== */
if ($action === 'change_password') {

    $current = (string)(isset($_POST['current_password']) ? $_POST['current_password'] : '');
    $new     = (string)(isset($_POST['new_password']) ? $_POST['new_password'] : '');
    $again   = (string)(isset($_POST['confirm_password']) ? $_POST['confirm_password'] : '');

    $stmt = $pdo->prepare('SELECT password_hash FROM branches WHERE id=?');
    $stmt->execute(array(auth_staff_id()));
    $hash = $stmt->fetchColumn();

    if (!$hash || !password_verify($current, $hash)) {
        flash('err', 'Your current password is not correct.');
    } elseif (strlen($new) < 8) {
        flash('err', 'The new password must be at least 8 characters.');
    } elseif ($new !== $again) {
        flash('err', 'The two new passwords do not match.');
    } else {
        $pdo->prepare('UPDATE branches SET password_hash=? WHERE id=?')
            ->execute(array(password_hash($new, PASSWORD_DEFAULT), auth_staff_id()));
        flash('ok', 'Password changed.');
    }

    redirect($back);
}

/* =====================================================================
 * Add a branch login (head office only)
 * =================================================================== */
if ($action === 'add_staff') {
    require_admin();

    $username = post('new_username');
    $name     = post('new_name');
    $password = (string)(isset($_POST['new_staff_password']) ? $_POST['new_staff_password'] : '');
    $role     = post('new_role') === 'admin' ? 'admin' : 'branch';

    if ($username === '' || $name === '') {
        flash('err', 'Username and branch name are required.');
        redirect($back);
    }
    if (strlen($password) < 8) {
        flash('err', 'The password must be at least 8 characters.');
        redirect($back);
    }

    try {
        $pdo->prepare('INSERT INTO branches (username, password_hash, name, role) VALUES (?,?,?,?)')
            ->execute(array($username, password_hash($password, PASSWORD_DEFAULT), $name, $role));
        flash('ok', 'Login created for ' . $name . '.');
    } catch (PDOException $ex) {
        flash('err', 'That username is already taken.');
    }

    redirect($back);
}

flash('err', 'Unknown action.');
redirect($back);
