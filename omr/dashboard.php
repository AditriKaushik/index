<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';
require_staff();

$pdo = db();

$counts = array(
    'tests'      => (int)$pdo->query('SELECT COUNT(*) FROM tests')->fetchColumn(),
    'open'       => (int)$pdo->query("SELECT COUNT(*) FROM tests WHERE status='open'")->fetchColumn(),
    'candidates' => (int)$pdo->query('SELECT COUNT(*) FROM candidates')->fetchColumn(),
    'submitted'  => (int)$pdo->query("SELECT COUNT(*) FROM test_candidates WHERE status='submitted'")->fetchColumn(),
);

$recent = $pdo->query(
    "SELECT t.*,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.test_id=t.id) AS allotted,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.test_id=t.id AND tc.status='submitted') AS submitted,
            (SELECT COUNT(*) FROM answer_keys k WHERE k.test_id=t.id) AS key_rows
       FROM tests t
   ORDER BY t.id DESC
      LIMIT 10"
)->fetchAll();

staff_header('Dashboard', 'dashboard');
?>

<div class="tiles">
  <div class="tile hero"><div class="k">Tests</div><div class="v"><?= $counts['tests'] ?></div></div>
  <div class="tile good"><div class="k">Open now</div><div class="v"><?= $counts['open'] ?></div></div>
  <div class="tile"><div class="k">Candidates</div><div class="v"><?= $counts['candidates'] ?></div></div>
  <div class="tile"><div class="k">Sheets submitted</div><div class="v"><?= $counts['submitted'] ?></div></div>
</div>

<div class="card">
  <div class="card-head">
    <div class="row between">
      <h2>Recent tests</h2>
      <a class="btn sm" href="test_edit.php">+ New Test</a>
    </div>
  </div>

  <?php if (!$recent): ?>
    <div class="note info">
      No tests yet. Create one, upload its answer key, allot your candidates,
      then set it to <strong>Open</strong> so they can fill their sheets.
    </div>
  <?php else: ?>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Code</th><th>Test</th><th>Status</th>
          <th class="num">Qs</th><th class="num">Key</th>
          <th class="num">Allotted</th><th class="num">Submitted</th><th></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($recent as $t): ?>
        <tr>
          <td class="mono small"><?= e($t['code']) ?></td>
          <td><strong><?= e($t['name']) ?></strong></td>
          <td><?= status_pill($t['status']) ?></td>
          <td class="num"><?= (int)$t['total_questions'] ?></td>
          <td class="num">
            <?php if ((int)$t['key_rows'] >= (int)$t['total_questions']): ?>
              <span style="color:var(--good)">&#10003;</span>
            <?php else: ?>
              <span style="color:var(--bad)"><?= (int)$t['key_rows'] ?>/<?= (int)$t['total_questions'] ?></span>
            <?php endif; ?>
          </td>
          <td class="num"><?= (int)$t['allotted'] ?></td>
          <td class="num"><?= (int)$t['submitted'] ?></td>
          <td class="nowrap">
            <a class="btn sm ghost" href="test_edit.php?id=<?= (int)$t['id'] ?>">Manage</a>
            <a class="btn sm ghost" href="results.php?test_id=<?= (int)$t['id'] ?>">Results</a>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>

<div class="card">
  <div class="card-head"><h2>How a test runs</h2></div>
  <ol class="muted" style="line-height:2;margin:0;padding-left:20px">
    <li><strong>Create the test</strong> — question count, options per question and the marking scheme.</li>
    <li><strong>Add sections</strong> (optional) if different parts carry different marks.</li>
    <li><strong>Upload the answer key</strong> — paste it or import a CSV.</li>
    <li><strong>Allot candidates</strong> — import your roll list with names and mobile numbers.</li>
    <li><strong>Open the test</strong> so candidates can log in and fill their OMR.</li>
    <li><strong>Close it</strong> once everyone has submitted.</li>
    <li><strong>Evaluate &amp; publish</strong> — scores and ranks are computed and released to candidates.</li>
  </ol>
</div>

<?php staff_footer(); ?>
