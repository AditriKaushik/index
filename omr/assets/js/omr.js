/* =====================================================================
   OMR sheet behaviour.

   Every tap updates the screen immediately and joins a queue that is
   flushed to the server in small batches. If the network drops, the queue
   simply waits and retries, so a candidate never loses bubbles they have
   already filled.
   ===================================================================== */
(function () {
  'use strict';

  var cfg       = window.OMR;
  var sheet     = document.getElementById('sheet');
  var counterEl = document.getElementById('counter');
  var barEl     = document.getElementById('bar');
  var stateEl   = document.getElementById('saveState');
  var offlineEl = document.getElementById('offline');

  var pending   = {};      // q_no -> option ('' means cleared), awaiting send
  var inFlight  = false;
  var timer     = null;
  var filled    = cfg.filled;
  var submitted = false;

  /* ---------------- display ---------------- */

  function refreshCounter() {
    counterEl.textContent = filled;
    barEl.style.width = cfg.total ? (filled / cfg.total * 100).toFixed(2) + '%' : '0%';
  }

  function setState(kind, text) {
    stateEl.className = 'save-state ' + kind;
    stateEl.textContent = text;
  }

  function unsavedCount() {
    return Object.keys(pending).length;
  }

  /* ---------------- marking ---------------- */

  function mark(row, option) {
    var q    = row.getAttribute('data-q');
    var bubs = row.querySelectorAll('.bub');
    var was  = row.classList.contains('done');

    for (var i = 0; i < bubs.length; i++) {
      var on = bubs[i].getAttribute('data-opt') === option;
      bubs[i].classList.toggle('on', on);
      bubs[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }

    var now = option !== '';
    row.classList.toggle('done', now);

    if (now && !was) { filled++; }
    if (!now && was) { filled--; }
    refreshCounter();

    pending[q] = option;
    schedule();
  }

  sheet.addEventListener('click', function (ev) {
    if (submitted) { return; }

    var bub = ev.target.closest('.bub');
    if (bub) {
      var row = bub.closest('.qrow');
      var opt = bub.getAttribute('data-opt');
      // Tapping the option that is already filled erases it, like a rubber.
      mark(row, bub.classList.contains('on') ? '' : opt);
      return;
    }

    var clr = ev.target.closest('.clr');
    if (clr) { mark(clr.closest('.qrow'), ''); }
  });

  // Keyboard: A-E or 1-5 fills, arrows move between questions, Backspace clears.
  sheet.addEventListener('keydown', function (ev) {
    var bub = ev.target.closest('.bub');
    if (!bub || submitted) { return; }

    var row  = bub.closest('.qrow');
    var bubs = Array.prototype.slice.call(row.querySelectorAll('.bub'));
    var idx  = bubs.indexOf(bub);
    var key  = ev.key;

    if (key === 'ArrowRight' && idx < bubs.length - 1) { bubs[idx + 1].focus(); ev.preventDefault(); return; }
    if (key === 'ArrowLeft'  && idx > 0)               { bubs[idx - 1].focus(); ev.preventDefault(); return; }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      var sibling = key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling;
      while (sibling && !sibling.classList.contains('qrow')) {
        sibling = key === 'ArrowDown' ? sibling.nextElementSibling : sibling.previousElementSibling;
      }
      if (sibling) {
        var target = sibling.querySelectorAll('.bub')[Math.min(idx, sibling.querySelectorAll('.bub').length - 1)];
        if (target) { target.focus(); }
      }
      ev.preventDefault();
      return;
    }

    if (key === 'Backspace' || key === 'Delete') { mark(row, ''); ev.preventDefault(); return; }

    var letter = key.toUpperCase();
    if (/^[1-9]$/.test(key)) {
      var byNum = bubs[parseInt(key, 10) - 1];
      if (byNum) { mark(row, byNum.getAttribute('data-opt')); byNum.focus(); ev.preventDefault(); }
      return;
    }
    for (var i = 0; i < bubs.length; i++) {
      if (bubs[i].getAttribute('data-opt') === letter) {
        mark(row, letter);
        bubs[i].focus();
        ev.preventDefault();
        return;
      }
    }
  });

  /* ---------------- saving ---------------- */

  function schedule() {
    setState('saving', '· saving…');
    if (timer) { clearTimeout(timer); }
    // Send sooner once a decent batch has built up.
    timer = setTimeout(flush, unsavedCount() >= 8 ? 150 : 700);
  }

  function flush() {
    if (inFlight || submitted) { return; }
    var batch = pending;
    if (!Object.keys(batch).length) { setState('saved', '· all answers saved'); return; }

    pending  = {};
    inFlight = true;

    var body = new FormData();
    body.append('action', 'save');
    body.append('csrf_token', cfg.csrf);
    body.append('answers', JSON.stringify(batch));

    fetch(cfg.endpoint, { method: 'POST', body: body, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { throw new Error('bad reply'); }); })
      .then(function (d) {
        inFlight = false;
        if (!d.ok) {
          if (d.expired) {
            setState('error', '· session expired — please log in again');
            alert('Your session has expired. You will be taken to the login page. '
                + 'Everything saved so far has been kept.');
            window.location.href = 'login.php';
            return;
          }
          throw new Error(d.error || 'save failed');
        }
        offlineEl.hidden = true;
        if (unsavedCount()) { schedule(); }
        else { setState('saved', '· all answers saved'); }
      })
      .catch(function () {
        inFlight = false;
        // Put the batch back, newer taps winning, and try again shortly.
        for (var q in batch) {
          if (!Object.prototype.hasOwnProperty.call(pending, q)) { pending[q] = batch[q]; }
        }
        setState('error', '· could not save — retrying');
        offlineEl.hidden = navigator.onLine;
        setTimeout(flush, 3000);
      });
  }

  window.addEventListener('online',  function () { offlineEl.hidden = true; flush(); });
  window.addEventListener('offline', function () { offlineEl.hidden = false; });

  window.addEventListener('beforeunload', function (ev) {
    if (!submitted && (unsavedCount() || inFlight)) {
      ev.preventDefault();
      ev.returnValue = '';
      return '';
    }
  });

  /* ---------------- submit ---------------- */

  function doSubmit() {
    if (submitted) { return; }

    var blank = cfg.total - filled;
    var warn  = 'Submit your answer sheet?\n\n'
              + 'Filled: ' + filled + ' of ' + cfg.total + '\n'
              + (blank > 0 ? 'Left blank: ' + blank + '\n' : '')
              + '\nOnce submitted you cannot change any answer.';
    if (!confirm(warn)) { return; }

    var buttons = document.querySelectorAll('#submitBtn, #submitBtn2');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = true;
      buttons[i].textContent = 'Submitting…';
    }

    // Make sure every queued bubble lands before the sheet is locked.
    function send() {
      if (unsavedCount() || inFlight) {
        flush();
        setTimeout(send, 400);
        return;
      }

      var body = new FormData();
      body.append('action', 'submit');
      body.append('csrf_token', cfg.csrf);

      fetch(cfg.endpoint, { method: 'POST', body: body, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            submitted = true;
            window.location.href = d.redirect || 'result.php';
          } else {
            alert(d.error || 'Could not submit. Please try again.');
            for (var i = 0; i < buttons.length; i++) {
              buttons[i].disabled = false;
              buttons[i].textContent = 'Submit Answer Sheet';
            }
          }
        })
        .catch(function () {
          alert('Could not reach the server. Check your connection and try again — '
              + 'your answers are safe.');
          for (var i = 0; i < buttons.length; i++) {
            buttons[i].disabled = false;
            buttons[i].textContent = 'Submit Answer Sheet';
          }
        });
    }
    send();
  }

  document.getElementById('submitBtn').addEventListener('click', doSubmit);
  document.getElementById('submitBtn2').addEventListener('click', doSubmit);

  refreshCounter();
  setState('saved', filled ? '· all answers saved' : '');
})();
