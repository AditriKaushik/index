<?php
/**
 * The candidate master list, plus bulk import and account settings.
 */
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';
require_staff();

$pdo  = db();
$q    = get('q');
$page = max(1, get_int('page', 1));
$per  = 50;

$where = '';
$args  = array();
if ($q !== '') {
    $where = 'WHERE c.roll_no LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?';
    $args  = array('%' . $q . '%', '%' . $q . '%', '%' . $q . '%');
}

$count = $pdo->prepare("SELECT COUNT(*) FROM candidates c $where");
$count->execute($args);
$total = (int)$count->fetchColumn();
$pages = max(1, (int)ceil($total / $per));
$page  = min($page, $pages);

$stmt = $pdo->prepare(
    "SELECT c.*, b.name AS branch_name,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.candidate_id=c.id) AS tests_allotted,
            (SELECT COUNT(*) FROM test_candidates tc WHERE tc.candidate_id=c.id AND tc.status='submitted') AS tests_done
       FROM candidates c
       LEFT JOIN branches b ON b.id = c.branch_id
       $where
   ORDER BY c.roll_no
      LIMIT $per OFFSET " . (($page - 1) * $per)
);
$stmt->execute($args);
$rows = $stmt->fetchAll();

$tests = $pdo->query("SELECT id, code, name FROM tests WHERE status IN ('draft','open') ORDER BY id DESC")->fetchAll();

staff_header('Candidates', 'candidates');
?>

<h1>Candidates</h1>

<div class="card">
  <div class="card-head"><h2>Import candidates</h2></div>
  <form method="post" action="queries/admin.php" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="import_candidates">
    <input type="hidden" name="back" value="candidates.php">

    <div class="cols cols-2">
      <div class="field">
        <label for="cand_text">Paste the list</label>
        <textarea id="cand_text" name="cand_text" rows="8" placeholder="roll_no,name,mobile
MHS24001,Asha Verma,9876543210
MHS24002,Ravi Kumar,9876543211"></textarea>
        <div class="hint">Roll number, name, mobile. Header row optional. Comma or tab separated.
          A roll number that already exists has its name and mobile updated.</div>
      </div>
      <div>
        <div class="field">
          <label for="cand_file">…or upload a CSV</label>
          <input type="file" id="cand_file" name="cand_file" accept=".csv,.txt">
        </div>
        <div class="field">
          <label for="test_id">Also allot them to</label>
          <select id="test_id" name="test_id">
            <option value="0">— no test —</option>
            <?php foreach ($tests as $t): ?>
              <option value="<?= (int)$t['id'] ?>"><?= e($t['code']) ?> — <?= e($t['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <button type="submit" class="btn">Import Candidates</button>
      </div>
    </div>
  </form>
</div>

<div class="card">
  <div class="card-head">
    <div class="row between">
      <h2><?= number_format($total) ?> candidate<?= $total === 1 ? '' : 's' ?></h2>
      <form method="get" class="row" style="gap:6px">
        <input type="text" name="q" value="<?= e($q) ?>" placeholder="Roll, name or mobile" style="width:220px">
        <button type="submit" class="btn sm ghost">Search</button>
        <?php if ($q !== ''): ?><a class="btn sm ghost" href="candidates.php">Clear</a><?php endif; ?>
      </form>
    </div>
  </div>

  <?php if (!$rows): ?>
    <div class="note info"><?= $q !== '' ? 'No candidate matches that search.' : 'No candidates yet — import your roll list above.' ?></div>
  <?php else: ?>
  <div class="table-scroll">
    <table>
      <thead>
        <tr><th>Roll No</th><th>Name</th><th>Mobile</th><th>Branch</th>
            <th class="num">Tests</th><th class="num">Submitted</th></tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $c): ?>
        <tr>
          <td class="mono small"><?= e($c['roll_no']) ?></td>
          <td><?= e($c['name']) ?></td>
          <td class="mono small"><?= e($c['mobile']) ?></td>
          <td class="small muted"><?= $c['branch_name'] ? e($c['branch_name']) : '—' ?></td>
          <td class="num"><?= (int)$c['tests_allotted'] ?></td>
          <td class="num"><?= (int)$c['tests_done'] ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <?php if ($pages > 1): ?>
    <div class="row" style="margin-top:14px;gap:6px">
      <?php for ($p = max(1, $page - 3); $p <= min($pages, $page + 3); $p++): ?>
        <a class="btn sm <?= $p === $page ? '' : 'ghost' ?>"
           href="?page=<?= $p ?><?= $q !== '' ? '&q=' . urlencode($q) : '' ?>"><?= $p ?></a>
      <?php endfor; ?>
      <span class="muted small">page <?= $page ?> of <?= $pages ?></span>
    </div>
  <?php endif; ?>
  <?php endif; ?>
</div>

<!-- ================= account ================= -->
<div class="cols cols-2">
  <div class="card">
    <div class="card-head"><h2>Change your password</h2></div>
    <form method="post" action="queries/admin.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="change_password">
      <input type="hidden" name="back" value="candidates.php">
      <div class="field">
        <label for="current_password">Current password</label>
        <input type="password" id="current_password" name="current_password" required autocomplete="current-password">
      </div>
      <div class="field">
        <label for="new_password">New password</label>
        <input type="password" id="new_password" name="new_password" required minlength="8" autocomplete="new-password">
        <div class="hint">At least 8 characters.</div>
      </div>
      <div class="field">
        <label for="confirm_password">Confirm new password</label>
        <input type="password" id="confirm_password" name="confirm_password" required minlength="8" autocomplete="new-password">
      </div>
      <button type="submit" class="btn">Change Password</button>
    </form>
  </div>

  <?php if (auth_is_admin()): ?>
  <div class="card">
    <div class="card-head"><h2>Add a branch login</h2></div>
    <form method="post" action="queries/admin.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="add_staff">
      <input type="hidden" name="back" value="candidates.php">
      <div class="field">
        <label for="new_username">Username</label>
        <input type="text" id="new_username" name="new_username" required maxlength="64" autocomplete="off">
      </div>
      <div class="field">
        <label for="new_name">Branch name</label>
        <input type="text" id="new_name" name="new_name" required maxlength="128" placeholder="e.g. Lucknow Centre">
      </div>
      <div class="field">
        <label for="new_staff_password">Password</label>
        <input type="password" id="new_staff_password" name="new_staff_password" required minlength="8" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="new_role">Role</label>
        <select id="new_role" name="new_role">
          <option value="branch">Branch — manage tests and candidates</option>
          <option value="admin">Head office — can also delete tests</option>
        </select>
      </div>
      <button type="submit" class="btn">Create Login</button>
    </form>
  </div>
  <?php endif; ?>
</div>

<?php staff_footer(); ?>
