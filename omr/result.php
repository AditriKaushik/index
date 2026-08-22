<?php
/**
 * Candidate's own result: score, rank, sectional split and answer review.
 */
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/evaluator.php';

require_candidate();

$pdo          = db();
$candidate_id = auth_candidate_id();
$test_id      = auth_test_id();

$test = load_test($pdo, $test_id);
if (!$test) {
    redirect('logout.php');
}

$stmt = $pdo->prepare('SELECT * FROM test_candidates WHERE test_id=? AND candidate_id=?');
$stmt->execute(array($test_id, $candidate_id));
$attempt = $stmt->fetch();

if (!$attempt) {
    redirect('logout.php');
}

// Still filling and the test is open? Back to the sheet.
if ($attempt['status'] !== 'submitted' && $test['status'] === 'open') {
    redirect('omr_filling.php');
}

$published = ($test['status'] === 'published');

$stmt = $pdo->prepare('SELECT * FROM results WHERE test_id=? AND candidate_id=?');
$stmt->execute(array($test_id, $candidate_id));
$result = $stmt->fetch();

// Total candidates ranked in this test, for "rank X of Y".
$total_ranked = 0;
if ($published) {
    $c = $pdo->prepare('SELECT COUNT(*) FROM results WHERE test_id=?');
    $c->execute(array($test_id));
    $total_ranked = (int)$c->fetchColumn();
}

$page_title = 'Result · ' . $test['name'];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= e($page_title) ?></title>
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>

<header class="topbar">
  <div class="wrap row between">
    <div class="brand">
      <?= e(APP_NAME) ?>
      <span><?= e($test['name']) ?> &middot; <?= e($test['code']) ?></span>
    </div>
    <div class="right small">
      <strong><?= e($_SESSION['cand_name']) ?></strong><br>
      Roll <?= e($_SESSION['roll_no']) ?> &middot; <a href="logout.php">Logout</a>
    </div>
  </div>
</header>

<main>
<div class="wrap stack">

<?php if (!$published || !$result): ?>

  <div class="card center">
    <h1 style="color:var(--good)">&#10003; Answer sheet submitted</h1>
    <p class="muted">
      Your OMR for <strong><?= e($test['name']) ?></strong> has been recorded
      <?php if ($attempt['submitted_at']): ?>
        on <?= e(date('d M Y, g:i a', strtotime($attempt['submitted_at']))) ?>
      <?php endif; ?>.
    </p>
    <div class="note info" style="text-align:left;margin-top:18px">
      Your score and rank will appear here once head office releases the result
      for this test. Log in again with the same roll number and mobile number to
      check.
    </div>
  </div>

<?php else:
    $letters  = option_letters($test['option_count']);
    $sections = load_sections($pdo, $test_id);
    $key_map  = load_key_map($pdo, $test_id);

    $stmt = $pdo->prepare('SELECT q_no, marked_option FROM responses WHERE test_id=? AND candidate_id=?');
    $stmt->execute(array($test_id, $candidate_id));
    $marked = array();
    foreach ($stmt->fetchAll() as $r) { $marked[(int)$r['q_no']] = $r['marked_option']; }

    // Sectional rows, keyed by section id.
    $stmt = $pdo->prepare('SELECT * FROM section_results WHERE result_id = ?');
    $stmt->execute(array($result['id']));
    $sec_rows = array();
    foreach ($stmt->fetchAll() as $r) { $sec_rows[(int)$r['section_id']] = $r; }

    $section_start = array();
    foreach ($sections as $s) { $section_start[(int)$s['q_from']] = $s; }
?>

  <div class="tiles">
    <div class="tile hero">
      <div class="k">Score</div>
      <div class="v"><?= fmt_score($result['score']) ?> <span style="font-size:15px;opacity:.75">/ <?= fmt_score($result['max_score']) ?></span></div>
    </div>
    <div class="tile">
      <div class="k">Rank</div>
      <div class="v"><?= $result['rank_overall'] ? (int)$result['rank_overall'] : '—' ?>
        <span style="font-size:14px;color:var(--muted)">of <?= $total_ranked ?></span></div>
    </div>
    <div class="tile">
      <div class="k">Percentile</div>
      <div class="v"><?= $result['percentile'] !== null ? fmt_score($result['percentile']) : '—' ?></div>
    </div>
    <div class="tile good">
      <div class="k">Correct</div>
      <div class="v"><?= (int)$result['correct'] ?></div>
    </div>
    <div class="tile bad">
      <div class="k">Wrong</div>
      <div class="v"><?= (int)$result['wrong'] ?></div>
    </div>
    <div class="tile">
      <div class="k">Not attempted</div>
      <div class="v"><?= (int)$result['unattempted'] ?></div>
    </div>
  </div>

  <?php if ($sections && $sec_rows): ?>
  <div class="card">
    <div class="card-head"><h2>Sectional performance</h2></div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Section</th><th class="num">Correct</th><th class="num">Wrong</th>
            <th class="num">Blank</th><th class="num">Score</th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($sections as $s):
            $sr = isset($sec_rows[(int)$s['id']]) ? $sec_rows[(int)$s['id']] : null;
            if (!$sr) { continue; } ?>
          <tr>
            <td><strong><?= e($s['name']) ?></strong>
                <span class="muted small">Q<?= (int)$s['q_from'] ?>&ndash;<?= (int)$s['q_to'] ?></span></td>
            <td class="num" style="color:var(--good)"><?= (int)$sr['correct'] ?></td>
            <td class="num" style="color:var(--bad)"><?= (int)$sr['wrong'] ?></td>
            <td class="num"><?= (int)$sr['unattempted'] ?></td>
            <td class="num"><strong><?= fmt_score($sr['score']) ?></strong></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
  <?php endif; ?>

  <div class="card">
    <div class="card-head"><h2>Answer review</h2></div>
    <div class="legend" style="margin-bottom:14px">
      <span><i class="l-c"></i>Your correct answer</span>
      <span><i class="l-w"></i>Your wrong answer</span>
      <span><i class="l-r"></i>The right answer</span>
      <span><i class="l-s"></i>Not attempted</span>
    </div>

    <div class="sheet">
      <?php for ($q = 1; $q <= (int)$test['total_questions']; $q++):
        $key     = isset($key_map[$q]) ? $key_map[$q] : null;
        $mine    = isset($marked[$q]) ? $marked[$q] : '';
        $outcome = grade_question($key, $mine);
        $accepted = ($key !== null && $key !== '' && $key !== '*' && $key !== '-')
                  ? array_map('trim', explode(',', strtoupper($key)))
                  : array();

        $rowcls = 'q-skip';
        if ($outcome === 'correct')     { $rowcls = 'q-correct'; }
        elseif ($outcome === 'wrong')   { $rowcls = 'q-wrong'; }
      ?>
        <?php if (isset($section_start[$q])): ?>
          <div class="section-head"><?= e($section_start[$q]['name']) ?></div>
        <?php endif; ?>
        <div class="qrow <?= $rowcls ?>">
          <div class="qnum"><?= $q ?></div>
          <div class="bubbles">
            <?php foreach ($letters as $L):
              $cls = 'bub';
              if ($mine === $L && $outcome === 'correct')    { $cls .= ' correct'; }
              elseif ($mine === $L && $outcome === 'wrong')  { $cls .= ' wrongpick'; }
              elseif (in_array($L, $accepted, true))         { $cls .= ' wasright'; }
            ?>
              <span class="<?= $cls ?>"><?= $L ?></span>
            <?php endforeach; ?>
          </div>
          <?php if ($key === '*'): ?><span class="small" style="color:var(--good)">bonus</span>
          <?php elseif ($outcome === 'dropped'): ?><span class="small muted">dropped</span>
          <?php endif; ?>
        </div>
      <?php endfor; ?>
    </div>
  </div>

  <div class="row no-print">
    <button type="button" class="btn ghost" onclick="window.print()">Print / Save as PDF</button>
    <a class="btn ghost" href="logout.php">Logout</a>
  </div>

<?php endif; ?>

</div>
</main>
</body>
</html>
