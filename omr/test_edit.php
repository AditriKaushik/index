<?php
/**
 * Create a test, or manage everything about an existing one.
 */
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/evaluator.php';
require_staff();

$pdo     = db();
$test_id = get_int('id');
$test    = $test_id ? load_test($pdo, $test_id) : null;

if ($test_id && !$test) {
    flash('err', 'That test does not exist.');
    redirect('tests.php');
}

$is_new   = !$test;
$back     = 'test_edit.php?id=' . $test_id;
$sections = $test ? load_sections($pdo, $test_id) : array();

$key_rows = 0; $allotted = 0; $submitted = 0; $key_map = array();
if ($test) {
    $key_map   = load_key_map($pdo, $test_id);
    $key_rows  = count($key_map);
    $allotted  = (int)$pdo->query('SELECT COUNT(*) FROM test_candidates WHERE test_id=' . (int)$test_id)->fetchColumn();
    $submitted = (int)$pdo->query("SELECT COUNT(*) FROM test_candidates WHERE test_id=" . (int)$test_id . " AND status='submitted'")->fetchColumn();
}

staff_header($is_new ? 'New Test' : $test['name'], 'tests');
?>

<div class="row between">
  <h1><?= $is_new ? 'New Test' : e($test['name']) ?></h1>
  <?php if (!$is_new): ?><div><?= status_pill($test['status']) ?></div><?php endif; ?>
</div>

<!-- ================= details ================= -->
<div class="card">
  <div class="card-head"><h2>1. Test details &amp; marking scheme</h2></div>
  <form method="post" action="queries/admin.php">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save_test">
    <input type="hidden" name="id" value="<?= (int)$test_id ?>">
    <input type="hidden" name="back" value="<?= e($back) ?>">

    <div class="cols cols-2">
      <div class="field">
        <label for="code">Test Code</label>
        <input type="text" id="code" name="code" required maxlength="32"
               value="<?= $test ? e($test['code']) : '' ?>" placeholder="e.g. IBPS-PRE-01">
        <div class="hint">Short and unique. Candidates see this on their sheet.</div>
      </div>
      <div class="field">
        <label for="name">Test Name</label>
        <input type="text" id="name" name="name" required maxlength="191"
               value="<?= $test ? e($test['name']) : '' ?>" placeholder="e.g. IBPS PO Prelims Mock 01">
      </div>
    </div>

    <div class="cols cols-3">
      <div class="field">
        <label for="total_questions">Number of Questions</label>
        <input type="number" id="total_questions" name="total_questions" required min="1" max="500"
               value="<?= $test ? (int)$test['total_questions'] : 100 ?>">
      </div>
      <div class="field">
        <label for="option_count">Options per Question</label>
        <select id="option_count" name="option_count">
          <?php foreach (array(2, 3, 4, 5) as $n): ?>
            <option value="<?= $n ?>" <?= $test && (int)$test['option_count'] === $n ? 'selected' : ($n === 4 && !$test ? 'selected' : '') ?>>
              <?= $n ?> (<?= implode(' ', option_letters($n)) ?>)
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label for="duration_minutes">Duration in Minutes</label>
        <input type="number" id="duration_minutes" name="duration_minutes" min="0" max="600"
               value="<?= $test ? (int)$test['duration_minutes'] : 0 ?>">
        <div class="hint">For your records. 0 if not applicable.</div>
      </div>
    </div>

    <div class="cols cols-2">
      <div class="field">
        <label for="marks_correct">Marks for a Correct Answer</label>
        <input type="number" id="marks_correct" name="marks_correct" step="0.25" required
               value="<?= $test ? fmt_score($test['marks_correct']) : fmt_score(DEFAULT_MARKS_CORRECT) ?>">
      </div>
      <div class="field">
        <label for="marks_wrong">Negative Marking for a Wrong Answer</label>
        <input type="number" id="marks_wrong" name="marks_wrong" step="0.05" required
               value="<?= $test ? fmt_score($test['marks_wrong']) : fmt_score(DEFAULT_MARKS_WRONG) ?>">
        <div class="hint">Enter as a negative number, e.g. <strong>-0.25</strong>. Use 0 for no negative marking.</div>
      </div>
    </div>

    <button type="submit" class="btn"><?= $is_new ? 'Create Test' : 'Save Changes' ?></button>
  </form>
</div>

<?php if ($is_new): ?>
  <div class="note info">Save the test first — sections, answer key and candidates can be added straight after.</div>
  <?php staff_footer(); exit; ?>
<?php endif; ?>

<!-- ================= progress ================= -->
<div class="tiles">
  <div class="tile"><div class="k">Questions</div><div class="v"><?= (int)$test['total_questions'] ?></div></div>
  <div class="tile <?= $key_rows >= (int)$test['total_questions'] ? 'good' : 'bad' ?>">
    <div class="k">Answer key</div><div class="v"><?= $key_rows ?>/<?= (int)$test['total_questions'] ?></div>
  </div>
  <div class="tile"><div class="k">Allotted</div><div class="v"><?= $allotted ?></div></div>
  <div class="tile"><div class="k">Submitted</div><div class="v"><?= $submitted ?></div></div>
</div>

<!-- ================= sections ================= -->
<div class="card">
  <div class="card-head"><h2>2. Sections <span class="muted small">(optional)</span></h2></div>
  <p class="muted small">
    Split the paper into sections to get a sectional breakdown on every result.
    Leave the marks boxes blank to use the test's own scheme
    (+<?= fmt_score($test['marks_correct']) ?> / <?= fmt_score($test['marks_wrong']) ?>).
  </p>

  <form method="post" action="queries/admin.php">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save_sections">
    <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
    <input type="hidden" name="back" value="<?= e($back) ?>">

    <div class="table-scroll">
      <table>
        <thead>
          <tr><th>Section name</th><th class="num">From Q</th><th class="num">To Q</th>
              <th class="num">Correct</th><th class="num">Wrong</th></tr>
        </thead>
        <tbody id="secBody">
        <?php
        $render = $sections;
        if (!$render) { $render = array(array('name'=>'','q_from'=>'','q_to'=>'','marks_correct'=>null,'marks_wrong'=>null)); }
        foreach ($render as $s): ?>
          <tr>
            <td><input type="text" name="sec_name[]"    value="<?= e($s['name']) ?>" placeholder="Reasoning Ability"></td>
            <td><input type="number" name="sec_from[]"  value="<?= e($s['q_from']) ?>" min="1" max="<?= (int)$test['total_questions'] ?>"></td>
            <td><input type="number" name="sec_to[]"    value="<?= e($s['q_to']) ?>"   min="1" max="<?= (int)$test['total_questions'] ?>"></td>
            <td><input type="number" name="sec_correct[]" step="0.25" value="<?= $s['marks_correct'] !== null ? fmt_score($s['marks_correct']) : '' ?>" placeholder="inherit"></td>
            <td><input type="number" name="sec_wrong[]"   step="0.05" value="<?= $s['marks_wrong']   !== null ? fmt_score($s['marks_wrong'])   : '' ?>" placeholder="inherit"></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>

    <div class="row" style="margin-top:12px">
      <button type="button" class="btn ghost sm" id="addSec">+ Add row</button>
      <button type="submit" class="btn">Save Sections</button>
    </div>
    <p class="hint">Clear a section's name and save to remove it.</p>
  </form>
</div>

<!-- ================= answer key ================= -->
<div class="card">
  <div class="card-head"><h2>3. Answer key</h2></div>

  <?php if ($key_rows && $key_rows < (int)$test['total_questions']): ?>
    <div class="note warn" style="margin-bottom:14px">
      Only <?= $key_rows ?> of <?= (int)$test['total_questions'] ?> answers are loaded.
      Questions with no key are treated as <strong>dropped</strong> — no marks and no penalty for anyone.
    </div>
  <?php endif; ?>

  <div class="cols cols-2">
    <form method="post" action="queries/admin.php" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="save_key">
      <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
      <input type="hidden" name="back" value="<?= e($back) ?>">

      <div class="field">
        <label for="key_text">Paste the key</label>
        <textarea id="key_text" name="key_text" rows="12" placeholder="1 A
2 C
3 B
4 A,C
5 *
6 -"></textarea>
      </div>
      <div class="field">
        <label for="key_file">…or upload a CSV / text file</label>
        <input type="file" id="key_file" name="key_file" accept=".csv,.txt">
      </div>
      <button type="submit" class="btn"
              onclick="return confirm('This replaces the whole answer key for this test. Any results already computed will be re-evaluated. Continue?')">
        Save Answer Key
      </button>
    </form>

    <div>
      <h3>Accepted formats</h3>
      <table class="small">
        <tr><td class="mono">1 A</td><td>question number, then the option</td></tr>
        <tr><td class="mono">1,A</td><td>comma, colon, dot or dash all work</td></tr>
        <tr><td class="mono">4 A,C</td><td>either option accepted as correct</td></tr>
        <tr><td class="mono">5 *</td><td><strong>bonus</strong> — full marks to everyone</td></tr>
        <tr><td class="mono">6 -</td><td><strong>dropped</strong> — no marks, no penalty</td></tr>
        <tr><td class="mono">ABCDA…</td><td>a bare run of letters, taken from Q1 onwards</td></tr>
      </table>

      <?php if ($key_rows): ?>
        <h3 style="margin-top:18px">Current key</h3>
        <div class="mono small" style="max-height:170px;overflow:auto;background:#f6f8fb;padding:10px;border-radius:8px">
          <?php for ($q = 1; $q <= (int)$test['total_questions']; $q++): ?>
            <?= $q ?>:<?= isset($key_map[$q]) ? e($key_map[$q]) : '<span style="color:#b3261e">?</span>' ?><?= $q % 10 ? '&nbsp; ' : '<br>' ?>
          <?php endfor; ?>
        </div>
      <?php endif; ?>
    </div>
  </div>
</div>

<!-- ================= candidates ================= -->
<div class="card">
  <div class="card-head"><h2>4. Candidates for this test</h2></div>

  <div class="cols cols-2">
    <form method="post" action="queries/admin.php" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="import_candidates">
      <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
      <input type="hidden" name="back" value="<?= e($back) ?>">

      <div class="field">
        <label for="cand_text">Paste the roll list</label>
        <textarea id="cand_text" name="cand_text" rows="8" placeholder="roll_no,name,mobile
MHS24001,Asha Verma,9876543210
MHS24002,Ravi Kumar,9876543211"></textarea>
        <div class="hint">Three columns: roll number, name, mobile. A header row is optional.
          An existing roll number has its name and mobile updated.</div>
      </div>
      <div class="field">
        <label for="cand_file">…or upload a CSV</label>
        <input type="file" id="cand_file" name="cand_file" accept=".csv,.txt">
      </div>
      <button type="submit" class="btn">Import &amp; Allot to This Test</button>
    </form>

    <div>
      <h3>Already allotted</h3>
      <p class="v" style="font-size:30px;font-weight:700;margin:6px 0"><?= $allotted ?></p>
      <p class="muted small"><?= $submitted ?> have submitted their sheet.</p>

      <form method="post" action="queries/admin.php" style="margin-top:14px">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="allot_all">
        <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
        <input type="hidden" name="back" value="<?= e($back) ?>">
        <button type="submit" class="btn ghost"
                onclick="return confirm('Allot every candidate in the database to this test?')">
          Allot All Existing Candidates
        </button>
      </form>

      <p style="margin-top:14px">
        <a href="results.php?test_id=<?= (int)$test_id ?>">View the full candidate and result list &rarr;</a>
      </p>
    </div>
  </div>
</div>

<!-- ================= status ================= -->
<div class="card">
  <div class="card-head"><h2>5. Run the test</h2></div>

  <div class="row" style="gap:10px">
    <?php
    $buttons = array(
        'open'      => array('Open for Filling', 'good',  'Candidates will be able to log in and fill their OMR. Continue?'),
        'closed'    => array('Close Filling',    'ghost', 'No further sheets can be filled or submitted. Continue?'),
        'published' => array('Evaluate &amp; Publish Result', '', 'This scores every submitted sheet, ranks all candidates and releases results to them. Continue?'),
        'draft'     => array('Back to Draft',    'ghost', 'Move this test back to draft? Candidates will not see it.'),
    );
    foreach ($buttons as $status => $b):
        if ($test['status'] === $status) { continue; } ?>
      <form method="post" action="queries/admin.php">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="set_status">
        <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
        <input type="hidden" name="status" value="<?= e($status) ?>">
        <input type="hidden" name="back" value="<?= e($back) ?>">
        <button type="submit" class="btn <?= e($b[1]) ?>" onclick="return confirm('<?= e($b[2]) ?>')"><?= $b[0] ?></button>
      </form>
    <?php endforeach; ?>

    <form method="post" action="queries/admin.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="evaluate">
      <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
      <input type="hidden" name="back" value="<?= e($back) ?>">
      <button type="submit" class="btn ghost">Re-evaluate &amp; Re-rank</button>
    </form>
  </div>

  <p class="hint" style="margin-top:12px">
    Publishing always re-evaluates first, so the released scores and ranks match the
    key and the sheets exactly as they stand at that moment.
  </p>
</div>

<?php if (auth_is_admin()): ?>
<div class="card" style="border-color:var(--bad-line)">
  <div class="card-head" style="background:var(--bad-bg)"><h2 style="color:var(--bad)">Delete this test</h2></div>
  <p class="muted small">
    This permanently removes the test, its answer key, every filled sheet and every
    result. It cannot be undone.
  </p>
  <form method="post" action="queries/admin.php" class="row">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="delete_test">
    <input type="hidden" name="test_id" value="<?= (int)$test_id ?>">
    <input type="hidden" name="back" value="<?= e($back) ?>">
    <div class="grow" style="max-width:260px">
      <input type="text" name="confirm_code" placeholder="Type <?= e($test['code']) ?> to confirm">
    </div>
    <button type="submit" class="btn danger"
            onclick="return confirm('Delete this test and everything in it? This cannot be undone.')">
      Delete Test
    </button>
  </form>
</div>
<?php endif; ?>

<script>
document.getElementById('addSec').addEventListener('click', function () {
  var body = document.getElementById('secBody');
  var row  = body.rows[0].cloneNode(true);
  var inputs = row.querySelectorAll('input');
  for (var i = 0; i < inputs.length; i++) { inputs[i].value = ''; }
  body.appendChild(row);
});
</script>

<?php staff_footer(); ?>
