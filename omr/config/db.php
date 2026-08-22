<?php
/**
 * PDO connection. Included by every entry point via includes/bootstrap.php.
 */
require_once __DIR__ . '/config.php';

function db()
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ));
    } catch (PDOException $e) {
        http_response_code(500);
        if (APP_DEBUG) {
            die('Database connection failed: ' . $e->getMessage());
        }
        die('Database connection failed. Please check config/config.php.');
    }

    return $pdo;
}
