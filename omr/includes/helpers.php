<?php
/**
 * Small shared helpers: escaping, CSRF, JSON replies, input reading.
 */

/** HTML-escape for output. */
function e($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

/** Read a POST field as a trimmed string. */
function post($key, $default = '')
{
    return isset($_POST[$key]) ? trim((string)$_POST[$key]) : $default;
}

/** Read a GET field as a trimmed string. */
function get($key, $default = '')
{
    return isset($_GET[$key]) ? trim((string)$_GET[$key]) : $default;
}

/** Read a request field as a positive integer, or 0. */
function post_int($key, $default = 0)
{
    return isset($_POST[$key]) ? (int)$_POST[$key] : $default;
}

function get_int($key, $default = 0)
{
    return isset($_GET[$key]) ? (int)$_GET[$key] : $default;
}

/** Send a JSON response and stop. */
function json_out($payload, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function json_ok($payload = array())
{
    json_out(array_merge(array('ok' => true), $payload));
}

function json_fail($message, $status = 400)
{
    json_out(array('ok' => false, 'error' => $message), $status);
}

/** Current CSRF token, generated once per session. */
function csrf_token()
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/** Hidden input carrying the CSRF token. */
function csrf_field()
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

/**
 * Verify the CSRF token on a state-changing request.
 * Ends the request with an error if it does not match.
 */
function csrf_verify($as_json = false)
{
    $sent = isset($_POST['csrf_token']) ? (string)$_POST['csrf_token'] : '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $sent)) {
        if ($as_json) {
            json_fail('Your session expired. Please reload the page and try again.', 419);
        }
        http_response_code(419);
        die('Your session expired. Please go back, reload the page and try again.');
    }
}

/** Redirect and stop. */
function redirect($path)
{
    header('Location: ' . $path);
    exit;
}

/** Flash message helpers, shown once on the next page render. */
function flash($type, $message)
{
    $_SESSION['flash'][] = array('type' => $type, 'message' => $message);
}

function take_flashes()
{
    $out = isset($_SESSION['flash']) ? $_SESSION['flash'] : array();
    unset($_SESSION['flash']);
    return $out;
}

/**
 * Option letters valid for a test, e.g. 4 -> array('A','B','C','D').
 */
function option_letters($count)
{
    $count = max(2, min(strlen(OPTION_LETTERS), (int)$count));
    return str_split(substr(OPTION_LETTERS, 0, $count));
}

/** Format a score for display, dropping a trailing ".00". */
function fmt_score($value)
{
    $value = (float)$value;
    $s = number_format($value, 2, '.', '');
    return preg_replace('/\.00$/', '', $s);
}

/** Normalise an Indian mobile number to its last 10 digits. */
function normalise_mobile($raw)
{
    $digits = preg_replace('/\D+/', '', (string)$raw);
    if (strlen($digits) > 10) {
        $digits = substr($digits, -10);
    }
    return $digits;
}
