// Offline checks that run instantly on every captured text block.
// Pure functions, no DOM: loaded by the content script and by the Node tests.
(function (root) {
  'use strict';

  // Frequent English misspellings -> correct form. Kept small on purpose:
  // the AI check catches the long tail, these catch the common ones offline.
  const MISSPELLINGS = {
    abscence: 'absence', accomodate: 'accommodate', accomodation: 'accommodation',
    acheive: 'achieve', acheived: 'achieved', accross: 'across', adress: 'address',
    agressive: 'aggressive', allready: 'already', amung: 'among', apparant: 'apparent',
    appearence: 'appearance', arguement: 'argument', assesment: 'assessment',
    basicly: 'basically', begining: 'beginning', beleive: 'believe', belive: 'believe',
    buisness: 'business', calender: 'calendar', catagory: 'category', cieling: 'ceiling',
    collegue: 'colleague', comittee: 'committee', commited: 'committed',
    completly: 'completely', concious: 'conscious', correspondance: 'correspondence',
    curiousity: 'curiosity', decieve: 'deceive',
    definately: 'definitely', definitly: 'definitely', dependant: 'dependent',
    desparate: 'desperate', developement: 'development', diffrent: 'different',
    dilema: 'dilemma', dissapear: 'disappear', dissapoint: 'disappoint',
    embarass: 'embarrass', enviroment: 'environment', equiptment: 'equipment',
    exagerate: 'exaggerate', excercise: 'exercise', existance: 'existence',
    experiance: 'experience', explaination: 'explanation', facinate: 'fascinate',
    familar: 'familiar', finaly: 'finally', foriegn: 'foreign', fourty: 'forty',
    freind: 'friend', goverment: 'government', gaurd: 'guard', garantee: 'guarantee', grammer: 'grammar', harrass: 'harass',
    hieght: 'height', humourous: 'humorous', immediatly: 'immediately',
    independant: 'independent', intrest: 'interest', interupt: 'interrupt',
    knowlege: 'knowledge', liason: 'liaison', libary: 'library', lisence: 'licence',
    maintainance: 'maintenance', maintenence: 'maintenance', millenium: 'millennium',
    minature: 'miniature', mischievious: 'mischievous', mispell: 'misspell',
    neccessary: 'necessary', necesary: 'necessary', noticable: 'noticeable', occassion: 'occasion', occured: 'occurred',
    occurence: 'occurrence', ocurred: 'occurred', oppurtunity: 'opportunity',
    opportunty: 'opportunity', paralel: 'parallel', parliment: 'parliament',
    particulary: 'particularly', percentge: 'percentage', perseverence: 'perseverance',
    persue: 'pursue', posession: 'possession', possesion: 'possession',
    potatos: 'potatoes', preceed: 'precede', prefered: 'preferred',
    presense: 'presence', privelege: 'privilege',
    probaly: 'probably', profesional: 'professional', promiss: 'promise',
    pronounciation: 'pronunciation', publically: 'publicly', quater: 'quarter',
    questionaire: 'questionnaire', realy: 'really', recieve: 'receive',
    recieved: 'received', recomend: 'recommend', reccomend: 'recommend',
    refered: 'referred', relevent: 'relevant', religous: 'religious',
    remeber: 'remember', repitition: 'repetition', resistence: 'resistance',
    responsibilty: 'responsibility', rythm: 'rhythm', seige: 'siege',
    sentance: 'sentence', seperate: 'separate', seperately: 'separately',
    sieze: 'seize', similiar: 'similar', sincerly: 'sincerely', speach: 'speech',
    strenght: 'strength', succesful: 'successful', successfull: 'successful',
    suprise: 'surprise', tendancy: 'tendency', thier: 'their', threshhold: 'threshold',
    tommorow: 'tomorrow', tomorow: 'tomorrow', tounge: 'tongue', truely: 'truly',
    twelth: 'twelfth', tyrany: 'tyranny', untill: 'until', usefull: 'useful',
    vaccum: 'vacuum', vehical: 'vehicle', visable: 'visible', wether: 'whether',
    wierd: 'weird', wich: 'which', writting: 'writing', yeild: 'yield',
    // exam-paper specific
    anwser: 'answer', ansewr: 'answer', questoin: 'question', qustion: 'question',
    staement: 'statement', statment: 'statement', corect: 'correct', incorect: 'incorrect',
    folowing: 'following', follwing: 'following', foloowing: 'following',
    calculte: 'calculate', avarage: 'average', averege: 'average', 
    profitt: 'profit', discout: 'discount', simplyfy: 'simplify', simplfy: 'simplify',
    approximatly: 'approximately', approximetly: 'approximately', ratoi: 'ratio',
    triangel: 'triangle', rectange: 'rectangle', perimter: 'perimeter',
    circumferance: 'circumference', volumne: 'volume',
    synonyn: 'synonym', antonyn: 'antonym', antonymn: 'antonym', synonymn: 'synonym',
    sentense: 'sentence', paragragh: 'paragraph', passege: 'passage',
  };

  // Doubled words that are usually legitimate.
  const OK_REPEATS = new Set(['that', 'had', 'is', 'very', 'bye', 'no', 'so', 'ha', 'la', 'ok',
    'तक', 'धीरे', 'जल्दी', 'बार', 'कभी', 'साथ', 'घर', 'अलग', 'एक', 'दो', 'कौन', 'क्या', 'जहाँ', 'जैसे']);

  // Text that means the page did not render the content properly.
  const BROKEN_MARKERS = [
    [/�/, 'Garbled character (�) — encoding problem'],
    [/&(amp|lt|gt|nbsp|quot|#\d+);/, 'Raw HTML entity visible instead of the symbol'],
    [/\[object Object\]|\bundefined\b|\bNaN\b(?!\w)/, 'Programming placeholder shown (undefined / NaN / [object Object])'],
    [/\{\{[^}]*\}\}/, 'Unfilled template placeholder {{ }}'],
    [/lorem ipsum/i, 'Dummy "lorem ipsum" text'],
    [/\\(frac|sqrt|times|div|alpha|beta|theta|pi|le|ge|neq|cdot|text)\b|\^\{|_\{|\$\$/, 'Unrendered math/LaTeX code'],
    [/<\/?(p|br|div|span|sup|sub|img|b|i|strong)\b[^>]*>/i, 'Raw HTML tag visible in text'],
  ];

  const DEVANAGARI = /[ऀ-ॿ]/;

  function normalize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[​-‍﻿]/g, '')
      .replace(/^\s*(q(uestion)?\.?\s*(no\.?)?\s*\d+\s*[.):-]?|प्रश्न\s*\d+\s*[.):-]?|\(?[a-e1-5]\)|[a-e1-5][.)])\s*/i, '')
      .replace(/[^\p{L}\p{N}%]+/gu, ' ')
      .trim();
  }

  function shingles(norm, n = 3) {
    const w = norm.split(' ').filter(Boolean);
    const out = new Set();
    if (w.length < n) { out.add(w.join(' ')); return out; }
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
  }

  function jaccard(a, b) {
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const uni = a.size + b.size - inter;
    return uni ? inter / uni : 0;
  }

  // ---- arithmetic ----------------------------------------------------------

  function parseNum(s) {
    const t = String(s).replace(/,/g, '').replace(/[−–]/g, '-');
    if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
    return parseFloat(t);
  }

  function decimals(s) {
    const t = String(s).replace(/,/g, '');
    const i = t.indexOf('.');
    return i < 0 ? 0 : t.length - i - 1;
  }

  // Tiny recursive-descent evaluator: + - * / ^ and parentheses. No eval().
  function evaluate(expr) {
    const src = expr
      .replace(/[−–]/g, '-')
      .replace(/[×✕✖]/g, '*')
      .replace(/(\d|\))\s*[xX]\s*(?=[\d(])/g, '$1*')
      .replace(/÷/g, '/')
      .replace(/(\d),(?=\d{3}\b)/g, '$1');
    const toks = src.match(/\d*\.?\d+|[-+*/^()]/g);
    if (!toks || toks.join('') !== src.replace(/\s+/g, '')) return NaN;
    let i = 0;
    const peek = () => toks[i];
    const take = () => toks[i++];
    function primary() {
      const t = take();
      if (t === '(') { const v = sum(); if (take() !== ')') throw 0; return v; }
      if (t === '-') return -primary();
      if (t === '+') return primary();
      const v = parseFloat(t);
      if (Number.isNaN(v)) throw 0;
      return v;
    }
    function power() {
      const b = primary();
      if (peek() === '^') { take(); return Math.pow(b, power()); }
      return b;
    }
    function product() {
      let v = power();
      while (peek() === '*' || peek() === '/') {
        const op = take(); const r = power();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }
    function sum() {
      let v = product();
      while (peek() === '+' || peek() === '-') {
        const op = take(); const r = product();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    try {
      const v = sum();
      return i === toks.length ? v : NaN;
    } catch (_) { return NaN; }
  }

  function close(calc, statedStr, approx) {
    const stated = parseNum(statedStr);
    if (!Number.isFinite(calc) || Number.isNaN(stated)) return true; // can't judge
    if (approx) return Math.abs(calc - stated) <= Math.max(0.02 * Math.abs(calc), 0.5);
    const tol = 0.5 * Math.pow(10, -decimals(statedStr)) + 1e-9;
    return Math.abs(calc - stated) <= tol;
  }

  const fmt = (v) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(4)));

  function checkArithmetic(text) {
    const issues = [];
    const NUM = '\\d[\\d,]*(?:\\.\\d+)?';
    const OP = '[-+−–×xX*÷/^]';
    // "a op b op c = d"  (also ≈ for approximate)
    const exprRe = new RegExp(`((?:\\(?\\s*${NUM}\\s*\\)?\\s*${OP}\\s*)+\\(?\\s*${NUM}\\s*\\)?)\\s*(=|≈|≃)\\s*(-?${NUM})(?![\\d/:])`, 'g');
    let m;
    while ((m = exprRe.exec(text))) {
      const [whole, lhs, eq, rhs] = m;
      // Skip dates (12/05/2024), times and ratios.
      if (/^\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.test(lhs)) continue;
      if (!/[-+−–×xX*÷/^]/.test(lhs.replace(/^\s*-/, ''))) continue;
      const calc = evaluate(lhs.trim());
      const approx = eq !== '=' || /approx|लगभग|~/i.test(text.slice(Math.max(0, m.index - 25), m.index));
      if (!close(calc, rhs, approx)) {
        issues.push({
          category: 'calculation', severity: 'high', quote: whole.trim(),
          suggestion: `${lhs.trim()} = ${fmt(calc)}`,
          explanation: `Written result is ${rhs}, but ${lhs.trim()} actually equals ${fmt(calc)}.`,
        });
      }
    }
    // "x% of y = z" / "x% of y is z" / "y का x% = z"
    const pctRe = new RegExp(`(${NUM})\\s*%\\s*(?:of|का|की|के)\\s*(?:₹|rs\\.?\\s*)?(${NUM})\\s*(?:=|is|will be|है|होगा|होगी)\\s*(?:₹|rs\\.?\\s*)?(-?${NUM})(?![\\d%])`, 'gi');
    while ((m = pctRe.exec(text))) {
      const [whole, p, base, res] = m;
      const calc = parseNum(p) * parseNum(base) / 100;
      if (!close(calc, res, false)) {
        issues.push({
          category: 'calculation', severity: 'high', quote: whole.trim(),
          suggestion: `${p}% of ${base} = ${fmt(calc)}`,
          explanation: `${p}% of ${base} is ${fmt(calc)}, not ${res}.`,
        });
      }
    }
    return issues;
  }

  // ---- text checks ---------------------------------------------------------

  function checkText(text) {
    const issues = [];
    const add = (category, severity, quote, suggestion, explanation) =>
      issues.push({ category, severity, quote, suggestion, explanation });

    for (const [re, why] of BROKEN_MARKERS) {
      const m = text.match(re);
      if (m) add('broken', 'high', m[0], '', why);
    }

    // Repeated word: "the the", "का का"
    const rep = /(^|[^\p{L}\p{M}])((\p{L}[\p{L}\p{M}]*))\s+\2(?![\p{L}\p{M}])/giu;
    let m;
    while ((m = rep.exec(text))) {
      const w = m[2];
      if (OK_REPEATS.has(w.toLowerCase()) || w.length < 2 && !DEVANAGARI.test(w)) continue;
      add('spelling', 'medium', `${w} ${w}`, w, `Word "${w}" is repeated.`);
    }

    // Known misspellings
    const wordRe = /[A-Za-z]+/g;
    while ((m = wordRe.exec(text))) {
      const fix = MISSPELLINGS[m[0].toLowerCase()];
      if (fix) {
        const out = m[0][0] === m[0][0].toUpperCase() ? fix[0].toUpperCase() + fix.slice(1) : fix;
        add('spelling', 'medium', m[0], out, `"${m[0]}" is misspelt — should be "${out}".`);
      }
    }

    // Punctuation / spacing
    if ((m = text.match(/[\p{L}\p{N}]\s+[,;](?=\s|$)/u)))
      add('grammar', 'low', m[0], m[0].replace(/\s+/, ''), 'Extra space before comma/semicolon.');
    if ((m = text.match(/[a-zऀ-ॿ][,;](?=[A-Za-zऀ-ॿ])/)))
      add('grammar', 'low', text.substr(m.index, 4), '', 'Missing space after comma/semicolon.');
    if ((m = text.match(/([,;:!?])\1+|(?<!\.)\.\.(?!\.)/)))
      add('grammar', 'low', m[0], m[0][0], 'Repeated punctuation mark.');

    // Hindi-specific: doubled matra, "|" (pipe) used instead of danda "।"
    if ((m = text.match(/([ा-ौंँ])\1/)))
      add('spelling', 'medium', text.substr(Math.max(0, m.index - 2), 4), '', 'Matra/anusvara typed twice (Hindi).');
    if (DEVANAGARI.test(text) && (m = text.match(/[ऀ-ॿ]\s*\|(?!\|)/)))
      add('grammar', 'low', m[0], m[0].replace('|', '।'), 'Pipe "|" used instead of danda "।".');

    // Unbalanced brackets
    for (const [o, c] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      const no = text.split(o).length - 1, nc = text.split(c).length - 1;
      // "(a) ... (b)" option labels are balanced; "a) b) c)" style is not a problem.
      if (no !== nc && !(o === '(' && no === 0 && /(^|\s)[a-e1-5]\)/i.test(text)))
        add('grammar', 'low', o + c, '', `Unbalanced brackets: ${no} "${o}" vs ${nc} "${c}".`);
    }

    return issues.concat(checkArithmetic(text));
  }

  // A group of short sibling blocks (answer options). Flags duplicate / empty
  // options and contradictory "all/none of the above" setups.
  function checkOptions(options) {
    const issues = [];
    const seen = new Map();
    for (const o of options) {
      const n = normalize(o);
      if (!n) continue;
      if (seen.has(n)) {
        issues.push({ category: 'duplicate', severity: 'high', quote: o.trim(), suggestion: '',
          explanation: `Two options are the same: "${seen.get(n).trim()}" and "${o.trim()}".` });
      } else seen.set(n, o);
    }
    return issues;
  }

  const api = { normalize, shingles, jaccard, evaluate, checkArithmetic, checkText, checkOptions, MISSPELLINGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PRChecks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
