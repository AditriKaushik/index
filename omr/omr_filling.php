<?php
/**
 * The online OMR sheet. Candidate bubbles their answers here.
 */
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/evaluator.php';

require_candidate();

$pdo          = db();
$candidate_id = auth_candidate_id();
$test_id      = auth_test_id();

$test = load_test($pdo, $test_id);
if (!$test) {
    flash('err', 'That test is no longer available.');
    redirect('logout.php');
}

// Confirm the allotment and see whether they have already submitted.
$stmt = $pdo->prepare('SELECT * FROM test_candidates WHERE test_id = ? AND candidate_id = ?');
$stmt->execute(array($test_id, $candidate_id));
$attempt = $stmt->fetch();

if (!$attempt) {
    flash('err', 'You are not allotted to this test.');
    redirect('logout.php');
}

// Sheet is closed to them once submitted, or once the test stops being open.
if ($attempt['status'] === 'submitted' || $test['status'] !== 'open') {
    redirect('result.php');
}

// Mark the sheet as started the first time it is opened.
if ($attempt['status'] === 'pending') {
    $pdo->prepare("UPDATE test_candidates SET status='in_progress', started_at=NOW()
                    WHERE test_id=? AND candidate_id=?")
        ->execute(array($test_id, $candidate_id));
}

$sections = load_sections($pdo, $test_id);
$total    = (int)$test['total_questions'];
$letters  = option_letters($test['option_count']);

// Existing bubbles, so a returning candidate picks up where they left off.
$stmt = $pdo->prepare('SELECT q_no, marked_option FROM responses WHERE test_id=? AND candidate_id=?');
$stmt->execute(array($test_id, $candidate_id));
$marked = array();
foreach ($stmt->fetchAll() as $r) {
    if ($r['marked_option'] !== null && $r['marked_option'] !== '') {
        $marked[(int)$r['q_no']] = $r['marked_option'];
    }
}

// q_no => section name, for the in-sheet headings.
$section_start = array();
foreach ($sections as $s) {
    $section_start[(int)$s['q_from']] = $s;
}

$filled = count($marked);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OMR Sheet &middot; <?= e($test['name']) ?></title>
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

<div class="omr-bar">
  <div class="wrap">
    <div class="row between">
      <div class="grow">
        <strong id="counter"><?= $filled ?></strong> of <?= $total ?> filled
        <span class="save-state" id="saveState" role="status" aria-live="polite"></span>
      </div>
      <button type="button" class="btn good" id="submitBtn">Submit Answer Sheet</button>
    </div>
    <div class="progress"><i id="bar" style="width:<?= $total ? round($filled / $total * 100, 2) : 0 ?>%"></i></div>
  </div>
</div>

<main>
<div class="wrap stack">

  <div class="note info">
    Tap the option you have marked on your paper. Every bubble is saved
    automatically &mdash; you may change any answer until you press
    <strong>Submit Answer Sheet</strong>. Marking scheme:
    <strong>+<?= fmt_score($test['marks_correct']) ?></strong> for a correct answer,
    <strong><?= fmt_score($test['marks_wrong']) ?></strong> for a wrong one,
    <strong>0</strong> if left blank.
  </div>

  <div id="offline" class="note err" hidden>
    You appear to be offline. Your answers are held on this device and will be
    sent as soon as the connection returns. Do not close this page.
  </div>

  <div class="sheet" id="sheet">
    <?php for ($q = 1; $q <= $total; $q++): ?>
      <?php if (isset($section_start[$q])): $s = $section_start[$q]; ?>
        <div class="section-head">
          <?= e($s['name']) ?>
          <span class="sm">
            &mdash; Q<?= (int)$s['q_from'] ?>&ndash;<?= (int)$s['q_to'] ?>
            <?php if ($s['marks_correct'] !== null || $s['marks_wrong'] !== null): ?>
              (+<?= fmt_score($s['marks_correct'] !== null ? $s['marks_correct'] : $test['marks_correct']) ?>
               / <?= fmt_score($s['marks_wrong'] !== null ? $s['marks_wrong'] : $test['marks_wrong']) ?>)
            <?php endif; ?>
          </span>
        </div>
      <?php endif; ?>
      <?php $sel = isset($marked[$q]) ? $marked[$q] : ''; ?>
      <div class="qrow<?= $sel !== '' ? ' done' : '' ?>" data-q="<?= $q ?>">
        <div class="qnum"><?= $q ?></div>
        <div class="bubbles" role="radiogroup" aria-label="Question <?= $q ?>">
          <?php foreach ($letters as $L): ?>
            <button type="button"
                    class="bub<?= $sel === $L ? ' on' : '' ?>"
                    data-opt="<?= $L ?>"
                    role="radio"
                    aria-checked="<?= $sel === $L ? 'true' : 'false' ?>"
                    aria-label="Question <?= $q ?> option <?= $L ?>"><?= $L ?></button>
          <?php endforeach; ?>
        </div>
        <button type="button" class="clr" title="Clear question <?= $q ?>"
                aria-label="Clear question <?= $q ?>">&times;</button>
      </div>
    <?php endfor; ?>
  </div>

  <div class="card center">
    <p class="muted small">
      Once submitted, your sheet is locked and evaluated against the official key.
    </p>
    <button type="button" class="btn good" id="submitBtn2">Submit Answer Sheet</button>
  </div>

</div>
</main>

<script>
window.OMR = {
  testId:   <?= (int)$test_id ?>,
  total:    <?= $total ?>,
  filled:   <?= $filled ?>,
  csrf:     <?= json_encode(csrf_token()) ?>,
  endpoint: 'queries/omr.php'
};
</script>
<script src="assets/js/omr.js"></script>
</body>
</html>
