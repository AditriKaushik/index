#!/usr/bin/env node
// Render a Mahendra's Speed Test content module to the house-format PDF.
//   node scripts/build.mjs <content.js> [out.pdf]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
// **bold** -> <b>, _italic_ -> <i>, __underline__ -> <u>
const rich = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/__([^_]+)__/g, '<u>$1</u>')
  .replace(/(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/g, '<i>$1</i>');

const marks = { numeric: n => `(${n + 1})`, alpha: n => `(${'ABCDE'[n]})` };

// A trailing catch-all ("None of these") is allowed to wrap rather than forcing
// every option onto its own line — that is what the production papers do.
const CATCH_ALL = /^(None of these|No error|No improvement|No rearrangement required|इनमें से कोई नहीं|कोई सुधार नहीं)$/i;

function optClass(opts) {
  const sized = opts.filter((o, i) => !(i === opts.length - 1 && CATCH_ALL.test(String(o).trim())));
  const longest = Math.max(...sized.map(o => String(o).length));
  if (longest <= 9 && sized.length >= 3) return 'c3';   // (1) Ten  (2) Eleven  (3) Twelve
  if (longest <= 15) return 'c2';
  return 'c1';
}

function renderOpts(opts, style, klass) {
  if (!opts || !opts.length) return '';
  const mk = marks[style] || marks.numeric;
  const li = opts.map((o, i) => `<li><span class="on">${mk(i)}&nbsp;${rich(o)}</span></li>`).join('');
  return `<ul class="opts ${klass || optClass(opts)}">${li}</ul>`;
}

// one side (English or Hindi) of a question / directions block
function side(it, lang, style) {
  const isHi = lang === 'hi';
  const cls = isHi ? ' class="hi"' : '';
  const text = isHi ? it.hi : it.en;
  if (it.dir) {
    const label = it.range ?? '';
    return `<div class="dir"${cls}><span class="lbl">${esc(label)}</span>${rich(text || '')}</div>`;
  }
  const label = it.label ?? `Q.${it.n}`;
  const stem = it.stem ? `<p class="stem"${cls}>${rich(isHi ? (it.stemHi ?? it.stem) : it.stem)}</p>` : '';
  const fig = it.fig ? `<figure class="fig"><img src="${esc(it.fig)}"></figure>` : '';
  const passage = it.passage
    ? `<div class="passage"${cls}>${(isHi ? (it.passageHi ?? it.passage) : it.passage).map(p => `<p>${rich(p)}</p>`).join('')}</div>` : '';
  // both columns share the English arrangement so the two sides stay row-aligned
  const klass = it.o ? optClass(it.o) : null;
  const opts = renderOpts(isHi ? (it.oh ?? it.o) : it.o, style, klass);
  return `<div class="q"${cls}><span class="lbl">${esc(label)}</span><span class="qtext">${rich(text || '')}</span>`
       + `${stem}${fig}${passage}${opts}</div>`;
}

function renderSection(sec, style) {
  const banner = `<div class="banner"><span class="en">${esc(sec.name)}/</span><span class="hi">${esc(sec.hindi)}</span></div>`;
  if (sec.mode === 'flow') {
    const body = sec.items.map(it => side(it, 'en', style)).join('');
    return banner + `<div class="flow">${body}</div>`;
  }
  const rows = sec.items.map(it =>
    `<tr><td>${side(it, 'en', style)}</td><td>${side(it, 'hi', style)}</td></tr>`).join('');
  return banner + `<table class="par">${rows}</table>`;
}

function masthead(b, logo) {
  // logo.png is the emblem + "Mahendra's" lockup; only fall back to type when it is absent
  const mark = logo ? `<img src="${logo}">` : '<span class="wordmark">Mahendra&rsquo;s</span>';
  const sub = b.subtitle ? `<div class="sub">${esc(b.subtitle)}</div>` : '';
  const boxes = '<span class="rollbox">' + '<i></i>'.repeat(b.rollDigits ?? 9) + '</span>';
  return `<div class="masthead">
    <div class="lockup">${mark}<span class="st">SPEED TEST</span></div>
    <div class="code">${esc(b.exam)} ${esc(b.code)}</div>${sub}
  </div>
  <div class="info">
    <div>
      No. of Questions : ${b.questions} (Objective Type)<br>
      Total Marks : ${b.marks} &nbsp;&nbsp;&nbsp; Negative Marking : ${esc(b.negative)}<br>
      Details of Sections in Question Paper :<br>
      ${esc(b.sectionsLine)}<br>
      <span class="disc">* In case of any discrepancy only the English version of
      that question will be considered as final.</span>
    </div>
    <div>
      Date <span class="dots">..........................</span> &nbsp; Time : ${b.minutes} Minutes<br>
      Candidates Roll No. ${boxes}<br>
      Name of Candidate <span class="dots">........................................</span><br>
      Centre Code <span class="dots">.................</span>
    </div>
  </div>`;
}

export function buildHtml(paper, { logo } = {}) {
  const css = readFileSync(join(ROOT, 'assets', 'paper.css'), 'utf8');
  const style = paper.brand.optionStyle || 'numeric';
  const body = paper.sections.map(s => renderSection(s, style)).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(paper.brand.exam)} ${esc(paper.brand.code)}</title>
<style>${css}</style></head><body>
${masthead(paper.brand, logo)}
${body}
</body></html>`;
}

/* ---------------------------------------------------------------------------
   Running header + footer.
   Chromium lays `position:fixed` out once against the document viewport and
   repaints it per page without recomputing, so a footer 650pt down the page
   wraps to the top on page 2. The chrome is therefore stamped onto the
   rendered PDF here, which also makes odd/even mirroring straightforward.
   Coordinates are absolute points from the measured spec; pdf-lib's origin is
   bottom-left, so y is flipped via `Y(top)`.
--------------------------------------------------------------------------- */
const BAND = rgb(0.812, 0.818, 0.824);   // #CFD1D3
const BAR  = rgb(0.820, 0.826, 0.832);   // #D1D3D5
const INK  = rgb(0.137, 0.122, 0.125);   // #231F20

const WM_SIZE = 395;   // the emblem is drawn 395 x 395 pt, centred on the page

async function stampChrome(pdfBytes, paper, logoBytes, wmBytes) {
  // The watermark has to sit UNDER the text, and pdf-lib only ever appends to a page's
  // content stream. So build a fresh document: watermark first, then the rendered page
  // embedded on top of it, then the chrome on top of that.
  const src = await PDFDocument.load(pdfBytes);
  const doc = await PDFDocument.create();
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const helvBold  = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvObl   = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const logo = logoBytes ? await doc.embedPng(logoBytes) : null;
  const wm   = wmBytes   ? await doc.embedPng(wmBytes)   : null;

  const title = `${paper.brand.exam} ${paper.brand.code}`;
  const URL = 'www.mahendras.org';
  const embedded = await doc.embedPages(src.getPages());

  embedded.forEach((ep, i) => {
    const { width: W, height: H } = src.getPage(i).getSize();
    const page = doc.addPage([W, H]);

    if (wm) page.drawImage(wm, { x: (W - WM_SIZE) / 2, y: (H - WM_SIZE) / 2,
                                 width: WM_SIZE, height: WM_SIZE });
    page.drawPage(ep, { x: 0, y: 0, width: W, height: H });
    const Y = top => H - top;                 // measured-from-top -> pdf-lib y
    const odd = (i + 1) % 2 === 1;            // page 1 is odd

    /* ---- header: rule + grey tab + url, mirrored on even pages ---- */
    const urlW = helvObl.widthOfTextAtSize(URL, 9);
    if (odd) {
      page.drawRectangle({ x: 490, y: Y(90), width: 51, height: 11, color: BAR });
      page.drawRectangle({ x: 55, y: Y(85.5), width: 430, height: 2.4, color: INK });
      page.drawText(URL, { x: 543 - urlW, y: Y(88), size: 9, font: helvObl, color: INK });
    } else {
      page.drawRectangle({ x: 54, y: Y(90), width: 51, height: 11, color: BAR });
      page.drawRectangle({ x: 110, y: Y(85.5), width: 433, height: 2.4, color: INK });
      page.drawText(URL, { x: 55, y: Y(88), size: 9, font: helvObl, color: INK });
    }

    /* ---- footer: grey bar + centred title + chevron page number + wordmark ---- */
    const fy = Y(760);                        // band occupies y 740-760 from the top
    page.drawRectangle({ x: 175, y: fy, width: 326, height: 20, color: BAR });
    const tw = timesBold.widthOfTextAtSize(title, 12);
    page.drawText(title, { x: 175 + (326 - tw) / 2, y: fy + 5.5, size: 12, font: timesBold, color: INK });

    const num = String(i + 1);
    const nw = helvBold.widthOfTextAtSize(num, 10);
    const chevX = odd ? 491 : 55;
    page.drawRectangle({ x: chevX, y: fy, width: 50, height: 20, color: INK });
    page.drawText(num, { x: chevX + (50 - nw) / 2, y: fy + 6, size: 10, font: helvBold,
                         color: rgb(1, 1, 1) });

    // footer wordmark: the production files draw logo.png at 121 x 18 pt
    if (logo) {
      const lw = 18 * (logo.width / logo.height);
      page.drawImage(logo, { x: odd ? 55 : 543 - lw, y: fy + 1, width: lw, height: 18 });
    } else {
      page.drawText("Mahendra's", { x: odd ? 55 : 448, y: fy + 5.5, size: 13, font: timesBold, color: INK });
    }
  });
  return doc.save();
}

function findChrome() {
  const cands = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    process.env.CHROME_PATH, 'google-chrome', 'chromium', 'chromium-browser',
  ].filter(Boolean);
  for (const c of cands) if (c.startsWith('/') ? existsSync(c) : true) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch {}
  }
  throw new Error('No Chromium found. Set CHROME_PATH.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const src = resolve(process.argv[2] || join(ROOT, 'example', 'bank-st30.js'));
  const out = resolve(process.argv[3] || src.replace(/\.js$/, '.pdf'));
  const paper = (await import(pathToFileURL(src).href)).default;
  const logoPath = join(ROOT, 'assets', 'logo.png');
  const logo = existsSync(logoPath) ? pathToFileURL(logoPath).href : null;
  if (!logo) console.warn('! assets/logo.png missing — falling back to a type wordmark (proof only)');

  const html = buildHtml(paper, { logo });
  const tmp = out.replace(/\.pdf$/, '.html');
  writeFileSync(tmp, html);

  execFileSync(findChrome(), [
    '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
    `--print-to-pdf=${out}`, pathToFileURL(tmp).href,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const wmPath = join(ROOT, 'assets', 'watermark.png');
  const stamped = await stampChrome(readFileSync(out), paper,
                                    existsSync(logoPath) ? readFileSync(logoPath) : null,
                                    existsSync(wmPath) ? readFileSync(wmPath) : null);
  writeFileSync(out, stamped);

  const n = paper.sections.reduce((a, s) => a + s.items.filter(i => i.n).length, 0);
  console.log(`${out}  —  ${paper.sections.length} sections, ${n} questions`);
}
