/* =====================================================================
   The OMR sheet.

   Every tap updates the screen immediately and joins a queue that is
   flushed to the server in small batches. If the network drops the queue
   simply waits and retries, so a candidate never loses bubbles they have
   already filled.
   ===================================================================== */

import { api, e, notice } from './common.js';

const sheetEl   = document.getElementById('sheet');
const counterEl = document.getElementById('counter');
const totalEl   = document.getElementById('total');
const barEl     = document.getElementById('bar');
const stateEl   = document.getElementById('saveState');
const offlineEl = document.getElementById('offline');
const msgEl     = document.getElementById('msg');
const barBox    = document.getElementById('omrBar');
const footBox   = document.getElementById('footBox');

let cfg = null;
let pending = {};
let inFlight = false;
let timer = null;
let filled = 0;
let submitted = false;

/* ---------------- boot ---------------- */

async function boot() {
  let d;
  try {
    d = await api('/sheet');
  } catch {
    notice(msgEl, 'err', 'Could not reach the server. Please reload the page.');
    return;
  }

  if (d._status === 401) { window.location.href = '/'; return; }
  if (d.locked && d.redirect) { window.location.href = d.redirect; return; }
  if (!d.ok) { notice(msgEl, 'err', d.error || 'Could not open your answer sheet.'); return; }

  cfg = d;
  document.getElementById('testName').textContent = `${d.test.name} · ${d.test.code}`;
  document.getElementById('who').innerHTML =
    `<strong>${e(d.candidate.name)}</strong><br>Roll ${e(d.candidate.roll)} · <a href="/api/logout">Logout</a>`;

  const rules = document.getElementById('rules');
  rules.innerHTML =
    'Tap the option you have marked on your paper. Every bubble is saved '
    + 'automatically &mdash; you may change any answer until you press '
    + '<strong>Submit Answer Sheet</strong>. Marking scheme: '
    + `<strong>+${e(d.test.marks_correct)}</strong> for a correct answer, `
    + `<strong>${e(d.test.marks_wrong)}</strong> for a wrong one, <strong>0</strong> if left blank.`;
  rules.hidden = false;

  render();
  barBox.hidden = false;
  footBox.hidden = false;
  refreshCounter();
  setState('saved', filled ? '· all answers saved' : '');
}

function render() {
  const starts = new Map(cfg.sections.map((s) => [s.from, s]));
  const parts = [];

  for (let q = 1; q <= cfg.test.total; q++) {
    const sec = starts.get(q);
    if (sec) {
      const marks = sec.overridden
        ? ` (+${e(sec.marks_correct)} / ${e(sec.marks_wrong)})` : '';
      parts.push(
        `<div class="section-head">${e(sec.name)}` +
        `<span class="sm"> &mdash; Q${sec.from}&ndash;${sec.to}${marks}</span></div>`
      );
    }

    const sel = cfg.answers[q] ?? '';
    if (sel) filled++;

    const bubbles = cfg.test.letters.map((L) =>
      `<button type="button" class="bub${sel === L ? ' on' : ''}" data-opt="${L}" role="radio" ` +
      `aria-checked="${sel === L}" aria-label="Question ${q} option ${L}">${L}</button>`
    ).join('');

    parts.push(
      `<div class="qrow${sel ? ' done' : ''}" data-q="${q}">` +
      `<div class="qnum">${q}</div>` +
      `<div class="bubbles" role="radiogroup" aria-label="Question ${q}">${bubbles}</div>` +
      `<button type="button" class="clr" title="Clear question ${q}" aria-label="Clear question ${q}">&times;</button>` +
      `</div>`
    );
  }

  sheetEl.innerHTML = parts.join('');
  totalEl.textContent = cfg.test.total;
}

/* ---------------- display ---------------- */

function refreshCounter() {
  counterEl.textContent = filled;
  barEl.style.width = cfg.test.total ? `${((filled / cfg.test.total) * 100).toFixed(2)}%` : '0%';
}

function setState(kind, text) {
  stateEl.className = `save-state ${kind}`;
  stateEl.textContent = text;
}

const unsavedCount = () => Object.keys(pending).length;

/* ---------------- marking ---------------- */

function mark(row, option) {
  const q = row.getAttribute('data-q');
  const was = row.classList.contains('done');

  for (const b of row.querySelectorAll('.bub')) {
    const on = b.getAttribute('data-opt') === option;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  }

  const now = option !== '';
  row.classList.toggle('done', now);

  if (now && !was) filled++;
  if (!now && was) filled--;
  refreshCounter();

  pending[q] = option;
  schedule();
}

sheetEl.addEventListener('click', (ev) => {
  if (submitted) return;

  const bub = ev.target.closest('.bub');
  if (bub) {
    // Tapping the option that is already filled erases it, like a rubber.
    mark(bub.closest('.qrow'), bub.classList.contains('on') ? '' : bub.getAttribute('data-opt'));
    return;
  }

  const clr = ev.target.closest('.clr');
  if (clr) mark(clr.closest('.qrow'), '');
});

// Keyboard: A-E or 1-5 fills, arrows move, Backspace clears.
sheetEl.addEventListener('keydown', (ev) => {
  const bub = ev.target.closest('.bub');
  if (!bub || submitted) return;

  const row = bub.closest('.qrow');
  const bubs = [...row.querySelectorAll('.bub')];
  const idx = bubs.indexOf(bub);
  const key = ev.key;

  if (key === 'ArrowRight' && idx < bubs.length - 1) { bubs[idx + 1].focus(); ev.preventDefault(); return; }
  if (key === 'ArrowLeft' && idx > 0) { bubs[idx - 1].focus(); ev.preventDefault(); return; }

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    let sib = key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling;
    while (sib && !sib.classList.contains('qrow')) {
      sib = key === 'ArrowDown' ? sib.nextElementSibling : sib.previousElementSibling;
    }
    if (sib) {
      const targets = sib.querySelectorAll('.bub');
      (targets[Math.min(idx, targets.length - 1)])?.focus();
    }
    ev.preventDefault();
    return;
  }

  if (key === 'Backspace' || key === 'Delete') { mark(row, ''); ev.preventDefault(); return; }

  if (/^[1-9]$/.test(key)) {
    const byNum = bubs[Number(key) - 1];
    if (byNum) { mark(row, byNum.getAttribute('data-opt')); byNum.focus(); ev.preventDefault(); }
    return;
  }

  const letter = key.toUpperCase();
  const hit = bubs.find((b) => b.getAttribute('data-opt') === letter);
  if (hit) { mark(row, letter); hit.focus(); ev.preventDefault(); }
});

/* ---------------- saving ---------------- */

function schedule() {
  setState('saving', '· saving…');
  clearTimeout(timer);
  // Send sooner once a decent batch has built up.
  timer = setTimeout(flush, unsavedCount() >= 8 ? 150 : 700);
}

async function flush() {
  if (inFlight || submitted) return;

  const batch = pending;
  if (!Object.keys(batch).length) { setState('saved', '· all answers saved'); return; }

  pending = {};
  inFlight = true;

  try {
    const d = await api('/save', { method: 'POST', body: { answers: batch } });
    inFlight = false;

    if (!d.ok) {
      if (d.expired) {
        setState('error', '· session expired — please log in again');
        alert('Your session has expired. You will be taken to the login page. '
            + 'Everything saved so far has been kept.');
        window.location.href = '/';
        return;
      }
      throw new Error(d.error || 'save failed');
    }

    offlineEl.hidden = true;
    if (unsavedCount()) schedule();
    else setState('saved', '· all answers saved');
  } catch {
    inFlight = false;
    // Put the batch back, newer taps winning, and try again shortly.
    for (const [q, v] of Object.entries(batch)) {
      if (!Object.prototype.hasOwnProperty.call(pending, q)) pending[q] = v;
    }
    setState('error', '· could not save — retrying');
    offlineEl.hidden = navigator.onLine;
    setTimeout(flush, 3000);
  }
}

window.addEventListener('online', () => { offlineEl.hidden = true; flush(); });
window.addEventListener('offline', () => { offlineEl.hidden = false; });

window.addEventListener('beforeunload', (ev) => {
  if (!submitted && (unsavedCount() || inFlight)) {
    ev.preventDefault();
    ev.returnValue = '';
  }
});

/* ---------------- submit ---------------- */

function doSubmit() {
  if (submitted || !cfg) return;

  const blank = cfg.test.total - filled;
  const warn = 'Submit your answer sheet?\n\n'
    + `Filled: ${filled} of ${cfg.test.total}\n`
    + (blank > 0 ? `Left blank: ${blank}\n` : '')
    + '\nOnce submitted you cannot change any answer.';
  if (!confirm(warn)) return;

  const buttons = [...document.querySelectorAll('#submitBtn, #submitBtn2')];
  const reset = () => buttons.forEach((b) => { b.disabled = false; b.textContent = 'Submit Answer Sheet'; });
  buttons.forEach((b) => { b.disabled = true; b.textContent = 'Submitting…'; });

  // Make sure every queued bubble lands before the sheet is locked.
  const send = async () => {
    if (unsavedCount() || inFlight) {
      flush();
      setTimeout(send, 400);
      return;
    }

    try {
      const d = await api('/submit', { method: 'POST' });
      if (d.ok) {
        submitted = true;
        window.location.href = d.redirect || '/result';
      } else {
        alert(d.error || 'Could not submit. Please try again.');
        reset();
      }
    } catch {
      alert('Could not reach the server. Check your connection and try again — your answers are safe.');
      reset();
    }
  };
  send();
}

document.getElementById('submitBtn').addEventListener('click', doSubmit);
document.getElementById('submitBtn2').addEventListener('click', doSubmit);

boot();
