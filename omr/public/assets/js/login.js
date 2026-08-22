import { api, e, notice } from './common.js';

/* If the site is not fully set up yet, say exactly what is missing rather
   than letting the first login fail with an unhelpful error. */
(async () => {
  try {
    const h = await api('/health');
    if (h.ok || !Array.isArray(h.checks)) return;

    const problems = h.checks.filter((c) => !c.ok);
    if (!problems.length) return;

    const warnOnly = problems.every((c) => c.warn);
    document.getElementById('setup').innerHTML =
      `<div class="note ${warnOnly ? 'warn' : 'err'}">
         <strong>${warnOnly ? 'Almost ready' : 'Setup not finished'}</strong>
         <ul style="margin:8px 0 0;padding-left:18px">
           ${problems.map((c) => `<li><strong>${e(c.label)}:</strong> ${e(c.detail)}</li>`).join('')}
         </ul>
       </div>`;
  } catch { /* offline, or the function is still deploying */ }
})();

const tabCand  = document.getElementById('tabCand');
const tabStaff = document.getElementById('tabStaff');
const candForm = document.getElementById('candForm');
const staffForm = document.getElementById('staffForm');
const msg      = document.getElementById('msg');
const testPick = document.getElementById('testPick');
const testSel  = document.getElementById('test_id');

function swap(toStaff) {
  tabStaff.classList.toggle('on', toStaff);
  tabCand.classList.toggle('on', !toStaff);
  tabStaff.setAttribute('aria-selected', String(toStaff));
  tabCand.setAttribute('aria-selected', String(!toStaff));
  staffForm.hidden = !toStaff;
  candForm.hidden = toStaff;
  notice(msg, '', '');
}
tabCand.addEventListener('click', () => swap(false));
tabStaff.addEventListener('click', () => swap(true));

// Digits only in the mobile box, paste included.
document.getElementById('mobile').addEventListener('input', (ev) => {
  ev.target.value = ev.target.value.replace(/\D+/g, '').slice(0, 10);
});

async function send(btn, body) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Please wait…';
  notice(msg, '', '');

  try {
    const d = await api('/login', { method: 'POST', body });

    if (d.ok && d.redirect) { window.location.href = d.redirect; return; }

    if (d.choose_test) {
      testSel.innerHTML = d.choose_test
        .map((t) => `<option value="${t.id}">${e(t.name)}</option>`).join('');
      testPick.hidden = false;
      notice(msg, 'info', 'Please choose which test you are filling.');
    } else {
      notice(msg, 'err', d.error || 'Something went wrong. Please try again.');
    }
  } catch {
    notice(msg, 'err', 'Could not reach the server. Check your connection and try again.');
  }

  btn.disabled = false;
  btn.textContent = original;
}

candForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const body = {
    kind: 'candidate',
    roll_no: document.getElementById('roll_no').value.trim(),
    mobile: document.getElementById('mobile').value.trim(),
  };
  if (!testPick.hidden && testSel.value) body.test_id = Number(testSel.value);
  send(document.getElementById('candBtn'), body);
});

staffForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  send(document.getElementById('staffBtn'), {
    kind: 'staff',
    username: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value,
  });
});
