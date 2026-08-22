<?php
require_once __DIR__ . '/includes/bootstrap.php';
if (auth_staff_id())     { redirect('dashboard.php'); }
if (auth_candidate_id()) { redirect('omr_filling.php'); }
redirect('login.php');
