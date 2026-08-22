<?php
require_once __DIR__ . '/includes/bootstrap.php';

// Already signed in? Send them where they belong.
if (auth_staff_id())     { redirect('dashboard.php'); }
if (auth_candidate_id()) { redirect('omr_filling.php'); }

$timed_out = !empty($_SESSION['timed_out']);
unset($_SESSION['timed_out']);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= e(APP_NAME) ?> &middot; Login</title>
<meta name="description" content="<?= e(APP_TAGLINE) ?>">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<div class="login-wrap">

  <div class="login-hero">
    <h1>Online OMR Portal</h1>
    <p>Write the paper offline. Fill your answer sheet here, and get your score
       and All-India rank the moment the key is released.</p>
    <ul>
      <li>Fill and edit your OMR right up to submission</li>
      <li>Every bubble is saved as you tap it</li>
      <li>Instant evaluation against the official key</li>
      <li>Sectional breakdown, rank and percentile</li>
    </ul>
  </div>

  <div class="login-panel">
    <div class="login-box">
      <h2 style="color:var(--navy)"><?= e(APP_NAME) ?></h2>
      <p class="muted small" style="margin-top:0"><?= e(APP_TAGLINE) ?></p>

      <?php if ($timed_out): ?>
        <div class="note warn" style="margin-bottom:16px">
          You were signed out after a period of inactivity. Please log in again —
          nothing you filled has been lost.
        </div>
      <?php endif; ?>

      <div class="tabs" role="tablist">
        <button type="button" id="tabCand"  class="on" role="tab" aria-selected="true">Candidate</button>
        <button type="button" id="tabStaff" role="tab" aria-selected="false">Branch / Office</button>
      </div>

      <div id="msg" style="margin-bottom:14px"></div>

      <!-- ---------------- candidate ---------------- -->
      <form id="candForm" autocomplete="on">
        <input type="hidden" name="action" value="login_candidate">
        <?= csrf_field() ?>
        <div class="field">
          <label for="roll_no">Roll Number</label>
          <input type="text" id="roll_no" name="roll_no" placeholder="e.g. MHS24001"
                 autocomplete="username" required maxlength="32">
        </div>
        <div class="field">
          <label for="mobile">Registered Mobile Number</label>
          <input type="tel" id="mobile" name="mobile" placeholder="10-digit mobile"
                 inputmode="numeric" autocomplete="tel" required maxlength="10">
          <div class="hint">The number given at the time of registration.</div>
        </div>
        <div class="field" id="testPick" hidden>
          <label for="test_id">Select Test</label>
          <select id="test_id" name="test_id"></select>
          <div class="hint">More than one test is open for you right now.</div>
        </div>
        <button type="submit" class="btn block" id="candBtn">Start Filling OMR</button>
      </form>

      <!-- ---------------- staff ---------------- -->
      <form id="staffForm" hidden autocomplete="on">
        <input type="hidden" name="action" value="login_staff">
        <?= csrf_field() ?>
        <div class="field">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" autocomplete="username" required maxlength="64">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn block" id="staffBtn">Login</button>
      </form>

      <p class="small muted center" style="margin-top:22px">
        Trouble logging in? Contact your branch office.
      </p>
    </div>
  </div>
</div>

<script>
(function () {
  var tabCand  = document.getElementById('tabCand'),
      tabStaff = document.getElementById('tabStaff'),
      candForm = document.getElementById('candForm'),
      staffForm= document.getElementById('staffForm'),
      msg      = document.getElementById('msg'),
      testPick = document.getElementById('testPick'),
      testSel  = document.getElementById('test_id');

  function show(kind, text) {
    msg.innerHTML = text ? '<div class="note ' + kind + '">' + text + '</div>' : '';
  }

  function swap(toStaff) {
    tabStaff.classList.toggle('on', toStaff);
    tabCand.classList.toggle('on', !toStaff);
    tabStaff.setAttribute('aria-selected', toStaff);
    tabCand.setAttribute('aria-selected', !toStaff);
    staffForm.hidden = !toStaff;
    candForm.hidden  = toStaff;
    show('', '');
  }
  tabCand.addEventListener('click',  function () { swap(false); });
  tabStaff.addEventListener('click', function () { swap(true); });

  // Digits only in the mobile box, paste included.
  document.getElementById('mobile').addEventListener('input', function () {
    this.value = this.value.replace(/\D+/g, '').slice(0, 10);
  });

  function submit(form, btn, label) {
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Please wait…';
    show('', '');

    fetch('queries/loginauth.php', { method: 'POST', body: new FormData(form) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok && d.redirect) { window.location.href = d.redirect; return; }

        // Candidate is in more than one open test - ask which.
        if (d.choose_test) {
          testSel.innerHTML = d.choose_test.map(function (t) {
            return '<option value="' + t.id + '">' + t.name + '</option>';
          }).join('');
          testPick.hidden = false;
          show('info', 'Please choose which test you are filling.');
        } else {
          show('err', d.error || 'Something went wrong. Please try again.');
        }
        btn.disabled = false;
        btn.textContent = original;
      })
      .catch(function () {
        show('err', 'Could not reach the server. Check your connection and try again.');
        btn.disabled = false;
        btn.textContent = original;
      });
  }

  candForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    submit(candForm, document.getElementById('candBtn'));
  });
  staffForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    submit(staffForm, document.getElementById('staffBtn'));
  });
})();
</script>
</body>
</html>
