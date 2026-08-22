<?php
/**
 * Parsers for the two things staff paste or upload: answer keys and
 * candidate lists. Both are deliberately forgiving about formatting.
 */

/**
 * Parse an answer key.
 *
 * Accepts either a numbered list, one question per line:
 *     1 A          1,A          1. A          1: A          1 - A
 *     2 A,C        3 *          4 -
 *
 * or a bare sequence of option letters for Q1 upwards:
 *     ABCDA BCDAB ...
 *
 * '*' marks a bonus question, '-' a dropped one.
 *
 * @return array array('key' => array(q_no => option), 'errors' => string[])
 */
function parse_answer_key($text, $total, array $letters)
{
    $text   = trim((string)$text);
    $key    = array();
    $errors = array();

    if ($text === '') {
        return array('key' => array(), 'errors' => array('The answer key is empty.'));
    }

    $valid = array_merge($letters, array('*', '-'));
    $lines = preg_split('/\r\n|\r|\n/', $text);

    // Does this look like a numbered list?
    $numbered = 0;
    foreach ($lines as $line) {
        if (preg_match('/^\s*\d+\s*[\s,.:;)\-\t|]/', $line)) { $numbered++; }
    }

    if ($numbered > 0) {
        foreach ($lines as $i => $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') { continue; }

            if (!preg_match('/^\s*(\d+)\s*[\s,.:;)\-\t|]+\s*(.+?)\s*$/', $line, $m)) {
                $errors[] = 'Line ' . ($i + 1) . ': could not read "' . $line . '".';
                continue;
            }

            $q   = (int)$m[1];
            $opt = strtoupper(preg_replace('/\s+/', '', $m[2]));

            if ($q < 1 || $q > $total) {
                $errors[] = 'Line ' . ($i + 1) . ': question ' . $q . ' is outside 1-' . $total . '.';
                continue;
            }

            $parts = explode(',', $opt);
            $clean = array();
            $bad   = false;
            foreach ($parts as $p) {
                $p = trim($p);
                if ($p === '' || !in_array($p, $valid, true)) { $bad = true; break; }
                if (!in_array($p, $clean, true)) { $clean[] = $p; }
            }
            if ($bad || !$clean) {
                $errors[] = 'Line ' . ($i + 1) . ': "' . $m[2] . '" is not a valid option for Q' . $q . '.';
                continue;
            }
            // '*' and '-' only make sense on their own.
            if (count($clean) > 1 && (in_array('*', $clean, true) || in_array('-', $clean, true))) {
                $errors[] = 'Line ' . ($i + 1) . ': "*" and "-" cannot be combined with an option.';
                continue;
            }

            if (isset($key[$q])) {
                $errors[] = 'Line ' . ($i + 1) . ': question ' . $q . ' appears more than once.';
            }
            $key[$q] = implode(',', $clean);
        }
        return array('key' => $key, 'errors' => $errors);
    }

    // Sequence mode: every option character in order, from Q1.
    $chars = preg_split('//u', strtoupper(preg_replace('/[^A-Za-z*\-]/', '', $text)), -1, PREG_SPLIT_NO_EMPTY);
    $q = 0;
    foreach ($chars as $ch) {
        $q++;
        if ($q > $total) {
            $errors[] = 'The sequence has more entries than the paper has questions (' . $total . ').';
            break;
        }
        if (!in_array($ch, $valid, true)) {
            $errors[] = 'Q' . $q . ': "' . $ch . '" is not a valid option.';
            continue;
        }
        $key[$q] = $ch;
    }

    return array('key' => $key, 'errors' => $errors);
}

/**
 * Parse a candidate list: roll number, name, mobile.
 *
 * Accepts comma or tab separated, with or without a header row.
 *
 * @return array array('rows' => array of array('roll_no','name','mobile'), 'errors' => string[])
 */
function parse_candidate_list($text)
{
    $rows   = array();
    $errors = array();
    $seen   = array();

    $lines = preg_split('/\r\n|\r|\n/', trim((string)$text));

    foreach ($lines as $i => $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') { continue; }

        $parts = (strpos($line, "\t") !== false) ? explode("\t", $line) : str_getcsv($line);
        $parts = array_map('trim', $parts);

        // Skip an obvious header row.
        if ($i === 0 && isset($parts[0]) && preg_match('/^roll/i', $parts[0])) { continue; }

        if (count($parts) < 3) {
            $errors[] = 'Line ' . ($i + 1) . ': needs roll number, name and mobile number.';
            continue;
        }

        $roll   = $parts[0];
        $name   = $parts[1];
        $mobile = normalise_mobile($parts[2]);

        if ($roll === '')  { $errors[] = 'Line ' . ($i + 1) . ': roll number is blank.'; continue; }
        if ($name === '')  { $errors[] = 'Line ' . ($i + 1) . ': name is blank.'; continue; }
        if (strlen($mobile) !== 10) {
            $errors[] = 'Line ' . ($i + 1) . ': "' . $parts[2] . '" is not a 10-digit mobile number.';
            continue;
        }
        if (isset($seen[$roll])) {
            $errors[] = 'Line ' . ($i + 1) . ': roll number ' . $roll . ' is repeated.';
            continue;
        }

        $seen[$roll] = true;
        $rows[] = array('roll_no' => $roll, 'name' => $name, 'mobile' => $mobile);
    }

    if (!$rows && !$errors) {
        $errors[] = 'No candidates found in the list.';
    }

    return array('rows' => $rows, 'errors' => $errors);
}
