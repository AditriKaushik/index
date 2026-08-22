/* =====================================================================
   Staff console: dashboard, tests, test management, candidates, results.
   One page, routed by the URL hash.
   ===================================================================== */

import { api, e, notice, when, pill } from './common.js';

const view = document.getElementById('view');
const msg  = document.getElementById('msg');

let me = null;

const flash = (level, text) => {
  notice(msg, level === 'err' ? 'err' : level === 'warn' ? 'warn' : 'ok', text);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/** POST helper that shows the reply as a notice and returns the data. */
async function act(path, body, { quiet = false } = {}) {
  try {
    const d = await api(path, { method: 'POST', body });
    if (d._status === 401) { window.location.href = '/'; return d; }
    if (!quiet) flash(d.ok ? (d.level || 'ok') : 'err', d.ok ? d.message : d.error);
    return d;
  } catch {
    flash('err', 'Could not reach the server. Please try again.');
    return { ok: false };
  }
}

async function load(path) {
  const d = await api(path);
  if (d._status === 401) { window.location.href = '/'; return null; }
  if (!d.ok) { flash('err', d.error || 'Could not load that.'); return null; }
  return d;
}

/* =====================================================================
   Views
   =================================================================== */

async function viewDashboard() {
  const d = await load('/admin/overview');
  if (!d) return;

  const c = d.counts;
  const recent = d.tests.slice(0, 10);

  const rows = recent.map((t) => `
    <tr>
      <td class="mono small">${e(t.code)}</td>
      <td><strong>${e(t.name)}</strong></td>
      <td>${pill(t.status)}</td>
      <td class="num">${t.total_questions}</td>
      <td class="num">${t.key_rows >= t.total_questions
        ? '<span style="color:var(--good)">&#10003;</span>'
        : `<span style="color:var(--bad)">${t.key_rows}/${t.total_questions}</span>`}</td>
      <td class="num">${t.allotted}</td>
      <td class="num">${t.submitted}</td>
      <td class="nowrap">
        <a class="btn sm ghost" href="#/test/${t.id}">Manage</a>
        <a class="btn sm ghost" href="#/results?test=${t.id}">Results</a>
      </td>
    </tr>`).join('');

  view.innerHTML = `
    <div class="tiles">
      <div class="tile hero"><div class="k">Tests</div><div class="v">${c.tests}</div></div>
      <div class="tile good"><div class="k">Open now</div><div class="v">${c.open}</div></div>
      <div class="tile"><div class="k">Candidates</div><div class="v">${c.candidates}</div></div>
      <div class="tile"><div class="k">Sheets submitted</div><div class="v">${c.submitted}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><div class="row between">
        <h2>Recent tests</h2><a class="btn sm" href="#/test/new">+ New Test</a>
      </div></div>
      ${recent.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Code</th><th>Test</th><th>Status</th><th class="num">Qs</th>
          <th class="num">Key</th><th class="num">Allotted</th><th class="num">Submitted</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
      : `<div class="note info">No tests yet. Create one, upload its answer key, allot your
          candidates, then set it to <strong>Open</strong> so they can fill their sheets.</div>`}
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
        <li><strong>Evaluate &amp; publish</strong> — scores and ranks are computed and released.</li>
      </ol>
    </div>`;
}

async function viewTests() {
  const d = await load('/admin/overview');
  if (!d) return;

  const rows = d.tests.map((t) => `
    <tr>
      <td class="mono small">${e(t.code)}</td>
      <td><strong>${e(t.name)}</strong><br><span class="muted small">${e(when(t.created_at))}</span></td>
      <td>${pill(t.status)}</td>
      <td class="num">${t.total_questions}</td>
      <td class="num nowrap">+${e(t.marks_correct)} / ${e(t.marks_wrong)}</td>
      <td class="num">${t.key_rows >= t.total_questions
        ? '<span style="color:var(--good)">&#10003;</span>'
        : t.key_rows ? `<span style="color:var(--warn)">${t.key_rows}/${t.total_questions}</span>`
        : '<span class="muted">&mdash;</span>'}</td>
      <td class="num">${t.allotted}</td>
      <td class="num">${t.submitted}</td>
      <td class="nowrap">
        <a class="btn sm ghost" href="#/test/${t.id}">Manage</a>
        <a class="btn sm ghost" href="#/results?test=${t.id}">Results</a>
      </td>
    </tr>`).join('');

  view.innerHTML = `
    <div class="row between"><h1>Tests</h1><a class="btn" href="#/test/new">+ New Test</a></div>
    <div class="card">
      ${d.tests.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Code</th><th>Test</th><th>Status</th><th class="num">Qs</th>
          <th class="num">Marks</th><th class="num">Key</th><th class="num">Allotted</th>
          <th class="num">Submitted</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
      : '<div class="note info">No tests yet. Create your first one to get started.</div>'}
    </div>`;
}

async function viewTest(id) {
  const isNew = id === 'new';
  let d = null;

  if (!isNew) {
    d = await load('/admin/test?id=' + encodeURIComponent(id));
    if (!d) return;
  }

  const t = d?.test ?? {
    id: 0, code: '', name: '', total_questions: 100, option_count: 4,
    marks_correct: '1', marks_wrong: '-0.25', duration_minutes: 0, status: 'draft',
  };

  const secRows = (d?.sections?.length ? d.sections : [{ name: '', q_from: '', q_to: '', marks_correct: '', marks_wrong: '' }])
    .map((s) => sectionRow(s, t.total_questions)).join('');

  view.innerHTML = `
    <div class="row between">
      <h1>${isNew ? 'New Test' : e(t.name)}</h1>
      ${isNew ? '' : `<div>${pill(t.status)}</div>`}
    </div>

    <div class="card">
      <div class="card-head"><h2>1. Test details &amp; marking scheme</h2></div>
      <form id="testForm">
        <div class="cols cols-2">
          <div class="field">
            <label for="f_code">Test Code</label>
            <input type="text" id="f_code" required maxlength="32" value="${e(t.code)}" placeholder="e.g. IBPS-PRE-01">
            <div class="hint">Short and unique. Candidates see this on their sheet.</div>
          </div>
          <div class="field">
            <label for="f_name">Test Name</label>
            <input type="text" id="f_name" required maxlength="191" value="${e(t.name)}" placeholder="e.g. IBPS PO Prelims Mock 01">
          </div>
        </div>
        <div class="cols cols-3">
          <div class="field">
            <label for="f_total">Number of Questions</label>
            <input type="number" id="f_total" required min="1" max="500" value="${t.total_questions}">
          </div>
          <div class="field">
            <label for="f_opts">Options per Question</label>
            <select id="f_opts">
              ${[2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(t.option_count) === n ? 'selected' : ''}>
                ${n} (${'ABCDE'.slice(0, n).split('').join(' ')})</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="f_mins">Duration in Minutes</label>
            <input type="number" id="f_mins" min="0" max="600" value="${t.duration_minutes}">
            <div class="hint">For your records. 0 if not applicable.</div>
          </div>
        </div>
        <div class="cols cols-2">
          <div class="field">
            <label for="f_mc">Marks for a Correct Answer</label>
            <input type="number" id="f_mc" step="0.25" required value="${e(t.marks_correct)}">
          </div>
          <div class="field">
            <label for="f_mw">Negative Marking for a Wrong Answer</label>
            <input type="number" id="f_mw" step="0.05" required value="${e(t.marks_wrong)}">
            <div class="hint">Enter as a negative number, e.g. <strong>-0.25</strong>. Use 0 for no negative marking.</div>
          </div>
        </div>
        <button type="submit" class="btn">${isNew ? 'Create Test' : 'Save Changes'}</button>
      </form>
    </div>

    ${isNew ? `<div class="note info">Save the test first — sections, answer key and candidates
       can be added straight after.</div>` : `

    <div class="tiles">
      <div class="tile"><div class="k">Questions</div><div class="v">${t.total_questions}</div></div>
      <div class="tile ${d.key_rows >= t.total_questions ? 'good' : 'bad'}">
        <div class="k">Answer key</div><div class="v">${d.key_rows}/${t.total_questions}</div></div>
      <div class="tile"><div class="k">Allotted</div><div class="v">${d.allotted}</div></div>
      <div class="tile"><div class="k">Submitted</div><div class="v">${d.submitted}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>2. Sections <span class="muted small">(optional)</span></h2></div>
      <p class="muted small">Split the paper into sections to get a sectional breakdown on every
        result. Leave the marks boxes blank to use the test's own scheme
        (+${e(t.marks_correct)} / ${e(t.marks_wrong)}).</p>
      <form id="secForm">
        <div class="table-scroll"><table>
          <thead><tr><th>Section name</th><th class="num">From Q</th><th class="num">To Q</th>
            <th class="num">Correct</th><th class="num">Wrong</th></tr></thead>
          <tbody id="secBody">${secRows}</tbody>
        </table></div>
        <div class="row" style="margin-top:12px">
          <button type="button" class="btn ghost sm" id="addSec">+ Add row</button>
          <button type="submit" class="btn">Save Sections</button>
        </div>
        <p class="hint">Clear a section's name and save to remove it.</p>
      </form>
    </div>

    <div class="card">
      <div class="card-head"><h2>3. Answer key</h2></div>
      ${d.key_rows && d.key_rows < t.total_questions ? `<div class="note warn" style="margin-bottom:14px">
        Only ${d.key_rows} of ${t.total_questions} answers are loaded. Questions with no key are
        treated as <strong>dropped</strong> — no marks and no penalty for anyone.</div>` : ''}
      <div class="cols cols-2">
        <form id="keyForm">
          <div class="field">
            <label for="f_key">Paste the key</label>
            <textarea id="f_key" rows="12" placeholder="1 A&#10;2 C&#10;3 B&#10;4 A,C&#10;5 *&#10;6 -"></textarea>
          </div>
          <div class="field">
            <label for="f_keyfile">…or choose a CSV / text file</label>
            <input type="file" id="f_keyfile" accept=".csv,.txt">
          </div>
          <button type="submit" class="btn">Save Answer Key</button>
        </form>
        <div>
          <h3>Accepted formats</h3>
          <table class="small">
            <tr><td class="mono">1 A</td><td>question number, then the option</td></tr>
            <tr><td class="mono">1,A</td><td>comma, colon, dot or dash all work</td></tr>
            <tr><td class="mono">4 A,C</td><td>either option accepted as correct</td></tr>
            <tr><td class="mono">5 *</td><td><strong>bonus</strong> — full marks to everyone</td></tr>
            <tr><td class="mono">6 -</td><td><strong>dropped</strong> — no marks, no penalty</td></tr>
            <tr><td class="mono">ABCDA…</td><td>a bare run of letters, from Q1 onwards</td></tr>
          </table>
          ${d.key_rows ? `<h3 style="margin-top:18px">Current key</h3>
            <div class="mono small" style="max-height:170px;overflow:auto;background:#f6f8fb;padding:10px;border-radius:8px">
            ${Array.from({ length: t.total_questions }, (_, i) => {
              const n = i + 1;
              const v = d.key[n] ?? '<span style="color:#b3261e">?</span>';
              return `${n}:${v}${n % 10 ? '&nbsp; ' : '<br>'}`;
            }).join('')}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>4. Candidates for this test</h2></div>
      <div class="cols cols-2">
        <form id="candForm">
          <div class="field">
            <label for="f_cands">Paste the roll list</label>
            <textarea id="f_cands" rows="8" placeholder="roll_no,name,mobile&#10;MHS24001,Asha Verma,9876543210"></textarea>
            <div class="hint">Three columns: roll number, name, mobile. A header row is optional.
              An existing roll number has its name and mobile updated.</div>
          </div>
          <div class="field">
            <label for="f_candfile">…or choose a CSV</label>
            <input type="file" id="f_candfile" accept=".csv,.txt">
          </div>
          <button type="submit" class="btn">Import &amp; Allot to This Test</button>
        </form>
        <div>
          <h3>Already allotted</h3>
          <p style="font-size:30px;font-weight:700;margin:6px 0">${d.allotted}</p>
          <p class="muted small">${d.submitted} have submitted their sheet.</p>
          <button type="button" class="btn ghost" id="allotAll" style="margin-top:14px">
            Allot All Existing Candidates</button>
          <p style="margin-top:14px"><a href="#/results?test=${t.id}">View the full result list &rarr;</a></p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>5. Run the test</h2></div>
      <div class="row" style="gap:10px" id="statusBtns">
        ${[['open', 'Open for Filling', 'good', 'Candidates will be able to log in and fill their OMR. Continue?'],
           ['closed', 'Close Filling', 'ghost', 'No further sheets can be filled or submitted. Continue?'],
           ['published', 'Evaluate &amp; Publish Result', '', 'This scores every submitted sheet, ranks all candidates and releases results to them. Continue?'],
           ['draft', 'Back to Draft', 'ghost', 'Move this test back to draft? Candidates will not see it.']]
          .filter(([s]) => s !== t.status)
          .map(([s, label, cls, warn]) =>
            `<button type="button" class="btn ${cls}" data-status="${s}" data-warn="${e(warn)}">${label}</button>`).join('')}
        <button type="button" class="btn ghost" id="reEval">Re-evaluate &amp; Re-rank</button>
      </div>
      <p class="hint" style="margin-top:12px">Publishing always re-evaluates first, so the released
        scores and ranks match the key and the sheets exactly as they stand at that moment.</p>
    </div>

    ${me?.role === 'admin' ? `
    <div class="card" style="border-color:var(--bad-line)">
      <div class="card-head" style="background:var(--bad-bg)"><h2 style="color:var(--bad)">Delete this test</h2></div>
      <p class="muted small">This permanently removes the test, its answer key, every filled sheet
        and every result. It cannot be undone.</p>
      <form id="delForm" class="row">
        <div class="grow" style="max-width:260px">
          <input type="text" id="f_confirm" placeholder="Type ${e(t.code)} to confirm">
        </div>
        <button type="submit" class="btn danger">Delete Test</button>
      </form>
    </div>` : ''}
    `}`;

  wireTestForms(t, isNew);
}

function sectionRow(s, total) {
  return `<tr>
    <td><input type="text" class="s-name" value="${e(s.name)}" placeholder="Reasoning Ability"></td>
    <td><input type="number" class="s-from" value="${e(s.q_from)}" min="1" max="${total}"></td>
    <td><input type="number" class="s-to" value="${e(s.q_to)}" min="1" max="${total}"></td>
    <td><input type="number" class="s-mc" step="0.25" value="${e(s.marks_correct)}" placeholder="inherit"></td>
    <td><input type="number" class="s-mw" step="0.05" value="${e(s.marks_wrong)}" placeholder="inherit"></td>
  </tr>`;
}

function wireTestForms(t, isNew) {
  document.getElementById('testForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = await act('/admin/test', {
      id: isNew ? 0 : t.id,
      code: document.getElementById('f_code').value.trim(),
      name: document.getElementById('f_name').value.trim(),
      total_questions: Number(document.getElementById('f_total').value),
      option_count: Number(document.getElementById('f_opts').value),
      duration_minutes: Number(document.getElementById('f_mins').value),
      marks_correct: Number(document.getElementById('f_mc').value),
      marks_wrong: Number(document.getElementById('f_mw').value),
    });
    if (d.ok) {
      if (isNew) window.location.hash = '#/test/' + d.id;
      else route();
    }
  });

  if (isNew) return;

  document.getElementById('addSec').addEventListener('click', () => {
    document.getElementById('secBody').insertAdjacentHTML('beforeend',
      sectionRow({ name: '', q_from: '', q_to: '', marks_correct: '', marks_wrong: '' }, t.total_questions));
  });

  document.getElementById('secForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const sections = [...document.querySelectorAll('#secBody tr')].map((tr) => ({
      name: tr.querySelector('.s-name').value.trim(),
      q_from: Number(tr.querySelector('.s-from').value),
      q_to: Number(tr.querySelector('.s-to').value),
      marks_correct: tr.querySelector('.s-mc').value.trim(),
      marks_wrong: tr.querySelector('.s-mw').value.trim(),
    })).filter((s) => s.name);
    const d = await act('/admin/sections', { test_id: t.id, sections });
    if (d.ok) route();
  });

  // Choosing a file drops its text straight into the box, so one path handles both.
  const pipeFile = (fileInput, target) => {
    document.getElementById(fileInput).addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { flash('err', 'That file is larger than 2 MB.'); return; }
      document.getElementById(target).value = await f.text();
    });
  };
  pipeFile('f_keyfile', 'f_key');
  pipeFile('f_candfile', 'f_cands');

  document.getElementById('keyForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!confirm('This replaces the whole answer key for this test. Any results already computed will be re-evaluated. Continue?')) return;
    const d = await act('/admin/key', { test_id: t.id, text: document.getElementById('f_key').value });
    if (d.ok) route();
  });

  document.getElementById('candForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = await act('/admin/candidates', { test_id: t.id, text: document.getElementById('f_cands').value });
    if (d.ok) route();
  });

  document.getElementById('allotAll').addEventListener('click', async () => {
    if (!confirm('Allot every candidate in the database to this test?')) return;
    const d = await act('/admin/allot-all', { test_id: t.id });
    if (d.ok) route();
  });

  for (const btn of document.querySelectorAll('#statusBtns [data-status]')) {
    btn.addEventListener('click', async () => {
      if (!confirm(btn.getAttribute('data-warn'))) return;
      const d = await act('/admin/status', { test_id: t.id, status: btn.getAttribute('data-status') });
      if (d.ok) route();
    });
  }

  document.getElementById('reEval').addEventListener('click', async () => {
    await act('/admin/evaluate', { test_id: t.id });
  });

  document.getElementById('delForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!confirm('Delete this test and everything in it? This cannot be undone.')) return;
    const d = await act('/admin/delete-test', {
      test_id: t.id, confirm_code: document.getElementById('f_confirm').value.trim(),
    });
    if (d.ok) window.location.hash = '#/tests';
  });
}

async function viewCandidates(params) {
  const search = params.get('q') ?? '';
  const page = params.get('page') ?? '1';

  const d = await load(`/admin/candidates?q=${encodeURIComponent(search)}&page=${encodeURIComponent(page)}`);
  if (!d) return;

  const over = await load('/admin/overview');
  const openTests = (over?.tests ?? []).filter((t) => ['draft', 'open'].includes(t.status));

  const rows = d.candidates.map((c) => `
    <tr>
      <td class="mono small">${e(c.roll_no)}</td>
      <td>${e(c.name)}</td>
      <td class="mono small">${e(c.mobile)}</td>
      <td class="small muted">${c.branch_name ? e(c.branch_name) : '—'}</td>
      <td class="num">${c.tests_allotted}</td>
      <td class="num">${c.tests_done}</td>
    </tr>`).join('');

  const pager = d.pages > 1 ? `<div class="row" style="margin-top:14px;gap:6px">
    ${Array.from({ length: d.pages }, (_, i) => i + 1)
      .filter((p) => Math.abs(p - d.page) <= 3)
      .map((p) => `<a class="btn sm ${p === d.page ? '' : 'ghost'}"
        href="#/candidates?page=${p}${search ? '&q=' + encodeURIComponent(search) : ''}">${p}</a>`).join('')}
    <span class="muted small">page ${d.page} of ${d.pages}</span></div>` : '';

  view.innerHTML = `
    <h1>Candidates</h1>

    <div class="card">
      <div class="card-head"><h2>Import candidates</h2></div>
      <form id="impForm">
        <div class="cols cols-2">
          <div class="field">
            <label for="i_text">Paste the list</label>
            <textarea id="i_text" rows="8" placeholder="roll_no,name,mobile&#10;MHS24001,Asha Verma,9876543210"></textarea>
            <div class="hint">Roll number, name, mobile. Header row optional. Comma or tab separated.
              A roll number that already exists has its name and mobile updated.</div>
          </div>
          <div>
            <div class="field">
              <label for="i_file">…or choose a CSV</label>
              <input type="file" id="i_file" accept=".csv,.txt">
            </div>
            <div class="field">
              <label for="i_test">Also allot them to</label>
              <select id="i_test">
                <option value="0">— no test —</option>
                ${openTests.map((t) => `<option value="${t.id}">${e(t.code)} — ${e(t.name)}</option>`).join('')}
              </select>
            </div>
            <button type="submit" class="btn">Import Candidates</button>
          </div>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-head"><div class="row between">
        <h2>${d.total.toLocaleString('en-IN')} candidate${d.total === 1 ? '' : 's'}</h2>
        <form id="searchForm" class="row" style="gap:6px">
          <input type="text" id="s_q" value="${e(search)}" placeholder="Roll, name or mobile" style="width:220px">
          <button type="submit" class="btn sm ghost">Search</button>
          ${search ? '<a class="btn sm ghost" href="#/candidates">Clear</a>' : ''}
        </form>
      </div></div>
      ${d.candidates.length ? `<div class="table-scroll"><table>
        <thead><tr><th>Roll No</th><th>Name</th><th>Mobile</th><th>Branch</th>
          <th class="num">Tests</th><th class="num">Submitted</th></tr></thead>
        <tbody>${rows}</tbody></table></div>${pager}`
      : `<div class="note info">${search ? 'No candidate matches that search.'
          : 'No candidates yet — import your roll list above.'}</div>`}
    </div>

    <div class="cols cols-2">
      <div class="card">
        <div class="card-head"><h2>Change your password</h2></div>
        <form id="pwForm">
          <div class="field"><label for="p_cur">Current password</label>
            <input type="password" id="p_cur" required autocomplete="current-password"></div>
          <div class="field"><label for="p_new">New password</label>
            <input type="password" id="p_new" required minlength="8" autocomplete="new-password">
            <div class="hint">At least 8 characters.</div></div>
          <div class="field"><label for="p_con">Confirm new password</label>
            <input type="password" id="p_con" required minlength="8" autocomplete="new-password"></div>
          <button type="submit" class="btn">Change Password</button>
        </form>
      </div>

      ${me?.role === 'admin' ? `
      <div class="card">
        <div class="card-head"><h2>Add a branch login</h2></div>
        <form id="staffForm">
          <div class="field"><label for="n_user">Username</label>
            <input type="text" id="n_user" required maxlength="64" autocomplete="off"></div>
          <div class="field"><label for="n_name">Branch name</label>
            <input type="text" id="n_name" required maxlength="128" placeholder="e.g. Lucknow Centre"></div>
          <div class="field"><label for="n_pass">Password</label>
            <input type="password" id="n_pass" required minlength="8" autocomplete="new-password"></div>
          <div class="field"><label for="n_role">Role</label>
            <select id="n_role">
              <option value="branch">Branch — manage tests and candidates</option>
              <option value="admin">Head office — can also delete tests</option>
            </select></div>
          <button type="submit" class="btn">Create Login</button>
        </form>
      </div>` : ''}
    </div>`;

  document.getElementById('i_file').addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { flash('err', 'That file is larger than 2 MB.'); return; }
    document.getElementById('i_text').value = await f.text();
  });

  document.getElementById('impForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d2 = await act('/admin/candidates', {
      text: document.getElementById('i_text').value,
      test_id: Number(document.getElementById('i_test').value),
    });
    if (d2.ok) route();
  });

  document.getElementById('searchForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = document.getElementById('s_q').value.trim();
    window.location.hash = '#/candidates' + (v ? '?q=' + encodeURIComponent(v) : '');
    route();
  });

  document.getElementById('pwForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d2 = await act('/admin/password', {
      current_password: document.getElementById('p_cur').value,
      new_password: document.getElementById('p_new').value,
      confirm_password: document.getElementById('p_con').value,
    });
    if (d2.ok) ev.target.reset();
  });

  document.getElementById('staffForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d2 = await act('/admin/staff', {
      username: document.getElementById('n_user').value.trim(),
      name: document.getElementById('n_name').value.trim(),
      password: document.getElementById('n_pass').value,
      role: document.getElementById('n_role').value,
    });
    if (d2.ok) ev.target.reset();
  });
}

async function viewResults(params) {
  const testId = params.get('test') ?? '';
  const search = params.get('q') ?? '';

  const over = await load('/admin/overview');
  if (!over) return;

  const picker = `
    <div class="card">
      <form id="pickForm" class="row">
        <div class="grow" style="max-width:420px">
          <label for="r_test">Test</label>
          <select id="r_test">
            <option value="">— select a test —</option>
            ${over.tests.map((t) => `<option value="${t.id}" ${String(t.id) === testId ? 'selected' : ''}>
              ${e(t.code)} — ${e(t.name)}</option>`).join('')}
          </select>
        </div>
        ${testId ? `<div class="grow" style="max-width:260px">
          <label for="r_q">Find a candidate</label>
          <input type="text" id="r_q" value="${e(search)}" placeholder="Roll number or name">
        </div>
        <div style="align-self:end"><button type="submit" class="btn ghost">Search</button></div>` : ''}
      </form>
    </div>`;

  if (!testId) {
    view.innerHTML = `<h1>Results &amp; Ranks</h1>${picker}
      <div class="note info">Choose a test above to see its merit list.</div>`;
    wireResultPicker();
    return;
  }

  const d = await load(`/admin/results?test_id=${encodeURIComponent(testId)}&q=${encodeURIComponent(search)}`);
  if (!d) return;

  const s = d.stats;
  const anyRanked = d.results.some((r) => r.rank !== null);

  const rows = d.results.map((r) => {
    const cls = r.rank !== null && r.rank <= 3 ? ` class="rank-${r.rank}"` : '';
    return `<tr>
      <td class="num"${cls}>${r.rank ?? '—'}</td>
      <td class="mono small">${e(r.roll_no)}</td>
      <td>${e(r.name)}</td>
      <td class="num" style="color:var(--good)">${r.correct}</td>
      <td class="num" style="color:var(--bad)">${r.wrong}</td>
      <td class="num">${r.unattempted}</td>
      <td class="num"><strong>${e(r.score)}</strong> <span class="muted small">/${e(r.max_score)}</span></td>
      <td class="num">${e(r.percentage)}</td>
      <td class="num">${r.percentile ?? '—'}</td>
      <td class="small nowrap">${e(when(r.submitted_at))}</td>
      <td class="nowrap"><button type="button" class="btn sm ghost" data-reopen="${r.candidate_id}">Reopen</button></td>
    </tr>`;
  }).join('');

  const waitRows = d.waiting.map((w) => `
    <tr>
      <td class="mono small">${e(w.roll_no)}</td>
      <td>${e(w.name)}</td>
      <td class="mono small">${e(w.mobile)}</td>
      <td>${w.status === 'in_progress'
        ? '<span class="pill open">Filling now</span>'
        : '<span class="pill draft">Not started</span>'}</td>
      <td class="small">${e(when(w.started_at))}</td>
      <td><button type="button" class="btn sm ghost" data-unallot="${w.id}">Remove</button></td>
    </tr>`).join('');

  view.innerHTML = `
    <div class="row between">
      <h1>Results &amp; Ranks</h1>
      <a class="btn ghost" href="/api/admin/export?test_id=${encodeURIComponent(testId)}">Download CSV</a>
    </div>
    ${picker}

    <div class="tiles">
      <div class="tile hero"><div class="k">Evaluated</div><div class="v">${s.n}</div></div>
      <div class="tile good"><div class="k">Highest</div><div class="v">${s.hi ?? '—'}</div></div>
      <div class="tile"><div class="k">Average</div><div class="v">${s.avg ?? '—'}</div></div>
      <div class="tile"><div class="k">Lowest</div><div class="v">${s.lo ?? '—'}</div></div>
      <div class="tile ${s.pending ? 'bad' : ''}"><div class="k">Not submitted</div><div class="v">${s.pending}</div></div>
    </div>

    ${s.n === 0 ? `<div class="note warn">Nothing has been evaluated for this test yet. Sheets are
      scored as candidates submit them, and ranks are assigned when you publish the result from the
      <a href="#/test/${testId}">test page</a>.</div>`
    : !anyRanked ? `<div class="note warn">Scores are in, but ranks have not been assigned yet. Use
      <strong>Evaluate &amp; Publish Result</strong> on the <a href="#/test/${testId}">test page</a>.</div>` : ''}

    <div class="card">
      <div class="card-head"><h2>Merit list — ${e(d.test.name)} ${pill(d.test.status)}</h2></div>
      ${d.results.length ? `<div class="table-scroll"><table>
        <thead><tr><th class="num">Rank</th><th>Roll No</th><th>Name</th>
          <th class="num">Correct</th><th class="num">Wrong</th><th class="num">Blank</th>
          <th class="num">Score</th><th class="num">%</th><th class="num">Percentile</th>
          <th>Submitted</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
      : `<div class="note info">${search ? 'No candidate matches that search.' : 'No results yet.'}</div>`}
    </div>

    ${d.waiting.length ? `<div class="card">
      <div class="card-head"><h2>Not yet submitted (${d.waiting.length})</h2></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Roll No</th><th>Name</th><th>Mobile</th><th>State</th><th>Opened</th><th></th></tr></thead>
        <tbody>${waitRows}</tbody></table></div>
    </div>` : ''}`;

  wireResultPicker();

  for (const btn of view.querySelectorAll('[data-reopen]')) {
    btn.addEventListener('click', async () => {
      if (!confirm('Reopen this sheet? Their result is removed until they submit again.')) return;
      const r = await act('/admin/reopen', { test_id: Number(testId), candidate_id: Number(btn.dataset.reopen) });
      if (r.ok) route();
    });
  }
  for (const btn of view.querySelectorAll('[data-unallot]')) {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this candidate from the test? Anything they have filled is deleted.')) return;
      const r = await act('/admin/unallot', { test_id: Number(testId), candidate_id: Number(btn.dataset.unallot) });
      if (r.ok) route();
    });
  }
}

function wireResultPicker() {
  const form = document.getElementById('pickForm');
  if (!form) return;
  const go = () => {
    const t = document.getElementById('r_test').value;
    const qv = document.getElementById('r_q')?.value.trim() ?? '';
    window.location.hash = '#/results' + (t ? `?test=${t}${qv ? '&q=' + encodeURIComponent(qv) : ''}` : '');
    route();
  };
  form.addEventListener('submit', (ev) => { ev.preventDefault(); go(); });
  document.getElementById('r_test').addEventListener('change', go);
}

/* =====================================================================
   Routing
   =================================================================== */

function route() {
  const raw = window.location.hash.replace(/^#/, '') || '/dashboard';
  const [path, queryString] = raw.split('?');
  const params = new URLSearchParams(queryString ?? '');

  for (const a of document.querySelectorAll('#nav a')) {
    a.classList.toggle('on', a.getAttribute('href').startsWith('#' + path.split('/').slice(0, 2).join('/')));
  }
  notice(msg, '', '');

  const testMatch = path.match(/^\/test\/(.+)$/);
  if (testMatch) return viewTest(testMatch[1]);
  if (path.startsWith('/tests')) return viewTests();
  if (path.startsWith('/candidates')) return viewCandidates(params);
  if (path.startsWith('/results')) return viewResults(params);
  return viewDashboard();
}

window.addEventListener('hashchange', route);

(async () => {
  const d = await api('/me');
  if (!d.signed_in || d.kind !== 'staff') { window.location.href = '/'; return; }
  me = d;
  document.getElementById('who').innerHTML =
    `<strong>${e(d.name)}</strong> <span style="opacity:.75">(${e(d.role)})</span><br>` +
    `<a href="/api/logout">Logout</a>`;
  route();
})();
