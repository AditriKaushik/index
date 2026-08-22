<?php
/**
 * Shared chrome for the staff pages.
 */

function staff_header($title, $active = '')
{
    $nav = array(
        'dashboard'  => array('dashboard.php',  'Dashboard'),
        'tests'      => array('tests.php',      'Tests'),
        'candidates' => array('candidates.php', 'Candidates'),
        'results'    => array('results.php',    'Results & Ranks'),
    );
    ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= e($title) ?> &middot; <?= e(APP_NAME) ?></title>
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
<header class="topbar">
  <div class="wrap">
    <div class="row between">
      <div class="brand">
        <?= e(APP_NAME) ?>
        <span><?= e(APP_TAGLINE) ?></span>
      </div>
      <div class="right small">
        <strong><?= e($_SESSION['staff_name']) ?></strong>
        <span style="opacity:.75">(<?= e($_SESSION['staff_role']) ?>)</span><br>
        <a href="logout.php">Logout</a>
      </div>
    </div>
    <nav class="nav">
      <?php foreach ($nav as $key => $item): ?>
        <a href="<?= e($item[0]) ?>" class="<?= $active === $key ? 'on' : '' ?>"><?= e($item[1]) ?></a>
      <?php endforeach; ?>
    </nav>
  </div>
</header>
<main>
<div class="wrap stack">
<?php
    foreach (take_flashes() as $f) {
        $cls = $f['type'] === 'err' ? 'err' : ($f['type'] === 'warn' ? 'warn' : 'ok');
        echo '<div class="note ' . $cls . '">' . e($f['message']) . '</div>';
    }
}

function staff_footer()
{
    ?>
</div>
</main>
</body>
</html>
<?php
}

/** Coloured status pill for a test. */
function status_pill($status)
{
    $label = array(
        'draft'     => 'Draft',
        'open'      => 'Open for filling',
        'closed'    => 'Closed',
        'published' => 'Result published',
    );
    $s = isset($label[$status]) ? $label[$status] : $status;
    return '<span class="pill ' . e($status) . '">' . e($s) . '</span>';
}
