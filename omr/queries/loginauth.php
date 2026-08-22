<?php
/**
 * Authentication endpoint. Replies with JSON.
 *
 *   action=login_candidate   roll_no, mobile, [test_id]
 *   action=login_staff       username, password
 */
require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_fail('POST required.', 405);
}
csrf_verify(true);

$action = post('action');
$pdo    = db();

/* ---------------------------------------------------------------------
 * Throttle: slow down anyone guessing roll numbers or passwords.
 * ------------------------------------------------------------------- */
function throttle_check()
{
    $fails = isset($_SESSION['login_fails']) ? (int)$_SESSION['login_fails'] : 0;
    $until = isset($_SESSION['login_block_until']) ? (int)$_SESSION['login_block_until'] : 0;

    if ($until > time()) {
        json_fail('Too many failed attempts. Please wait ' . ($until - time()) . ' seconds and try again.', 429);
    }
    return $fails;
}

function throttle_fail()
{
    $fails = isset($_SESSION['login_fails']) ? (int)$_SESSION['login_fails'] : 0;
    $fails++;
    $_SESSION['login_fails'] = $fails;
    if ($fails >= 5) {
        // 5 strikes -> 60s, and it doubles from there.
        $_SESSION['login_block_until'] = time() + min(600, 60 * (1 << ($fails - 5)));
    }
    usleep(300000); // 0.3s, blunts rapid-fire guessing
}

function throttle_reset()
{
    unset($_SESSION['login_fails'], $_SESSION['login_block_until']);
}

throttle_check();

/* =====================================================================
 * Candidate: roll number + registered mobile
 * =================================================================== */
if ($action === 'login_candidate') {

    $roll   = post('roll_no');
    $mobile = normalise_mobile(post('mobile'));
    $wanted = post_int('test_id');

    if ($roll === '' || strlen($mobile) !== 10) {
        json_fail('Please enter your roll number and your 10-digit registered mobile number.');
    }

    $stmt = $pdo->prepare('SELECT id, roll_no, name, mobile FROM candidates WHERE roll_no = ? LIMIT 1');
    $stmt->execute(array($roll));
    $cand = $stmt->fetch();

    // One message for both failures so the form never confirms a roll number exists.
    if (!$cand || !hash_equals(normalise_mobile($cand['mobile']), $mobile)) {
        throttle_fail();
        json_fail('Roll number and mobile number do not match our records.');
    }

    // Tests this candidate can act on right now.
    $stmt = $pdo->prepare(
        "SELECT t.id, t.name, t.status, tc.status AS attempt_status
           FROM test_candidates tc
           JOIN tests t ON t.id = tc.test_id
          WHERE tc.candidate_id = ?
            AND t.status IN ('open','published')
       ORDER BY FIELD(t.status,'open','published'), t.id DESC"
    );
    $stmt->execute(array($cand['id']));
    $tests = $stmt->fetchAll();

    if (!$tests) {
        throttle_fail();
        json_fail('No test is open for you at the moment. Please check with your branch.');
    }

    $chosen = null;
    if ($wanted) {
        foreach ($tests as $t) {
            if ((int)$t['id'] === $wanted) { $chosen = $t; break; }
        }
        if (!$chosen) {
            json_fail('That test is not available for you.');
        }
    } elseif (count($tests) === 1) {
        $chosen = $tests[0];
    } else {
        // Let the candidate pick, then resubmit.
        $opts = array();
        foreach ($tests as $t) {
            $label = $t['name'];
            if ($t['status'] === 'published')          { $label .= '  (result out)'; }
            elseif ($t['attempt_status'] === 'submitted') { $label .= '  (submitted)'; }
            $opts[] = array('id' => (int)$t['id'], 'name' => $label);
        }
        json_out(array('ok' => false, 'choose_test' => $opts));
    }

    throttle_reset();
    auth_login_candidate($cand, $chosen['id']);

    $done = ($chosen['attempt_status'] === 'submitted') || ($chosen['status'] === 'published');
    json_ok(array('redirect' => $done ? 'result.php' : 'omr_filling.php'));
}

/* =====================================================================
 * Staff: username + password
 * =================================================================== */
if ($action === 'login_staff') {

    $username = post('username');
    $password = (string)(isset($_POST['password']) ? $_POST['password'] : '');

    if ($username === '' || $password === '') {
        json_fail('Please enter your username and password.');
    }

    $stmt = $pdo->prepare('SELECT * FROM branches WHERE username = ? LIMIT 1');
    $stmt->execute(array($username));
    $staff = $stmt->fetch();

    if (!$staff || !password_verify($password, $staff['password_hash'])) {
        throttle_fail();
        json_fail('Incorrect username or password.');
    }
    if ((int)$staff['status'] !== 1) {
        json_fail('This login has been disabled. Please contact head office.');
    }

    // Transparently upgrade an old hash to the current cost.
    if (password_needs_rehash($staff['password_hash'], PASSWORD_DEFAULT)) {
        $new = password_hash($password, PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE branches SET password_hash = ? WHERE id = ?')
            ->execute(array($new, $staff['id']));
    }

    throttle_reset();
    auth_login_staff($staff);
    json_ok(array('redirect' => 'dashboard.php'));
}

json_fail('Unknown action.');
