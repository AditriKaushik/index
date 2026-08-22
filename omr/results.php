<?php
/**
 * Merit list for a test, plus the candidates who have not submitted yet.
 */
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/evaluator.php';
require_staff();

$pdo     = db();
$test_id = get_int('test_id');
$q       = get('q');

$tests = $pdo->query('SELECT id, code, name, status FROM tests ORDER BY id DESC')->fetchAll();
$test  = $test_id ? load_test($pdo, $test_id) : null;

staff_header('Results & Ranks', 'results');
?>

<div class="row between">
  <h1>Results &amp; Ranks</h1>
  <?php if ($test): ?>
    <a class="btn ghost" href="export.php?test_id=<?= (int)$test_id ?>">Download CSV</a>
  <?php endif; ?>
</div>

<div class="card">
  <form method="get" class="row">
    <div class="grow" style="max-width:420px">
      <label for="test_id">Test</label>
      <select id="test_id" name="test_id" onchange="this.form.submit()">
        <option value="">— select a test —</option>
        <?php foreach ($tests as $t): ?>
          <option value="<?= (int)$t['id'] ?>" <?= (int)$t['id'] === $test_id ? 'selected' : '' ?>>
            <?= e($t['code']) ?> — <?= e($t['name']) ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
    <?php if ($test): ?>
    <div class="grow" style="max-width:260px">
      <label for="q">Find a candidate</label>
      <input type="text" id="q" name="q" value="<?= e($q) ?>" placeholder="Roll number or name">
    </div>
    <div style="align-self:end"><button type="submit" class="btn ghost">Search</button></div>
    <?php endif; ?>
  </form>
</div>

<?php if (!$test): ?>
  <div class="note info">Choose a test above to see its merit list.</div>
  <?php staff_footer(); exit; ?>
<?php endif; ?>

<?php
// Summary numbers across the whole test.
$stats = $pdo->prepare(
    'SELECT COUNT(*) AS n, MAX(score) AS hi, MIN(score) AS lo, AVG(score) AS avg,
            AVG(correct) AS avg_correct
       FROM results WHERE test_id = ?'
);
$stats->execute(array($test_id));
$s = $stats->fetch();

$pending = $pdo->prepare(
    "SELECT COUNT(*) FROM test_candidates WHERE test_id=? AND status <> 'submitted'"
);
$pending->execute(array($test_id));
$pending = (int)$pending->fetchColumn();

// The merit list itself, in rank order.
$sql = 'SELECT r.*, c.roll_no, c.name, c.mobile
          FROM results r
          JOIN candidates c ON c.id = r.candidate_id
         WHERE r.test_id = ?';
$args = array($test_id);
if ($q !== '') {
    $sql .= ' AND (c.roll_no LIKE ? OR c.name LIKE ?)';
    $args[] = '%' . $q . '%';
    $args[] = '%' . $q . '%';
}
$sql .= ' ORDER BY r.score DESC, r.correct DESC, r.submitted_at ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($args);
$rows = $stmt->fetchAll();

$ranked_any = false;
foreach ($rows as $r) { if ($r['rank_overall'] !== null) { $ranked_any = true; break; } }
?>

<div class="tiles">
  <div class="tile hero"><div class="k">Evaluated</div><div class="v"><?= (int)$s['n'] ?></div></div>
  <div class="tile good"><div class="k">Highest</div><div class="v"><?= $s['n'] ? fmt_score($s['hi']) : '—' ?></div></div>
  <div class="tile"><div class="k">Average</div><div class="v"><?= $s['n'] ? fmt_score(round($s['avg'], 2)) : '—' ?></div></div>
  <div class="tile"><div class="k">Lowest</div><div class="v"><?= $s['n'] ? fmt_score($s['lo']) : '—' ?></div></div>
  <div class="tile <?= $pending ? 'bad' : '' ?>"><div class="k">Not submitted</div><div class="v"><?= $pending ?></div></div>
</div>

<?php if ((int)$s['n'] === 0): ?>
  <div class="note warn">
    Nothing has been evaluated for this test yet. Sheets are scored as candidates
    submit them, and ranks are assigned when you publish the result from the
    <a href="test_edit.php?id=<?= (int)$test_id ?>">test page</a>.
  </div>
<?php elseif (!$ranked_any): ?>
  <div class="note warn">
    Scores are in, but ranks have not been assigned yet. Use
    <strong>Evaluate &amp; Publish Result</strong> (or <strong>Re-evaluate &amp; Re-rank</strong>)
    on the <a href="test_edit.php?id=<?= (int)$test_id ?>">test page</a>.
  </div>
<?php endif; ?>

<div class="card">
  <div class="card-head">
    <h2>Merit list — <?= e($test['name']) ?> <?= status_pill($test['status']) ?></h2>
  </div>

  <?php if (!$rows): ?>
    <div class="note info"><?= $q !== '' ? 'No candidate matches that search.' : 'No results yet.' ?></div>
  <?php else: ?>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th class="num">Rank</th><th>Roll No</th><th>Name</th>
          <th class="num">Correct</th><th class="num">Wrong</th><th class="num">Blank</th>
          <th class="num">Score</th><th class="num">%</th><th class="num">Percentile</th>
          <th>Submitted</th><th></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $r):
        $rk = $r['rank_overall'] !== null ? (int)$r['rank_overall'] : null;
        $cls = $rk !== null && $rk <= 3 ? ' class="rank-' . $rk . '"' : ''; ?>
        <tr>
          <td class="num"<?= $cls ?>><?= $rk !== null ? $rk : '—' ?></td>
          <td class="mono small"><?= e($r['roll_no']) ?></td>
          <td><?= e($r['name']) ?></td>
          <td class="num" style="color:var(--good)"><?= (int)$r['correct'] ?></td>
          <td class="num" style="color:var(--bad)"><?= (int)$r['wrong'] ?></td>
          <td class="num"><?= (int)$r['unattempted'] ?></td>
          <td class="num"><strong><?= fmt_score($r['score']) ?></strong>
              <span class="muted small">/<?= fmt_score($r['max_score']) ?></span></td>
          <td class="num"><?= fmt_score($r['percentage']) ?></td>
          <td class="num"><?= $r['percentile'] !== null ? fmt_score($r['percentile']) : '—' ?></td>
          <td class="small nowrap"><?= $r['submitted_at'] ? e(date('d M, g:i a', strtotime($r['submitted_at']))) : '—' ?></td>
          <td class="nowrap">
            <form method="post" action="queries/admin.php" style="display:inline">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="reopen_sheet">
              <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
              <input type="hidden" name="candidate_id" value="<?= (int)$r['candidate_id'] ?>">
              <input type="hidden" name="back" value="results.php?test_id=<?= (int)$test_id ?>">
              <button type="submit" class="btn sm ghost"
                      onclick="return confirm('Reopen this sheet? Their result is removed until they submit again.')">
                Reopen
              </button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>

<?php
// Who has not submitted yet.
$stmt = $pdo->prepare(
    "SELECT c.id, c.roll_no, c.name, c.mobile, tc.status, tc.started_at
       FROM test_candidates tc
       JOIN candidates c ON c.id = tc.candidate_id
      WHERE tc.test_id = ? AND tc.status <> 'submitted'
   ORDER BY c.roll_no"
);
$stmt->execute(array($test_id));
$waiting = $stmt->fetchAll();
?>

<?php if ($waiting): ?>
<div class="card">
  <div class="card-head"><h2>Not yet submitted (<?= count($waiting) ?>)</h2></div>
  <div class="table-scroll">
    <table>
      <thead><tr><th>Roll No</th><th>Name</th><th>Mobile</th><th>State</th><th>Opened</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($waiting as $w): ?>
        <tr>
          <td class="mono small"><?= e($w['roll_no']) ?></td>
          <td><?= e($w['name']) ?></td>
          <td class="mono small"><?= e($w['mobile']) ?></td>
          <td><?= $w['status'] === 'in_progress'
                ? '<span class="pill open">Filling now</span>'
                : '<span class="pill draft">Not started</span>' ?></td>
          <td class="small"><?= $w['started_at'] ? e(date('d M, g:i a', strtotime($w['started_at']))) : '—' ?></td>
          <td>
            <form method="post" action="queries/admin.php" style="display:inline">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="unallot">
              <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
              <input type="hidden" name="candidate_id" value="<?= (int)$w['id'] ?>">
              <input type="hidden" name="back" value="results.php?test_id=<?= (int)$test_id ?>">
              <button type="submit" class="btn sm ghost"
                      onclick="return confirm('Remove this candidate from the test? Anything they have filled is deleted.')">
                Remove
              </button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endif; ?>

<?php staff_footer(); ?>
