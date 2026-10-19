// Content script: captures every text block the page shows while you scroll,
// runs the offline checks, asks Claude for a deep check on demand, highlights
// problems in the page and lists them in a floating panel.
(() => {
  'use strict';
  if (window.__prProofreader) { window.__prProofreader.show(); return; }

  const C = window.PRChecks;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME', 'OPTION']);
  const SKIP_SELECTOR = '#pr-host, .katex-mathml, mjx-assistive-mml, .MJX_Assistive_MathML, annotation, nav, footer, [role=navigation]';
  const INLINE = new Set(['inline', 'inline-block', 'inline-flex', 'contents', 'ruby', 'inline-grid']);
  const CATEGORY_LABEL = {
    calculation: 'Calculation', spelling: 'Spelling', grammar: 'Grammar', duplicate: 'Duplicate',
    'answer-key': 'Answer key', factual: 'Fact', question: 'Question issue', broken: 'Broken content',
  };
  const AI_CHUNK_CHARS = 6000;
  const AI_OVERLAP = 4;

  /** @type {Map<number, {id:number,text:string,norm:string,sh:Set<string>|null,el:WeakRef<Element>,aiChecked:boolean,current:boolean}>} */
  const blocks = new Map();
  const elInfo = new WeakMap(); // element -> { blockId, history: [blockId] }
  const byNorm = new Map(); // normalized text -> [blockId]
  const issues = [];
  const issueKeys = new Set();
  const watchedDocs = new WeakSet();
  let nextBlock = 1, nextIssue = 1;
  let filter = 'all', hideDone = false;
  let aiRunning = false, scrolling = false;
  let settings = { autoAi: false };
  chrome.storage.local.get({ autoAi: false }).then((s) => (settings = s));

  // ---------------------------------------------------------------- capture

  function blockOf(el, styleCache) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      let d = styleCache.get(cur);
      if (d === undefined) { d = getComputedStyle(cur).display; styleCache.set(cur, d); }
      if (!INLINE.has(d)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function isVisible(el) {
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function scanDoc(doc) {
    if (!doc || !doc.body) return [];
    watch(doc);
    const styleCache = new Map();
    const groups = new Map(); // block element -> [text pieces]
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName.toUpperCase()) || p.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      const b = blockOf(n.parentElement, styleCache);
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b).push(n.nodeValue);
    }
    // Editable content (admin / content-entry panels).
    for (const f of doc.querySelectorAll('textarea, input[type=text], input:not([type])')) {
      if (f.value && f.value.trim().length > 1 && !f.closest('#pr-host')) groups.set(f, [f.value]);
    }
    const touched = [];
    for (const [el, parts] of groups) {
      const text = parts.join('').replace(/\s+/g, ' ').trim();
      if (text.length < 2 || !isVisible(el)) continue;
      touched.push(record(el, text));
    }
    for (const img of doc.images) {
      if (img.complete && img.naturalWidth === 0 && img.src && isVisible(img)) {
        const b = record(img, `[image${img.alt ? ': ' + img.alt : ''}]`);
        addIssue({ blockId: b.id, source: 'auto', category: 'broken', severity: 'high', quote: '',
          suggestion: '', explanation: 'Image not loading — the question/figure may be unusable.' });
      }
    }
    for (const fr of doc.querySelectorAll('iframe')) {
      try { if (fr.contentDocument) touched.push(...scanDoc(fr.contentDocument)); } catch (_) { /* cross-origin */ }
    }
    return touched;
  }

  // Register what an element is showing now. Returns its block.
  function record(el, text) {
    const info = elInfo.get(el);
    if (info) {
      const b = blocks.get(info.blockId);
      if (b && b.text === text) { b.current = true; return b; }
      // Timers and counters ("Time left 09:58") change every second: update
      // the same block instead of piling up new ones.
      const digitless = (t) => t.replace(/\d+/g, '#');
      if (b && text.length < 80 && digitless(b.text) === digitless(text)) {
        b.text = text; b.norm = C.normalize(text); b.current = true;
        return b;
      }
      if (b) b.current = false;
    }
    const b = { id: nextBlock++, text, norm: C.normalize(text), sh: null, el: new WeakRef(el), aiChecked: false, current: true };
    blocks.set(b.id, b);
    const history = info ? info.history : [];
    history.push(b.id);
    elInfo.set(el, { blockId: b.id, history });
    if (el.tagName !== 'IMG') analyse(b, el, history);
    return b;
  }

  function analyse(b, el, history) {
    for (const i of C.checkText(b.text)) addIssue({ ...i, blockId: b.id, source: 'auto' });
    if (b.norm.length < 25) return;

    // Exact duplicates
    const same = byNorm.get(b.norm) || [];
    for (const otherId of same) {
      const o = blocks.get(otherId);
      const oel = o && o.el.deref();
      if (oel && oel !== el) {
        addIssue({ blockId: b.id, otherId, source: 'auto', category: 'duplicate', severity: 'high', quote: '',
          suggestion: '', explanation: `Same text appears twice on the page (also block #${otherId}).` });
        break;
      }
      if (oel === el) {
        const idx = history.indexOf(otherId);
        if (idx >= 0 && history.length - 1 - idx > 2) {
          addIssue({ blockId: b.id, otherId, source: 'auto', category: 'duplicate', severity: 'low', quote: '',
            suggestion: '', explanation: 'This text was already shown earlier at this spot — a repeated question, or you went back to it.' });
          break;
        }
      }
    }
    byNorm.set(b.norm, same.concat(b.id));
    if (same.length) return;

    // Near duplicates (same question re-typed with small changes)
    if (b.norm.length < 40) return;
    b.sh = C.shingles(b.norm);
    const words = b.norm.split(' ').length;
    for (const o of blocks.values()) {
      if (o === b || !o.sh) continue;
      const ow = o.norm.split(' ').length;
      if (Math.abs(ow - words) > Math.max(3, words * 0.3)) continue;
      const sim = C.jaccard(b.sh, o.sh);
      if (sim >= 0.6 && o.el.deref() !== el) {
        addIssue({ blockId: b.id, otherId: o.id, source: 'auto', category: 'duplicate', severity: 'medium', quote: '',
          suggestion: '', explanation: `Very similar to block #${o.id} (${Math.round(sim * 100)}% same) — possible duplicate question.` });
        break;
      }
    }
  }

  // Answer options: short sibling blocks under one parent (or grandparent)
  // that look like options — labelled (a)/A./1) or next to a radio button.
  const OPTION_LABEL = /^\s*(\(?[a-eA-E1-5]\)|[a-eA-E1-5][.)]|\([क-ङ]\)|[①-⑤])\s*/;
  function looksLikeOption(el, text) {
    if (OPTION_LABEL.test(text)) return true;
    const box = el.closest('label, li, [class*=option i], [class*=choice i], [class*=answer i]');
    return !!box || !!el.parentElement?.querySelector('input[type=radio], input[type=checkbox]');
  }
  function checkOptionGroups(touched) {
    const groups = new Map();
    for (const b of touched) {
      const el = b.el.deref();
      if (!el || b.text.length > 150 || !looksLikeOption(el, b.text)) continue;
      for (const anc of [el.parentElement, el.parentElement?.parentElement]) {
        if (!anc) continue;
        if (!groups.has(anc)) groups.set(anc, []);
        groups.get(anc).push(b);
      }
    }
    for (const list of groups.values()) {
      if (list.length < 3 || list.length > 8) continue;
      for (const i of C.checkOptions(list.map((b) => b.text))) {
        const b = list.find((x) => x.text.trim() === i.quote) || list[0];
        addIssue({ ...i, blockId: b.id, source: 'auto' });
      }
    }
  }

  // ---------------------------------------------------------------- issues

  function addIssue(i) {
    const key = `${i.blockId}|${i.category}|${(i.quote || '').toLowerCase()}`;
    if (issueKeys.has(key)) return;
    // AI and offline checks often find the same calculation/spelling slip.
    if (i.quote && issues.some((x) => x.blockId === i.blockId && x.quote && x.category === i.category &&
      (x.quote.includes(i.quote) || i.quote.includes(x.quote)))) return;
    issueKeys.add(key);
    issues.push({ uid: nextIssue++, done: false, ...i });
    scheduleRender();
  }

  // ---------------------------------------------------------------- highlight

  const rangeCache = new Map(); // issue uid -> Range

  function findRange(el, quote) {
    if (!quote) return null;
    const doc = el.ownerDocument;
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; let full = '';
    let n;
    while ((n = walker.nextNode())) { nodes.push([n, full.length]); full += n.nodeValue; }
    // Match ignoring whitespace differences: build a regex from the quote.
    const esc = quote.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    let m;
    try { m = new RegExp(esc).exec(full) || new RegExp(esc, 'i').exec(full); } catch (_) { return null; }
    if (!m) return null;
    const at = (pos) => {
      for (let k = nodes.length - 1; k >= 0; k--) if (nodes[k][1] <= pos) return [nodes[k][0], pos - nodes[k][1]];
      return null;
    };
    const s = at(m.index), e = at(m.index + m[0].length);
    if (!s || !e) return null;
    const r = doc.createRange();
    try { r.setStart(s[0], s[1]); r.setEnd(e[0], e[1]); } catch (_) { return null; }
    return r;
  }

  function issueElement(i) {
    const b = blocks.get(i.blockId);
    if (!b || !b.current) return null;
    const el = b.el.deref();
    return el && el.isConnected ? el : null;
  }

  function paintHighlights() {
    const perWin = new Map(); // window -> {high:[],medium:[],low:[]}
    const flagged = new Set();
    for (const i of issues) {
      const el = issueElement(i);
      if (!el) continue;
      const win = el.ownerDocument.defaultView;
      if (!win || !win.CSS || !win.CSS.highlights) continue;
      if (!perWin.has(win)) perWin.set(win, { high: [], medium: [], low: [] });
      if (i.done) continue;
      let r = rangeCache.get(i.uid);
      if (!r || r.collapsed || !el.contains(r.startContainer)) {
        r = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? null : findRange(el, i.quote);
        if (r) rangeCache.set(i.uid, r); else rangeCache.delete(i.uid);
      }
      if (r) perWin.get(win)[i.severity].push(r);
      else flagged.add([el, i.severity]);
    }
    for (const [win, sets] of perWin) {
      for (const sev of ['high', 'medium', 'low']) {
        if (sets[sev].length) win.CSS.highlights.set(`pr-${sev}`, new win.Highlight(...sets[sev]));
        else win.CSS.highlights.delete(`pr-${sev}`);
      }
    }
    for (const el of document.querySelectorAll('[data-pr-flag]')) el.removeAttribute('data-pr-flag');
    const rank = { high: 3, medium: 2, low: 1 };
    for (const [el, sev] of flagged) {
      const cur = el.getAttribute('data-pr-flag');
      if (!cur || rank[sev] > rank[cur]) el.setAttribute('data-pr-flag', sev);
    }
  }

  function clearHighlights() {
    const wins = new Set([window]);
    for (const b of blocks.values()) { const el = b.el.deref(); if (el) wins.add(el.ownerDocument.defaultView); }
    for (const w of wins) {
      try { for (const k of ['pr-high', 'pr-medium', 'pr-low', 'pr-focus']) w.CSS.highlights.delete(k); } catch (_) {}
      try { for (const el of w.document.querySelectorAll('[data-pr-flag]')) el.removeAttribute('data-pr-flag'); } catch (_) {}
    }
  }

  function focusIssue(i) {
    const el = issueElement(i);
    if (!el) { toast('यह content अभी page पर नहीं दिख रहा (शायद दूसरे question/page पर था)।'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.removeAttribute('data-pr-flash'); void el.offsetWidth; el.setAttribute('data-pr-flash', '');
    setTimeout(() => el.removeAttribute('data-pr-flash'), 1500);
    const r = rangeCache.get(i.uid);
    const win = el.ownerDocument.defaultView;
    if (r && win.CSS.highlights) {
      win.CSS.highlights.set('pr-focus', new win.Highlight(r));
      setTimeout(() => win.CSS.highlights.delete('pr-focus'), 1800);
    }
  }

  // ---------------------------------------------------------------- scanning loop

  let scanTimer = null;
  function scheduleScan(delay = 250) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, delay);
  }
  function runScan() {
    for (const b of blocks.values()) b.current = false;
    const touched = scanDoc(document);
    checkOptionGroups(touched);
    paintHighlights();
    scheduleRender();
  }

  function watch(doc) {
    if (watchedDocs.has(doc)) return;
    watchedDocs.add(doc);
    const mo = new MutationObserver((muts) => {
      if (muts.every((m) => host.contains(m.target) || m.attributeName === 'data-pr-flag' || m.attributeName === 'data-pr-flash')) return;
      scheduleScan(400);
    });
    mo.observe(doc.body, { childList: true, subtree: true, characterData: true });
    doc.addEventListener('scroll', () => scheduleScan(200), { capture: true, passive: true });
    doc.addEventListener('input', () => scheduleScan(800), { capture: true, passive: true });
    observers.push(mo);
  }
  const observers = [];

  // ---------------------------------------------------------------- auto-scroll

  function findScroller() {
    const se = document.scrollingElement || document.documentElement;
    if (se.scrollHeight > innerHeight + 40) return se;
    let best = null, area = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.scrollHeight <= el.clientHeight + 40 || el.clientHeight < 150) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      const a = el.clientWidth * el.clientHeight;
      if (a > area) { area = a; best = el; }
    }
    return best || se;
  }

  async function autoScroll() {
    if (scrolling) { scrolling = false; return; }
    scrolling = true; render();
    const sc = findScroller();
    const isDoc = sc === document.scrollingElement || sc === document.documentElement;
    const view = () => (isDoc ? innerHeight : sc.clientHeight);
    sc.scrollTo({ top: 0 });
    await sleep(500);
    let stuck = 0;
    while (scrolling) {
      const before = sc.scrollTop;
      sc.scrollTo({ top: before + view() * 0.8, behavior: 'smooth' });
      await sleep(700);
      runScan();
      if (sc.scrollTop <= before + 2) { if (++stuck >= 3) break; await sleep(600); } else stuck = 0;
    }
    const finished = scrolling;
    scrolling = false; render();
    if (finished) {
      toast(`Scroll complete — ${blocks.size} text blocks read.`);
      if (settings.autoAi) aiCheck();
    }
  }

  // ---------------------------------------------------------------- AI check

  async function aiCheck() {
    if (aiRunning) return;
    const all = [...blocks.values()].filter((b) => b.el.deref()?.tagName !== 'IMG');
    const todo = all.filter((b) => !b.aiChecked);
    if (!todo.length) { toast('सब content पहले ही AI से check हो चुका है।'); return; }
    // Chunks of consecutive blocks; each chunk starts with a few earlier blocks
    // so a question split across a boundary still has its context.
    const chunks = [];
    let cur = [], size = 0;
    for (const b of todo) {
      if (size + b.text.length > AI_CHUNK_CHARS && cur.length) { chunks.push(cur); cur = []; size = 0; }
      if (!cur.length) {
        const pos = all.indexOf(b);
        cur.push(...all.slice(Math.max(0, pos - AI_OVERLAP), pos));
      }
      cur.push(b); size += b.text.length;
    }
    if (cur.length) chunks.push(cur);

    aiRunning = true;
    let done = 0, found = 0, failed = null;
    setStatus(`AI check: 0 / ${chunks.length} parts…`);
    render();
    const worker = async () => {
      while (chunks.length && !failed) {
        const chunk = chunks.shift();
        const payload = chunk.map((b) => ({ id: b.id, text: b.text.slice(0, 4000) }));
        const res = await chrome.runtime.sendMessage({ type: 'ai-check', blocks: payload }).catch((e) => ({ error: e.message }));
        if (res?.error) { failed = res.error; break; }
        for (const i of res.issues || []) {
          if (!blocks.has(i.block)) continue;
          addIssue({ blockId: i.block, source: 'ai', category: i.category, severity: i.severity,
            quote: i.quote, suggestion: i.suggestion, explanation: i.explanation });
          found++;
        }
        for (const b of chunk) b.aiChecked = true;
        setStatus(`AI check: ${++done} / ${done + chunks.length} parts… (${found} found)`);
      }
    };
    await Promise.all([worker(), worker()]);
    aiRunning = false;
    setStatus(failed ? `⚠ ${failed}` : `AI check complete — ${found} problem${found === 1 ? '' : 's'} found.`);
    paintHighlights();
    render();
  }

  // ---------------------------------------------------------------- export

  function rows() {
    return issues.map((i) => {
      const b = blocks.get(i.blockId);
      return {
        no: i.uid, status: i.done ? 'Fixed' : 'Open', severity: i.severity, category: CATEGORY_LABEL[i.category] || i.category,
        source: i.source === 'ai' ? 'AI' : 'Auto', found: i.quote || '', fix: i.suggestion || '',
        why: i.explanation || '', content: b ? b.text : '',
      };
    });
  }

  function exportCsv() {
    const r = rows();
    if (!r.length) return toast('अभी कोई problem नहीं मिली।');
    const head = ['No', 'Status', 'Severity', 'Type', 'Checked by', 'Found', 'Correction', 'Why', 'Full text', 'Page'];
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [head.map(q).join(',')].concat(r.map((x) =>
      [x.no, x.status, x.severity, x.category, x.source, x.found, x.fix, x.why, x.content, location.href].map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proofread-${location.hostname}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function copyReport() {
    const r = rows().filter((x) => x.status === 'Open');
    if (!r.length) return toast('Copy करने के लिए कोई open problem नहीं है।');
    const text = `Proofread report — ${location.href}\n\n` + r.map((x) =>
      `${x.no}. [${x.category} · ${x.severity}] ${x.found ? `"${x.found}"` : x.content.slice(0, 120)}` +
      (x.fix ? `\n   → ${x.fix}` : '') + `\n   ${x.why}`).join('\n\n');
    try { await navigator.clipboard.writeText(text); toast('Report copied ✓'); }
    catch (_) { toast('Copy नहीं हो सका — Export CSV use करें।'); }
  }

  // ---------------------------------------------------------------- panel UI

  const host = document.createElement('div');
  host.id = 'pr-host';
  host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; top:12px; right:12px;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
<style>
  :host { --bg:#ffffff; --fg:#1d2330; --muted:#667085; --line:#e4e7ec; --soft:#f5f6f8; --accent:#4f46e5; --accent-fg:#fff;
          --high:#d92d20; --medium:#dc6803; --low:#1570ef; --ok:#12b76a; }
  @media (prefers-color-scheme: dark) {
    :host { --bg:#151821; --fg:#e8eaf0; --muted:#98a2b3; --line:#2b3040; --soft:#1d2130; --accent:#818cf8; --accent-fg:#0b0d14;
            --high:#f97066; --medium:#fdb022; --low:#53b1fd; --ok:#32d583; }
  }
  * { box-sizing:border-box; }
  .panel { width:min(380px, calc(100vw - 24px)); max-height:min(78vh, 720px); display:flex; flex-direction:column;
           background:var(--bg); color:var(--fg); border:1px solid var(--line); border-radius:12px;
           box-shadow:0 12px 32px rgba(0,0,0,.22); font:13px/1.45 system-ui, "Noto Sans Devanagari", sans-serif; overflow:hidden; }
  .panel.min .body { display:none; }
  header { display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid var(--line); cursor:move; user-select:none; }
  header b { font-size:14px; flex:1; }
  .counts { display:flex; gap:6px; font-size:12px; }
  .counts span { padding:1px 7px; border-radius:99px; color:#fff; font-weight:600; }
  .icon { border:0; background:none; color:var(--muted); font-size:16px; cursor:pointer; padding:2px 4px; line-height:1; }
  .body { display:flex; flex-direction:column; min-height:0; }
  .tools { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:10px 12px 6px; }
  .tools button { padding:7px 6px; border:1px solid var(--line); background:var(--soft); color:var(--fg); border-radius:7px; cursor:pointer; font:inherit; font-weight:600; }
  .tools button.main { background:var(--accent); color:var(--accent-fg); border-color:transparent; }
  .tools button:disabled { opacity:.55; cursor:default; }
  .status { padding:0 12px 6px; color:var(--muted); font-size:12px; min-height:18px; }
  .filters { display:flex; flex-wrap:wrap; gap:5px; padding:0 12px 8px; }
  .filters button { border:1px solid var(--line); background:none; color:var(--fg); border-radius:99px; padding:2px 9px; font:inherit; font-size:12px; cursor:pointer; }
  .filters button.on { background:var(--fg); color:var(--bg); border-color:var(--fg); }
  .list { overflow:auto; border-top:1px solid var(--line); flex:1; }
  .empty { padding:22px 14px; color:var(--muted); text-align:center; }
  .item { padding:10px 12px; border-bottom:1px solid var(--line); border-left:4px solid var(--sev); cursor:pointer; }
  .item:hover { background:var(--soft); }
  .item.done { opacity:.5; }
  .item.done .found { text-decoration:line-through; }
  .meta { display:flex; gap:6px; align-items:center; font-size:11px; color:var(--muted); margin-bottom:3px; }
  .meta .cat { color:var(--sev); font-weight:700; text-transform:uppercase; letter-spacing:.02em; }
  .found { background:color-mix(in srgb, var(--sev) 18%, transparent); padding:0 3px; border-radius:3px; word-break:break-word; }
  .fix { color:var(--ok); font-weight:600; word-break:break-word; }
  .why { margin-top:3px; }
  .ctx { margin-top:3px; color:var(--muted); font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .acts { display:flex; gap:10px; margin-top:5px; }
  .acts button { border:0; background:none; color:var(--accent); font:inherit; font-size:12px; cursor:pointer; padding:0; font-weight:600; }
  .toast { position:absolute; left:12px; right:12px; top:calc(100% + 8px); background:var(--fg); color:var(--bg); padding:8px 10px; border-radius:8px;
           font:12.5px/1.4 system-ui, "Noto Sans Devanagari", sans-serif; opacity:0; pointer-events:none; transition:opacity .2s; }
  .toast.show { opacity:1; }
  label.hide { margin-left:auto; font-size:12px; color:var(--muted); display:flex; align-items:center; gap:4px; }
</style>
<div class="panel">
  <header>
    <b>Proofreader</b>
    <div class="counts"></div>
    <button class="icon" data-act="min" title="Minimise">–</button>
    <button class="icon" data-act="close" title="Close">×</button>
  </header>
  <div class="body">
    <div class="tools">
      <button data-act="scroll" class="main"></button>
      <button data-act="ai"></button>
      <button data-act="csv">⬇ Export CSV</button>
      <button data-act="copy">⧉ Copy report</button>
    </div>
    <div class="status"></div>
    <div class="filters"></div>
    <div class="list"></div>
  </div>
</div>
<div class="toast"></div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => shadow.querySelector(s);
  const panel = $('.panel');

  let statusText = '';
  function setStatus(t) { statusText = t; $('.status').textContent = t || defaultStatus(); }
  function defaultStatus() {
    return `${blocks.size} text blocks read · page को scroll करते रहें, नया content अपने-आप check होगा।`;
  }

  let toastTimer;
  function toast(t) {
    const el = $('.toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  const sevColor = (s) => `var(--${s})`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render() {
    const open = issues.filter((i) => !i.done);
    const c = { high: 0, medium: 0, low: 0 };
    for (const i of open) c[i.severity]++;
    $('.counts').innerHTML = ['high', 'medium', 'low'].filter((s) => c[s])
      .map((s) => `<span style="background:${sevColor(s)}" title="${s}">${c[s]}</span>`).join('') ||
      (issues.length ? '<span style="background:var(--ok)">✓</span>' : '');

    $('[data-act=scroll]').textContent = scrolling ? '■ Stop scrolling' : '⇣ Auto-scroll page';
    const pending = [...blocks.values()].filter((b) => !b.aiChecked && b.el.deref()?.tagName !== 'IMG').length;
    const ai = $('[data-act=ai]');
    ai.disabled = aiRunning;
    ai.textContent = aiRunning ? 'AI checking…' : `✦ AI deep check${pending ? ` (${pending})` : ''}`;
    if (!aiRunning && !statusText.startsWith('⚠') && !statusText.startsWith('AI check complete')) $('.status').textContent = defaultStatus();

    const cats = ['all', ...new Set(issues.map((i) => i.category))];
    $('.filters').innerHTML = cats.map((k) => {
      const n = k === 'all' ? open.length : open.filter((i) => i.category === k).length;
      return `<button data-filter="${k}" class="${filter === k ? 'on' : ''}">${k === 'all' ? 'All' : CATEGORY_LABEL[k] || k} ${n}</button>`;
    }).join('') + `<label class="hide"><input type="checkbox" data-act="hidedone" ${hideDone ? 'checked' : ''}>Hide fixed</label>`;

    const order = { high: 0, medium: 1, low: 2 };
    const shown = issues
      .filter((i) => (filter === 'all' || i.category === filter) && !(hideDone && i.done))
      .sort((a, b) => a.done - b.done || order[a.severity] - order[b.severity] || a.blockId - b.blockId);
    const list = $('.list');
    if (!shown.length) {
      list.innerHTML = `<div class="empty">${issues.length ? 'इस filter में कुछ नहीं।' :
        'अभी कोई problem नहीं मिली।<br>Page को ऊपर से नीचे scroll करें या <b>Auto-scroll</b> दबाएँ, फिर <b>AI deep check</b> चलाएँ।'}</div>`;
      return;
    }
    list.innerHTML = shown.map((i) => {
      const b = blocks.get(i.blockId);
      return `<div class="item ${i.done ? 'done' : ''}" data-uid="${i.uid}" style="--sev:${sevColor(i.severity)}">
        <div class="meta"><span class="cat">${esc(CATEGORY_LABEL[i.category] || i.category)}</span>
          <span>${i.severity}</span><span>· ${i.source === 'ai' ? 'AI' : 'Auto'}</span><span>· #${i.blockId}</span></div>
        ${i.quote ? `<div><span class="found">${esc(i.quote)}</span>${i.suggestion ? ` → <span class="fix">${esc(i.suggestion)}</span>` : ''}</div>` : ''}
        <div class="why">${esc(i.explanation || '')}</div>
        ${b ? `<div class="ctx" title="${esc(b.text.slice(0, 400))}">${esc(b.text.slice(0, 140))}</div>` : ''}
        <div class="acts"><button data-act="go">Show on page</button>
          ${i.suggestion ? '<button data-act="copyfix">Copy correction</button>' : ''}
          <button data-act="done">${i.done ? 'Re-open' : '✓ Mark fixed'}</button></div>
      </div>`;
    }).join('');
  }

  shadow.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-filter],.item');
    if (!t) return;
    if (t.dataset.filter) { filter = t.dataset.filter; render(); return; }
    const item = e.target.closest('.item');
    const issue = item && issues.find((i) => i.uid === +item.dataset.uid);
    switch (t.dataset.act) {
      case 'min': panel.classList.toggle('min'); break;
      case 'close': destroy(); break;
      case 'scroll': autoScroll(); break;
      case 'ai': aiCheck(); break;
      case 'csv': exportCsv(); break;
      case 'copy': copyReport(); break;
      case 'hidedone': hideDone = e.target.checked; render(); break;
      case 'done': issue.done = !issue.done; paintHighlights(); render(); break;
      case 'copyfix': navigator.clipboard.writeText(issue.suggestion).then(() => toast('Correction copied ✓'), () => toast(issue.suggestion)); break;
      default: if (issue) focusIssue(issue);
    }
  });

  // Drag the panel by its header.
  $('header').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = host.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev) => {
      host.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px';
      host.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px';
      host.style.right = 'auto';
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });

  function destroy() {
    scrolling = false;
    for (const mo of observers) mo.disconnect();
    clearTimeout(scanTimer);
    clearHighlights();
    host.remove();
    delete window.__prProofreader;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.__prProofreader = {
    show() { panel.classList.remove('min'); host.style.display = ''; },
    _debug: { blocks, issues, runScan, aiCheck },
  };
  runScan();
  render();
})();
