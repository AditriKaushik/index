import { buildTest, scoreAttempt, topicMastery, recommendations, sectionMarking } from './engine.js';
import { PLAN, accessStatus, recordTestStart, grantPass, canRequestSupport, grantSupportPass } from './access.js';
import * as store from './store.js';

const $app = document.getElementById('app');
let state = store.load();
if (!state.access.firstSeen) { state.access.firstSeen = Date.now(); store.save(state); }
let catalog = null;
const examCache = new Map();
let timerHandle = null;

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
const hi = () => state.prefs.lang === 'hi';
const t = (en, h) => (hi() && h ? h : en);
const fmtTime = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const pct = x => Math.round(x * 100) + '%';
const fmtDate = ms => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const LETTERS = 'ABCDEFGH';
const save = () => store.save(state);

const CATEGORIES = {
  engineering: ['Engineering', 'इंजीनियरिंग'], medical: ['Medical', 'मेडिकल'], university: ['University', 'विश्वविद्यालय'],
  ssc: ['SSC', 'एसएससी'], banking: ['Banking', 'बैंकिंग'], railway: ['Railways', 'रेलवे'], upsc: ['UPSC', 'यूपीएससी'],
  defence: ['Defence', 'रक्षा'], teaching: ['Teaching', 'शिक्षक'], management: ['MBA', 'एमबीए'], law: ['Law', 'लॉ'],
  state: ['State / Police', 'राज्य / पुलिस'], school: ['School', 'स्कूल'], postgraduate: ['PG / GATE', 'पीजी / गेट'],
};
const STATUS = {
  released: ['Notification out', 'अधिसूचना जारी', 'ok'], ongoing: ['Ongoing', 'जारी है', 'ok'], expected: ['Expected', 'अपेक्षित', 'warn'],
  closed: ['Applications closed', 'आवेदन बंद', 'muted'], 'result-out': ['Result out', 'परिणाम जारी', 'muted'],
};
const statusBadge = n => { const s = STATUS[n?.status] || [n?.status || '—', '', 'muted']; return `<span class="badge ${s[2]}">${esc(t(s[0], s[1]))}</span>`; };

async function getCatalog() {
  if (!catalog) catalog = await (await fetch('data/catalog.json')).json();
  return catalog;
}
async function getExam(id) {
  if (!examCache.has(id)) {
    const r = await fetch(`data/exams/${encodeURIComponent(id)}.json`);
    if (!r.ok) throw new Error('Exam not found');
    examCache.set(id, await r.json());
  }
  return examCache.get(id);
}
const attemptsFor = id => state.attempts.filter(a => a.examId === id && a.result);
const seenIds = id => attemptsFor(id).flatMap(a => a.questionIds || []);

// ---------- layout ----------
function shell(html, active = '') {
  const acc = accessStatus(state.access);
  const accText = acc.reason === 'trial' ? t('Free day: unlimited tests', 'फ़्री दिन: असीमित टेस्ट')
    : acc.reason === 'pass' ? t(`Pass active till ${fmtDate(acc.until)}`, `पास ${fmtDate(acc.until)} तक`)
    : acc.reason === 'daily-free' ? t(`${acc.freeLeft} free test left today`, `आज ${acc.freeLeft} फ़्री टेस्ट बाकी`)
    : t('Today’s free test used', 'आज का फ़्री टेस्ट हो गया');
  $app.innerHTML = `
  <header class="top">
    <a href="#/" class="brand">📝 <b>Mock</b>Pariksha</a>
    <nav>
      <a href="#/" class="${active === 'home' ? 'on' : ''}">${t('Exams', 'परीक्षाएँ')}</a>
      <a href="#/notifications" class="${active === 'notif' ? 'on' : ''}">${t('Notifications', 'सूचनाएँ')}</a>
      <a href="#/progress" class="${active === 'progress' ? 'on' : ''}">${t('My progress', 'मेरी प्रगति')}</a>
      <a href="#/plans" class="${active === 'plans' ? 'on' : ''}">${t('Plans', 'प्लान')}</a>
    </nav>
    <button class="lang" id="lang">${hi() ? 'English' : 'हिंदी'}</button>
  </header>
  <a class="access ${acc.allowed ? '' : 'blocked'}" href="#/plans">${esc(accText)}</a>
  <main>${html}</main>
  <footer>${t('Practice questions are original, modelled on the last 3 years’ papers. Always confirm dates on the official website.', 'अभ्यास प्रश्न मौलिक हैं, पिछले 3 वर्षों के पेपर के आधार पर बनाए गए हैं। तारीखें हमेशा आधिकारिक वेबसाइट पर जाँचें।')}</footer>`;
  document.getElementById('lang').onclick = () => { state.prefs.lang = hi() ? 'en' : 'hi'; save(); route(); };
}

// ---------- home ----------
async function viewHome(params) {
  const cat = await getCatalog();
  const q = (params.get('q') || '').toLowerCase();
  const c = params.get('c') || '';
  const list = cat.exams.filter(e => (!c || e.category === c) && (!q || `${e.name} ${e.fullName} ${e.nameHi} ${e.conductingBody}`.toLowerCase().includes(q)));
  const cats = [...new Set(cat.exams.map(e => e.category))];
  const resume = state.inProgress;
  shell(`
    ${resume ? `<div class="card resume">${t('You have an unfinished test.', 'आपका एक टेस्ट अधूरा है।')} <a class="btn" href="#/test">${t('Resume', 'जारी रखें')}</a></div>` : ''}
    <section class="hero">
      <h1>${t('Free mock tests for every big exam in India', 'भारत की हर बड़ी परीक्षा के लिए मॉक टेस्ट')}</h1>
      <p>${t('Papers are built automatically from 3-year trend analysis. Get a detailed result, find weak topics, and practise exactly those.', 'पिछले 3 साल के विश्लेषण से अपने-आप पेपर बनता है। विस्तृत रिज़ल्ट देखें, कमज़ोर टॉपिक पहचानें और उन्हीं का अभ्यास करें।')}</p>
      <form id="search"><input name="q" value="${esc(q)}" placeholder="${t('Search: SSC CGL, NEET, IBPS PO…', 'खोजें: SSC CGL, NEET, IBPS PO…')}" aria-label="Search exams"></form>
    </section>
    <div class="chips">
      <a href="#/" class="chip ${!c ? 'on' : ''}">${t('All', 'सभी')} (${cat.exams.length})</a>
      ${cats.map(k => `<a href="#/?c=${k}" class="chip ${c === k ? 'on' : ''}">${esc(t(...(CATEGORIES[k] || [k])))}</a>`).join('')}
    </div>
    <div class="grid">
      ${list.map(e => `
        <a class="card exam" href="#/exam/${e.id}">
          <div class="row"><h3>${esc(e.name)}</h3>${statusBadge(e.notification)}</div>
          <div class="sub">${esc(hi() && e.nameHi ? e.nameHi : e.fullName)}</div>
          <div class="meta">${esc(e.conductingBody)} · ${esc(e.stage || '')}</div>
          <div class="meta">${e.questionCount} ${t('practice questions', 'अभ्यास प्रश्न')} · ${t('relevance', 'प्रासंगिकता')} ${e.quality.relevance}%${e.hasHindi ? ' · हिंदी' : ''}</div>
        </a>`).join('') || `<p>${t('No exam found.', 'कोई परीक्षा नहीं मिली।')}</p>`}
    </div>`, 'home');
  document.getElementById('search').onsubmit = ev => { ev.preventDefault(); location.hash = `#/?q=${encodeURIComponent(new FormData(ev.target).get('q'))}${c ? '&c=' + c : ''}`; };
}

// ---------- notifications ----------
async function viewNotifications() {
  const cat = await getCatalog();
  const rank = { released: 0, ongoing: 1, expected: 2, closed: 3, 'result-out': 4 };
  const list = cat.exams.slice().sort((a, b) => (rank[a.notification?.status] ?? 9) - (rank[b.notification?.status] ?? 9) || a.name.localeCompare(b.name));
  shell(`
    <h1>${t('Exam notifications', 'परीक्षा सूचनाएँ')}</h1>
    <p class="muted">${t('Status as last checked by our research. Click “Official” to confirm on the conducting body’s website.', 'हमारी रिसर्च के अनुसार स्थिति। पुष्टि के लिए “Official” पर क्लिक करें।')}</p>
    <div class="notif">
      ${list.map(e => `
        <div class="card">
          <div class="row"><a href="#/exam/${e.id}"><h3>${esc(e.name)}</h3></a>${statusBadge(e.notification)}</div>
          <p>${esc(e.notification?.summary)}</p>
          ${(e.notification?.importantDates || []).length ? `<ul class="dates">${e.notification.importantDates.map(d => `<li><span>${esc(d.event)}</span><b>${esc(d.date)}</b></li>`).join('')}</ul>` : ''}
          <div class="meta">${t('Checked on', 'जाँच तिथि')} ${esc(e.notification?.checkedOn)}
            ${safeUrl(e.notification?.source) ? ` · <a href="${safeUrl(e.notification.source)}" target="_blank" rel="noopener">${t('Source', 'स्रोत')}</a>` : ''}
            ${safeUrl(e.officialSite) ? ` · <a href="${safeUrl(e.officialSite)}" target="_blank" rel="noopener">Official</a>` : ''}</div>
        </div>`).join('')}
    </div>`, 'notif');
}

// ---------- exam detail ----------
async function viewExam(id) {
  const e = await getExam(id);
  const atts = attemptsFor(id);
  const mastery = topicMastery(e, atts.map(a => a.result));
  const secs = e.pattern.sections;
  const topicsBySec = s => e.trendAnalysis.topics.filter(x => x.section === s.id);
  const bank = s => e.questions.filter(q => q.section === s.id).length;
  const n = e.questions.length;
  const verified = n ? Math.round(100 * e.questions.filter(q => q.verified).length / n) : 0;
  const keys = new Set(e.trendAnalysis.topics.map(x => `${x.section}|${x.topic}`));
  const relevance = n ? Math.round(100 * e.questions.filter(q => keys.has(`${q.section}|${q.topic}`)).length / n) : 0;

  shell(`
    <a href="#/" class="back">← ${t('All exams', 'सभी परीक्षाएँ')}</a>
    <div class="row"><h1>${esc(e.name)}</h1>${statusBadge(e.notification)}</div>
    <p class="sub">${esc(e.fullName)}${e.nameHi ? ' · ' + esc(e.nameHi) : ''}</p>
    <div class="facts">
      <div><span>${t('Conducted by', 'आयोजक')}</span><b>${esc(e.conductingBody)}</b></div>
      <div><span>${t('Frequency', 'आवृत्ति')}</span><b>${esc(e.frequency)}</b></div>
      <div><span>${t('Candidates', 'उम्मीदवार')}</span><b>${esc(e.approxCandidates)}</b></div>
      <div><span>${t('Eligibility', 'योग्यता')}</span><b>${esc(e.eligibility)}</b></div>
    </div>

    <div class="card start">
      <h2>${t('Start practising', 'अभ्यास शुरू करें')}</h2>
      <div class="actions">
        <button class="btn big" data-kind="full">📄 ${t('Full mock test', 'फुल मॉक टेस्ट')}<small>${esc(e.pattern.stage || '')} · ${e.pattern.totalQuestions} Q · ${e.pattern.durationMinutes} min${n < e.pattern.totalQuestions ? ` · ${t('scaled to bank size', 'बैंक के अनुसार छोटा')}` : ''}</small></button>
        <button class="btn big alt" data-kind="weak">🎯 ${t('Practise weak topics', 'कमज़ोर टॉपिक का अभ्यास')}<small>${atts.length ? t('Built from your past results', 'आपके पिछले रिज़ल्ट से') : t('Starts with high-weightage topics', 'ज़्यादा वेटेज वाले टॉपिक से')}</small></button>
        <button class="btn big alt" id="openCustom">🛠️ ${t('Build my own test', 'अपना टेस्ट बनाएँ')}<small>${t('Pick sections, topics, difficulty', 'सेक्शन, टॉपिक, कठिनाई चुनें')}</small></button>
      </div>
      <form id="custom" class="custom" hidden>
        <fieldset><legend>${t('Sections', 'सेक्शन')}</legend>
          ${secs.map(s => `<label><input type="checkbox" name="sec" value="${esc(s.id)}" checked> ${esc(s.name)} <span class="muted">(${bank(s)})</span></label>`).join('')}
        </fieldset>
        <fieldset><legend>${t('Topics (optional)', 'टॉपिक (वैकल्पिक)')}</legend>
          <div class="topicpick">${secs.map(s => topicsBySec(s).map(x => `<label data-sec="${esc(s.id)}"><input type="checkbox" name="topic" value="${esc(x.topic)}"> ${esc(x.topic)}</label>`).join('')).join('')}</div>
        </fieldset>
        <div class="row wrap">
          <label>${t('Questions', 'प्रश्न')} <input type="number" name="count" min="5" max="${n}" value="${Math.min(20, n)}"></label>
          <label>${t('Difficulty', 'कठिनाई')} <select name="difficulty"><option value="mixed">${t('Mixed', 'मिश्रित')}</option><option value="easy">${t('Easy', 'आसान')}</option><option value="medium">${t('Medium', 'मध्यम')}</option><option value="hard">${t('Hard', 'कठिन')}</option></select></label>
          <button class="btn" type="submit">${t('Start test', 'टेस्ट शुरू करें')}</button>
        </div>
      </form>
      <p class="quality">✅ ${n} ${t('questions', 'प्रश्न')} · ${verified}% ${t('proof-read & verified', 'प्रूफ़-रीड व सत्यापित')} · ${relevance}% ${t('syllabus relevance', 'सिलेबस प्रासंगिकता')}</p>
    </div>

    ${atts.length ? `<div class="card"><h2>${t('Your topic mastery', 'आपकी टॉपिक पकड़')}</h2>${masteryBars(mastery.slice(0, 12))}
      <h3>${t('Past attempts', 'पिछले प्रयास')}</h3>${attemptTable(atts.slice().reverse(), e)}</div>` : ''}

    <div class="card"><h2>${t('Latest notification', 'नवीनतम सूचना')}</h2>
      <p>${esc(e.notification.summary)}</p>
      ${(e.notification.importantDates || []).length ? `<ul class="dates">${e.notification.importantDates.map(d => `<li><span>${esc(d.event)}</span><b>${esc(d.date)}</b></li>`).join('')}</ul>` : ''}
      <div class="meta">${t('Checked on', 'जाँच तिथि')} ${esc(e.notification.checkedOn)}${safeUrl(e.notification.source) ? ` · <a href="${safeUrl(e.notification.source)}" target="_blank" rel="noopener">${t('Source', 'स्रोत')}</a>` : ''}${safeUrl(e.officialSite) ? ` · <a href="${safeUrl(e.officialSite)}" target="_blank" rel="noopener">${t('Official website', 'आधिकारिक वेबसाइट')}</a>` : ''}</div>
    </div>

    <div class="card"><h2>${t('Exam pattern', 'परीक्षा पैटर्न')} — ${esc(e.pattern.stage || '')}</h2>
      <table><thead><tr><th>${t('Section', 'सेक्शन')}</th><th>${t('Questions', 'प्रश्न')}</th><th>${t('Marks', 'अंक')}</th><th>+/−</th></tr></thead><tbody>
      ${secs.map(s => { const m = sectionMarking(e, s.id); return `<tr><td>${esc(s.name)}</td><td>${s.questions ?? ''}</td><td>${s.marks ?? ''}</td><td>+${m.correct} / ${m.wrong}</td></tr>`; }).join('')}
      <tr class="total"><td>${t('Total', 'कुल')}</td><td>${e.pattern.totalQuestions}</td><td>${e.pattern.totalMarks}</td><td>${e.pattern.durationMinutes} min · ${esc(e.pattern.mode)}</td></tr></tbody></table>
      ${e.pattern.notes ? `<p class="muted">${esc(e.pattern.notes)}</p>` : ''}
    </div>

    <div class="card"><h2>${t('3-year trend analysis', '3 साल का ट्रेंड विश्लेषण')} (${esc((e.trendAnalysis.yearsAnalyzed || []).join(', '))})</h2>
      <p>${esc(e.trendAnalysis.summary)}</p>
      ${secs.map(s => `<h3>${esc(s.name)}</h3><div class="bars">${topicsBySec(s).slice().sort((a, b) => b.weightage - a.weightage).map(x => `
        <div class="bar"><span class="lbl">${esc(x.topic)} <i class="trend ${esc(x.trend)}">${x.trend === 'rising' ? '▲' : x.trend === 'falling' ? '▼' : '■'}</i></span><span class="track"><span style="width:${Math.min(100, x.weightage)}%"></span></span><span class="val">${x.weightage}%</span></div>`).join('')}</div>`).join('')}
    </div>

    <div class="card"><h2>${t('Previous papers & official resources', 'पिछले पेपर व आधिकारिक संसाधन')}</h2>
      <p>${e.resources.pyqAvailable ? t('Previous-year papers are officially available.', 'पिछले वर्ष के पेपर आधिकारिक रूप से उपलब्ध हैं।') : t('Official previous-year papers are not published.', 'आधिकारिक पिछले पेपर प्रकाशित नहीं होते।')}</p>
      <ul>
        ${safeUrl(e.resources.officialPYQ) ? `<li><a href="${safeUrl(e.resources.officialPYQ)}" target="_blank" rel="noopener">${t('Official previous papers / answer keys', 'आधिकारिक पिछले पेपर / उत्तर कुंजी')}</a></li>` : ''}
        ${safeUrl(e.resources.officialMock) ? `<li><a href="${safeUrl(e.resources.officialMock)}" target="_blank" rel="noopener">${t('Official mock test', 'आधिकारिक मॉक टेस्ट')}</a></li>` : ''}
      </ul>
      ${e.resources.notes ? `<p class="muted">${esc(e.resources.notes)}</p>` : ''}
    </div>`);

  $app.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => startTest(e, b.dataset.kind, b.dataset.kind === 'weak' ? { weakTopics: mastery, count: Math.min(20, n) } : {}));
  const form = document.getElementById('custom');
  document.getElementById('openCustom').onclick = () => { form.hidden = !form.hidden; };
  const syncTopics = () => {
    const on = new Set([...form.querySelectorAll('[name=sec]:checked')].map(i => i.value));
    form.querySelectorAll('.topicpick label').forEach(l => { l.hidden = !on.has(l.dataset.sec); if (l.hidden) l.querySelector('input').checked = false; });
  };
  form.querySelectorAll('[name=sec]').forEach(i => i.onchange = syncTopics);
  form.onsubmit = ev => {
    ev.preventDefault();
    const fd = new FormData(form);
    const sections = fd.getAll('sec');
    if (!sections.length) return alert(t('Pick at least one section.', 'कम से कम एक सेक्शन चुनें।'));
    startTest(e, 'custom', { sections, topics: fd.getAll('topic'), count: +fd.get('count') || 20, difficulty: fd.get('difficulty') });
  };
}

function masteryBars(list) {
  return `<div class="bars">${list.map(m => `<div class="bar"><span class="lbl">${esc(m.topic)}</span><span class="track ${m.score < 0.5 ? 'bad' : m.score < 0.75 ? 'mid' : 'good'}"><span style="width:${Math.round(m.score * 100)}%"></span></span><span class="val">${m.correct}/${m.seen}</span></div>`).join('')}</div>`;
}
function attemptTable(atts, exam) {
  const kind = { full: t('Full mock', 'फुल मॉक'), weak: t('Weak topics', 'कमज़ोर टॉपिक'), custom: t('Custom', 'कस्टम') };
  return `<table><thead><tr><th>${t('Date', 'तारीख')}</th>${exam ? '' : `<th>${t('Exam', 'परीक्षा')}</th>`}<th>${t('Type', 'प्रकार')}</th><th>${t('Score', 'स्कोर')}</th><th>${t('Accuracy', 'सटीकता')}</th><th></th></tr></thead><tbody>
    ${atts.map(a => `<tr><td>${fmtDate(a.finishedAt)}</td>${exam ? '' : `<td>${esc(a.examName)}</td>`}<td>${kind[a.kind] || a.kind}</td><td>${a.result.score}/${a.result.maxScore}</td><td>${pct(a.result.accuracy)}</td><td><a href="#/result/${a.id}">${t('View', 'देखें')}</a></td></tr>`).join('')}</tbody></table>`;
}

// ---------- starting a test ----------
function startTest(exam, kind, opts) {
  if (state.inProgress && !confirm(t('You have an unfinished test. Discard it and start a new one?', 'एक टेस्ट अधूरा है। उसे छोड़कर नया शुरू करें?'))) return;
  const acc = accessStatus(state.access);
  if (!acc.allowed) { location.hash = '#/plans?blocked=1'; return; }
  const test = buildTest(exam, kind, { ...opts, seenIds: seenIds(exam.id) });
  if (!test.questionIds.length) return alert(t('No questions available for this selection.', 'इस चयन के लिए प्रश्न उपलब्ध नहीं।'));
  state.access = recordTestStart(state.access);
  state.inProgress = { id: 'a' + Date.now().toString(36), examId: exam.id, examName: exam.name, ...test, current: 0, responses: {}, remaining: test.durationSec, startedAt: Date.now() };
  save();
  location.hash = '#/test';
}

// ---------- running a test ----------
async function viewTest() {
  const run = state.inProgress;
  if (!run) { location.hash = '#/'; return; }
  const exam = await getExam(run.examId);
  const byId = new Map(exam.questions.map(q => [q.id, q]));
  const qs = run.questionIds.map(id => byId.get(id)).filter(Boolean);
  const secName = id => exam.pattern.sections.find(s => s.id === id)?.name || id;
  let lastTick = Date.now();
  let showHi = hi() && qs.some(q => q.questionHi);

  const resp = id => (run.responses[id] ||= { answer: null, timeSec: 0, marked: false, visited: false });
  const draw = () => {
    const q = qs[run.current];
    const r = resp(q.id); r.visited = true;
    const text = showHi && q.questionHi ? q.questionHi : q.question;
    const opts = showHi && q.optionsHi ? q.optionsHi : q.options;
    const mk = sectionMarking(exam, q.section);
    const answered = qs.filter(x => run.responses[x.id]?.answer != null).length;
    $app.innerHTML = `
      <div class="testbar">
        <b>${esc(exam.name)}</b>
        <span class="timer" id="timer">${fmtTime(run.remaining)}</span>
        <button class="btn danger" id="submit">${t('Submit', 'सबमिट')}</button>
      </div>
      <div class="testwrap">
        <section class="qpane">
          <div class="qhead">
            <span>${t('Q', 'प्र')} ${run.current + 1}/${qs.length} · ${esc(secName(q.section))}</span>
            <span class="muted">+${mk.correct} / ${mk.wrong}</span>
            ${q.questionHi ? `<button class="link" id="qlang">${showHi ? 'English' : 'हिंदी'}</button>` : ''}
          </div>
          <div class="qtext">${esc(text).replace(/\n/g, '<br>')}</div>
          <div class="opts">${opts.map((o, i) => `<label class="opt ${r.answer === i ? 'sel' : ''}"><input type="radio" name="o" value="${i}" ${r.answer === i ? 'checked' : ''}><b>${LETTERS[i]}</b><span>${esc(o)}</span></label>`).join('')}</div>
          <div class="qnav">
            <button class="btn alt" id="prev" ${run.current === 0 ? 'disabled' : ''}>← ${t('Previous', 'पिछला')}</button>
            <button class="btn alt" id="clear">${t('Clear', 'हटाएँ')}</button>
            <button class="btn alt" id="mark">${r.marked ? t('Unmark', 'मार्क हटाएँ') : t('Mark for review', 'रिव्यू के लिए मार्क')}</button>
            <button class="btn" id="next">${run.current === qs.length - 1 ? t('Save', 'सेव') : t('Save & next →', 'सेव व आगे →')}</button>
          </div>
        </section>
        <aside class="palette">
          <div class="muted">${answered}/${qs.length} ${t('answered', 'उत्तर दिए')}</div>
          ${exam.pattern.sections.filter(s => qs.some(x => x.section === s.id)).map(s => `<div class="psec">${esc(s.name)}</div><div class="pgrid">${qs.map((x, i) => x.section !== s.id ? '' : (() => { const rr = run.responses[x.id]; const cls = rr?.marked ? 'marked' : rr?.answer != null ? 'done' : rr?.visited ? 'seen' : ''; return `<button class="pq ${cls} ${i === run.current ? 'cur' : ''}" data-i="${i}">${i + 1}</button>`; })()).join('')}</div>`).join('')}
          <div class="legend"><span class="pq done"></span>${t('Answered', 'उत्तरित')} <span class="pq marked"></span>${t('Marked', 'मार्क')} <span class="pq seen"></span>${t('Not answered', 'अनुत्तरित')}</div>
        </aside>
      </div>`;
    const go = i => { tick(); run.current = Math.max(0, Math.min(qs.length - 1, i)); save(); draw(); };
    $app.querySelectorAll('input[name=o]').forEach(inp => inp.onchange = () => { r.answer = +inp.value; save(); $app.querySelectorAll('.opt').forEach((l, i) => l.classList.toggle('sel', i === r.answer)); });
    document.getElementById('prev').onclick = () => go(run.current - 1);
    document.getElementById('next').onclick = () => go(run.current + 1);
    document.getElementById('clear').onclick = () => { r.answer = null; save(); draw(); };
    document.getElementById('mark').onclick = () => { r.marked = !r.marked; go(r.marked ? run.current + 1 : run.current); };
    document.getElementById('submit').onclick = () => {
      const left = qs.length - qs.filter(x => run.responses[x.id]?.answer != null).length;
      if (confirm(left ? t(`${left} questions unanswered. Submit anyway?`, `${left} प्रश्न अनुत्तरित हैं। फिर भी सबमिट करें?`) : t('Submit the test?', 'टेस्ट सबमिट करें?'))) finish();
    };
    const ql = document.getElementById('qlang'); if (ql) ql.onclick = () => { showHi = !showHi; draw(); };
    $app.querySelectorAll('.pq[data-i]').forEach(b => b.onclick = () => go(+b.dataset.i));
  };
  // time spent is charged to the question on screen
  const tick = () => {
    const now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now;
    if (!state.inProgress) return;
    resp(qs[run.current].id).timeSec += dt;
    run.remaining -= dt;
  };
  const finish = () => {
    clearInterval(timerHandle); tick();
    const result = scoreAttempt(exam, run, run.responses);
    const attempt = { id: run.id, examId: run.examId, examName: run.examName, kind: run.kind, scaled: run.scaled, questionIds: run.questionIds, responses: Object.fromEntries(Object.entries(run.responses).map(([k, v]) => [k, { answer: v.answer, timeSec: Math.round(v.timeSec) }])), result, finishedAt: Date.now() };
    state.attempts.push(attempt);
    state.inProgress = null; save();
    location.hash = `#/result/${attempt.id}`;
  };
  draw();
  clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    if (location.hash !== '#/test') { clearInterval(timerHandle); return; }
    tick();
    const el = document.getElementById('timer');
    if (el) { el.textContent = fmtTime(run.remaining); el.classList.toggle('low', run.remaining < 300); }
    if (run.remaining <= 0) { alert(t('Time is up! Submitting your test.', 'समय समाप्त! टेस्ट सबमिट हो रहा है।')); finish(); return; }
    if (Math.round(run.remaining) % 10 === 0) save();
  }, 1000);
}

// ---------- result & analysis ----------
async function viewResult(id) {
  const a = state.attempts.find(x => x.id === id);
  if (!a) { location.hash = '#/progress'; return; }
  const exam = await getExam(a.examId);
  const r = a.result;
  const all = attemptsFor(exam.id);
  const mastery = topicMastery(exam, all.map(x => x.result));
  const tips = recommendations(exam, r, mastery);
  const secName = sid => exam.pattern.sections.find(s => s.id === sid)?.name || sid;
  const byId = new Map(exam.questions.map(q => [q.id, q]));
  const prev = all.filter(x => x.finishedAt < a.finishedAt && x.kind === a.kind).at(-1);
  const delta = prev ? Math.round((r.score / (r.maxScore || 1) - prev.result.score / (prev.result.maxScore || 1)) * 100) : null;
  const weakTopics = r.topics.map(x => ({ ...x, acc: x.total ? x.correct / x.total : 0 })).sort((p, q) => p.acc - q.acc);

  shell(`
    <a href="#/exam/${exam.id}" class="back">← ${esc(exam.name)}</a>
    <h1>${t('Your result', 'आपका रिज़ल्ट')}</h1>
    <div class="scorecard">
      <div class="big">${r.score}<small>/ ${r.maxScore}</small></div>
      <div><span>${t('Correct', 'सही')}</span><b class="ok">${r.correct}</b></div>
      <div><span>${t('Wrong', 'ग़लत')}</span><b class="bad">${r.wrong}</b></div>
      <div><span>${t('Skipped', 'छोड़े')}</span><b>${r.skipped}</b></div>
      <div><span>${t('Accuracy', 'सटीकता')}</span><b>${pct(r.accuracy)}</b></div>
      <div><span>${t('Time', 'समय')}</span><b>${fmtTime(r.timeSec)}</b></div>
      ${delta !== null ? `<div><span>${t('vs last time', 'पिछली बार से')}</span><b class="${delta >= 0 ? 'ok' : 'bad'}">${delta >= 0 ? '+' : ''}${delta}%</b></div>` : ''}
    </div>
    ${a.scaled ? `<p class="muted">${t('This mock was scaled down to the current question bank while keeping the real section ratio.', 'यह मॉक मौजूदा प्रश्न बैंक के अनुसार छोटा किया गया, सेक्शन अनुपात वही रखा गया।')}</p>` : ''}

    <div class="card"><h2>${t('What to do next', 'आगे क्या करें')}</h2>
      <ul class="tips">${tips.map(x => `<li class="${x.kind}">${esc(x.text)}</li>`).join('')}</ul>
      <div class="actions">
        <button class="btn" id="weak">🎯 ${t('Practise my weak topics now', 'अभी कमज़ोर टॉपिक का अभ्यास')}</button>
        <button class="btn alt" id="again">📄 ${t('New full mock', 'नया फुल मॉक')}</button>
      </div>
    </div>

    <div class="card"><h2>${t('Section-wise', 'सेक्शन-वार')}</h2>
      <table><thead><tr><th>${t('Section', 'सेक्शन')}</th><th>${t('Score', 'स्कोर')}</th><th>✔</th><th>✘</th><th>—</th><th>${t('Accuracy', 'सटीकता')}</th><th>${t('Avg time', 'औसत समय')}</th></tr></thead><tbody>
      ${r.sections.map(s => `<tr><td>${esc(secName(s.section))}</td><td>${s.score}/${s.max}</td><td>${s.correct}</td><td>${s.wrong}</td><td>${s.skipped}</td><td>${s.correct + s.wrong ? pct(s.correct / (s.correct + s.wrong)) : '—'}</td><td>${Math.round(s.timeSec / s.total)}s</td></tr>`).join('')}</tbody></table>
    </div>

    <div class="card"><h2>${t('Topic-wise', 'टॉपिक-वार')}</h2>
      <div class="bars">${weakTopics.map(x => `<div class="bar"><span class="lbl">${esc(x.topic)}</span><span class="track ${x.acc < 0.5 ? 'bad' : x.acc < 0.75 ? 'mid' : 'good'}"><span style="width:${Math.round(x.acc * 100)}%"></span></span><span class="val">${x.correct}/${x.total}</span></div>`).join('')}</div>
    </div>

    <div class="card"><h2>${t('Solutions', 'हल')}</h2>
      <div class="filter"><label><input type="checkbox" id="onlyWrong"> ${t('Show only wrong / skipped', 'केवल ग़लत / छोड़े हुए दिखाएँ')}</label></div>
      <ol class="review">${r.items.map(it => { const q = byId.get(it.id); if (!q) return ''; return `
        <li class="${it.correct ? 'right' : it.answer == null ? 'skip' : 'wrong'}">
          <div class="qtext">${esc(q.question).replace(/\n/g, '<br>')}</div>
          <ul>${q.options.map((o, i) => `<li class="${i === q.answer ? 'ans' : ''} ${i === it.answer && !it.correct ? 'mine' : ''}"><b>${LETTERS[i]}</b> ${esc(o)}</li>`).join('')}</ul>
          <div class="expl"><b>${it.correct ? '✔ ' + t('Correct', 'सही') : it.answer == null ? '— ' + t('Not attempted', 'प्रयास नहीं') : '✘ ' + t('Wrong', 'ग़लत')}</b> · ${esc(q.topic)} · ${q.difficulty} · ${Math.round(it.timeSec)}s<br>${esc(q.explanation)}</div>
        </li>`; }).join('')}</ol>
    </div>`);

  document.getElementById('weak').onclick = () => startTest(exam, 'weak', { weakTopics: mastery, count: Math.min(20, exam.questions.length) });
  document.getElementById('again').onclick = () => startTest(exam, 'full', {});
  document.getElementById('onlyWrong').onchange = ev => $app.querySelectorAll('.review > li.right').forEach(li => { li.hidden = ev.target.checked; });
}

// ---------- progress ----------
function viewProgress() {
  const atts = state.attempts.filter(a => a.result).slice().reverse();
  shell(`
    <h1>${t('My progress', 'मेरी प्रगति')}</h1>
    ${atts.length ? `
      <div class="scorecard">
        <div><span>${t('Tests taken', 'दिए गए टेस्ट')}</span><b>${atts.length}</b></div>
        <div><span>${t('Questions solved', 'हल किए प्रश्न')}</span><b>${atts.reduce((s, a) => s + a.result.attempted, 0)}</b></div>
        <div><span>${t('Overall accuracy', 'कुल सटीकता')}</span><b>${pct(atts.reduce((s, a) => s + a.result.correct, 0) / Math.max(1, atts.reduce((s, a) => s + a.result.attempted, 0)))}</b></div>
      </div>
      <div class="card">${attemptTable(atts, null)}</div>`
    : `<p>${t('No tests yet. Pick an exam and take your first mock — today is free!', 'अभी कोई टेस्ट नहीं। कोई परीक्षा चुनें और पहला मॉक दें — आज फ़्री है!')}</p><a class="btn" href="#/">${t('Choose an exam', 'परीक्षा चुनें')}</a>`}
    <p class="muted">${t('Your progress is saved on this device only.', 'आपकी प्रगति केवल इसी डिवाइस पर सेव है।')}</p>`, 'progress');
}

// ---------- plans ----------
function viewPlans(params) {
  const acc = accessStatus(state.access);
  const blocked = params.get('blocked');
  shell(`
    <h1>${t('Plans', 'प्लान')}</h1>
    ${blocked ? `<div class="card warnbox">${t('You have used today’s free test. Come back tomorrow for another free test, or pick any option below.', 'आज का फ़्री टेस्ट हो गया। कल फिर फ़्री टेस्ट मिलेगा, या नीचे कोई विकल्प चुनें।')}</div>` : ''}
    <div class="plans">
      <div class="card plan"><h3>${t('Free', 'फ़्री')}</h3><div class="price">₹0</div>
        <ul><li>${t('First day: unlimited tests', 'पहला दिन: असीमित टेस्ट')}</li><li>${t(`Then ${PLAN.dailyFreeTests} free test every day, forever`, `फिर हर दिन ${PLAN.dailyFreeTests} फ़्री टेस्ट, हमेशा`)}</li><li>${t('Full result & analysis always free', 'पूरा रिज़ल्ट व विश्लेषण हमेशा फ़्री')}</li></ul></div>
      ${PLAN.passes.map(p => `<div class="card plan"><h3>${esc(t(p.label, p.labelHi))}</h3><div class="price">₹${p.price}</div>
        <ul><li>${t('Unlimited tests, all exams', 'सभी परीक्षाएँ, असीमित टेस्ट')}</li><li>≈ ₹${(p.price / p.days).toFixed(1)}/${t('day', 'दिन')}</li></ul>
        <button class="btn" data-pass="${p.id}">${t('Get pass', 'पास लें')}</button></div>`).join('')}
    </div>
    <div class="card"><h2>${t('Can’t pay right now?', 'अभी पैसे नहीं दे सकते?')}</h2>
      <p>${t(`Money should never stop you from preparing. Take a free ${PLAN.supportPassDays}-day pass — no questions asked (once a month).`, `पैसा आपकी तैयारी में रुकावट नहीं बनना चाहिए। ${PLAN.supportPassDays} दिन का फ़्री पास लें — कोई सवाल नहीं (महीने में एक बार)।`)}</p>
      <button class="btn alt" id="support" ${canRequestSupport(state.access) ? '' : 'disabled'}>${canRequestSupport(state.access) ? t('Get free support pass', 'फ़्री सहायता पास लें') : t('Already used this month', 'इस महीने ले चुके हैं')}</button>
    </div>
    <p class="muted">${t('Current status', 'वर्तमान स्थिति')}: ${acc.reason === 'trial' ? t('free first day', 'फ़्री पहला दिन') : acc.reason === 'pass' ? t('pass active till ', 'पास सक्रिय: ') + fmtDate(acc.until) : t(`${acc.freeLeft || 0} free test(s) left today`, `आज ${acc.freeLeft || 0} फ़्री टेस्ट बाकी`)}</p>`, 'plans');

  $app.querySelectorAll('[data-pass]').forEach(b => b.onclick = () => {
    alert(t('Online payment (UPI) is being set up and will be switched on soon. Until then, please use the free support pass.', 'ऑनलाइन पेमेंट (UPI) जल्द शुरू होगा। तब तक कृपया फ़्री सहायता पास लें।'));
  });
  const sb = document.getElementById('support');
  sb.onclick = () => {
    if (!canRequestSupport(state.access)) return;
    state.access = grantSupportPass(state.access); save();
    alert(t(`Done! You have a free ${PLAN.supportPassDays}-day pass. All the best!`, `हो गया! आपको ${PLAN.supportPassDays} दिन का फ़्री पास मिल गया। शुभकामनाएँ!`));
    route();
  };
}

// ---------- router ----------
async function route() {
  clearInterval(timerHandle);
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query || '');
  const parts = path.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  try {
    if (!parts.length) await viewHome(params);
    else if (parts[0] === 'notifications') await viewNotifications();
    else if (parts[0] === 'exam') await viewExam(decodeURIComponent(parts[1]));
    else if (parts[0] === 'test') await viewTest();
    else if (parts[0] === 'result') await viewResult(parts[1]);
    else if (parts[0] === 'progress') viewProgress();
    else if (parts[0] === 'plans') viewPlans(params);
    else location.hash = '#/';
  } catch (err) {
    shell(`<div class="card warnbox">${t('Something went wrong', 'कुछ गड़बड़ हुई')}: ${esc(err.message)}</div><a class="btn" href="#/">${t('Home', 'होम')}</a>`);
  }
}
window.addEventListener('hashchange', route);
route();
