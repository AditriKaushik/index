<?php
/**
 * Session handling for the two kinds of user:
 *   - candidate : logs in with roll number + registered mobile
 *   - staff     : logs in with username + password (role admin or branch)
 */

/** Log the session out if it has been idle past the configured timeout. */
function auth_enforce_timeout()
{
    if (empty($_SESSION['last_seen'])) {
        $_SESSION['last_seen'] = time();
        return;
    }
    if (time() - (int)$_SESSION['last_seen'] > SESSION_TIMEOUT_MIN * 60) {
        $_SESSION = array();
        session_destroy();
        session_start();
        $_SESSION['timed_out'] = true;
    }
    $_SESSION['last_seen'] = time();
}

/** Start a candidate session for a given test. */
function auth_login_candidate(array $candidate, $test_id)
{
    session_regenerate_id(true);
    $_SESSION['candidate_id'] = (int)$candidate['id'];
    $_SESSION['roll_no']      = $candidate['roll_no'];
    $_SESSION['cand_name']    = $candidate['name'];
    $_SESSION['test_id']      = (int)$test_id;
    $_SESSION['last_seen']    = time();
    unset($_SESSION['staff_id']);
}

/** Start a staff session. */
function auth_login_staff(array $staff)
{
    session_regenerate_id(true);
    $_SESSION['staff_id']   = (int)$staff['id'];
    $_SESSION['staff_name'] = $staff['name'];
    $_SESSION['staff_user'] = $staff['username'];
    $_SESSION['staff_role'] = $staff['role'];
    $_SESSION['last_seen']  = time();
    unset($_SESSION['candidate_id']);
}

function auth_candidate_id()
{
    return isset($_SESSION['candidate_id']) ? (int)$_SESSION['candidate_id'] : 0;
}

function auth_test_id()
{
    return isset($_SESSION['test_id']) ? (int)$_SESSION['test_id'] : 0;
}

function auth_staff_id()
{
    return isset($_SESSION['staff_id']) ? (int)$_SESSION['staff_id'] : 0;
}

function auth_is_admin()
{
    return isset($_SESSION['staff_role']) && $_SESSION['staff_role'] === 'admin';
}

/** Guard for candidate-only pages. */
function require_candidate($as_json = false)
{
    if (!auth_candidate_id() || !auth_test_id()) {
        if ($as_json) {
            json_fail('Your session has expired. Please log in again.', 401);
        }
        redirect('login.php');
    }
}

/** Guard for staff-only pages. */
function require_staff($as_json = false)
{
    if (!auth_staff_id()) {
        if ($as_json) {
            json_fail('Your session has expired. Please log in again.', 401);
        }
        redirect('login.php');
    }
}

/** Guard for head-office-only actions. */
function require_admin($as_json = false)
{
    require_staff($as_json);
    if (!auth_is_admin()) {
        if ($as_json) {
            json_fail('Only a head office login can do this.', 403);
        }
        http_response_code(403);
        die('Only a head office login can do this.');
    }
}

function auth_logout()
{
    $_SESSION = array();
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
