<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';
require_staff();

$pdo = db();
$rows = $pdo->query(
    "SELECT t.*,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.test_id=t.id) AS allotted,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.test_id=t.id AND tc.status='submitted') AS submitted,
            (SELECT COUNT(*) FROM answer_keys k WHERE k.test_id=t.id) AS key_rows
       FROM tests t
   ORDER BY t.id DESC"
)->fetchAll();

staff_header('Tests', 'tests');
?>

<div class="row between">
  <h1>Tests</h1>
  <a class="btn" href="test_edit.php">+ New Test</a>
</div>

<div class="card">
  <?php if (!$rows): ?>
    <div class="note info">No tests yet. Create your first one to get started.</div>
  <?php else: ?>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Code</th><th>Test</th><th>Status</th>
          <th class="num">Qs</th><th class="num">Marks</th><th class="num">Key</th>
          <th class="num">Allotted</th><th class="num">Submitted</th><th></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $t): ?>
        <tr>
          <td class="mono small"><?= e($t['code']) ?></td>
          <td><strong><?= e($t['name']) ?></strong><br>
              <span class="muted small"><?= e(date('d M Y', strtotime($t['created_at']))) ?></span></td>
          <td><?= status_pill($t['status']) ?></td>
          <td class="num"><?= (int)$t['total_questions'] ?></td>
          <td class="num nowrap">+<?= fmt_score($t['marks_correct']) ?> / <?= fmt_score($t['marks_wrong']) ?></td>
          <td class="num">
            <?php if ((int)$t['key_rows'] >= (int)$t['total_questions']): ?>
              <span style="color:var(--good)" title="Complete">&#10003;</span>
            <?php elseif ((int)$t['key_rows'] > 0): ?>
              <span style="color:var(--warn)"><?= (int)$t['key_rows'] ?>/<?= (int)$t['total_questions'] ?></span>
            <?php else: ?>
              <span class="muted">&mdash;</span>
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

<?php staff_footer(); ?>
