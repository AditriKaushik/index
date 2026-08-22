/* =====================================================================
   The candidate's own result: score, rank, sectional split and a
   question-by-question answer review.
   ===================================================================== */

import { api, e, when } from './common.js';

const body = document.getElementById('body');

function tiles(s) {
  return `
  <div class="tiles">
    <div class="tile hero">
      <div class="k">Score</div>
      <div class="v">${e(s.score)} <span style="font-size:15px;opacity:.75">/ ${e(s.max_score)}</span></div>
    </div>
    <div class="tile">
      <div class="k">Rank</div>
      <div class="v">${s.rank ?? '—'}
        <span style="font-size:14px;color:var(--muted)">of ${s.total_ranked}</span></div>
    </div>
    <div class="tile">
      <div class="k">Percentile</div>
      <div class="v">${s.percentile ?? '—'}</div>
    </div>
    <div class="tile good"><div class="k">Correct</div><div class="v">${s.correct}</div></div>
    <div class="tile bad"><div class="k">Wrong</div><div class="v">${s.wrong}</div></div>
    <div class="tile"><div class="k">Not attempted</div><div class="v">${s.unattempted}</div></div>
  </div>`;
}

function sectionTable(sections) {
  if (!sections.length) return '';
  const rows = sections.map((s) => `
    <tr>
      <td><strong>${e(s.name)}</strong> <span class="muted small">Q${s.from}&ndash;${s.to}</span></td>
      <td class="num" style="color:var(--good)">${s.correct}</td>
      <td class="num" style="color:var(--bad)">${s.wrong}</td>
      <td class="num">${s.unattempted}</td>
      <td class="num"><strong>${e(s.score)}</strong></td>
    </tr>`).join('');

  return `
  <div class="card">
    <div class="card-head"><h2>Sectional performance</h2></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Section</th><th class="num">Correct</th><th class="num">Wrong</th>
                 <th class="num">Blank</th><th class="num">Score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function review(d) {
  const starts = d.section_starts || {};
  const parts = [];

  for (const item of d.review) {
    if (starts[item.q]) {
      parts.push(`<div class="section-head">${e(starts[item.q])}</div>`);
    }

    const accepted = (item.key && item.key !== '*' && item.key !== '-')
      ? item.key.split(',').map((s) => s.trim()) : [];

    const rowCls = item.outcome === 'correct' ? 'q-correct'
      : item.outcome === 'wrong' ? 'q-wrong' : 'q-skip';

    const bubbles = d.letters.map((L) => {
      let cls = 'bub';
      if (item.mine === L && item.outcome === 'correct') cls += ' correct';
      else if (item.mine === L && item.outcome === 'wrong') cls += ' wrongpick';
      else if (accepted.includes(L)) cls += ' wasright';
      return `<span class="${cls}">${L}</span>`;
    }).join('');

    const tag = item.key === '*' ? '<span class="small" style="color:var(--good)">bonus</span>'
      : item.outcome === 'dropped' ? '<span class="small muted">dropped</span>' : '';

    parts.push(
      `<div class="qrow ${rowCls}"><div class="qnum">${item.q}</div>` +
      `<div class="bubbles">${bubbles}</div>${tag}</div>`
    );
  }

  return `
  <div class="card">
    <div class="card-head"><h2>Answer review</h2></div>
    <div class="legend" style="margin-bottom:14px">
      <span><i class="l-c"></i>Your correct answer</span>
      <span><i class="l-w"></i>Your wrong answer</span>
      <span><i class="l-r"></i>The right answer</span>
      <span><i class="l-s"></i>Not attempted</span>
    </div>
    <div class="sheet">${parts.join('')}</div>
  </div>`;
}

async function boot() {
  let d;
  try {
    d = await api('/result');
  } catch {
    body.innerHTML = '<div class="note err">Could not reach the server. Please reload the page.</div>';
    return;
  }

  if (d._status === 401) { window.location.href = '/'; return; }
  if (d.state === 'filling') { window.location.href = '/omr'; return; }
  if (!d.ok) {
    body.innerHTML = `<div class="note err">${e(d.error || 'Could not load your result.')}</div>`;
    return;
  }

  document.getElementById('testName').textContent = `${d.test.name} · ${d.test.code}`;
  document.getElementById('who').innerHTML =
    `<strong>${e(d.candidate.name)}</strong><br>Roll ${e(d.candidate.roll)} · <a href="/api/logout">Logout</a>`;

  if (d.state === 'submitted') {
    body.innerHTML = `
      <div class="card center">
        <h1 style="color:var(--good)">&#10003; Answer sheet submitted</h1>
        <p class="muted">Your OMR for <strong>${e(d.test.name)}</strong> has been recorded
          ${d.submitted_at ? 'on ' + e(when(d.submitted_at)) : ''}.</p>
        <div class="note info" style="text-align:left;margin-top:18px">
          Your score and rank will appear here once head office releases the result
          for this test. Log in again with the same roll number and mobile number to check.
        </div>
      </div>`;
    return;
  }

  body.innerHTML = tiles(d.score) + sectionTable(d.sections) + review(d) + `
    <div class="row no-print">
      <button type="button" class="btn ghost" onclick="window.print()">Print / Save as PDF</button>
      <a class="btn ghost" href="/api/logout">Logout</a>
    </div>`;
}

boot();
