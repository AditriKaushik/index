<?php
/**
 * Mahendra's Online OMR Portal - configuration.
 *
 * Copy this file's values to match your server before going live.
 * Nothing else in the application needs editing.
 */

// ---------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------
define('DB_HOST', getenv('OMR_DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('OMR_DB_NAME') ?: 'mahendras_omr');
define('DB_USER', getenv('OMR_DB_USER') ?: 'root');
define('DB_PASS', getenv('OMR_DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

// ---------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------
define('APP_NAME',     'Mahendra\'s Online OMR');
define('APP_TAGLINE',  'Online OMR Filling, Evaluation & Ranking');

// Show PHP errors on screen. Turn OFF on a live server.
define('APP_DEBUG', false);

// Session idle timeout for a logged-in candidate or staff member, in minutes.
define('SESSION_TIMEOUT_MIN', 180);

// Default marking scheme used when a new test is created.
define('DEFAULT_MARKS_CORRECT',  1.00);
define('DEFAULT_MARKS_WRONG',   -0.25);

// Option letters, sliced to the test's option_count.
define('OPTION_LETTERS', 'ABCDE');

// ---------------------------------------------------------------------
// Error reporting
// ---------------------------------------------------------------------
if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
    ini_set('display_errors', '0');
}

date_default_timezone_set('Asia/Kolkata');
