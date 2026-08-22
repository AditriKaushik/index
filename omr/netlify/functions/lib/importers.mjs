/* =====================================================================
   Parsers for the two things staff paste or upload: answer keys and
   candidate lists. Both are deliberately forgiving about formatting.
   ===================================================================== */

import { normaliseMobile } from './auth.mjs';

/**
 * Parse an answer key.
 *
 * Accepts a numbered list, one question per line:
 *     1 A          1,A          1. A          1: A          1 - A
 *     2 A,C        3 *          4 -
 * or a bare sequence of option letters for Q1 upwards:
 *     ABCDA BCDAB ...
 *
 * '*' marks a bonus question, '-' a dropped one.
 *
 * @returns {{key: Map<number,string>, errors: string[]}}
 */
export function parseAnswerKey(text, total, letters) {
  const key = new Map();
  const errors = [];
  const src = String(text ?? '').trim();

  if (src === '') return { key, errors: ['The answer key is empty.'] };

  const valid = new Set([...letters, '*', '-']);
  const lines = src.split(/\r\n|\r|\n/);

  const looksNumbered = lines.some((l) => /^\s*\d+\s*[\s,.:;)\-\t|]/.test(l));

  if (looksNumbered) {
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) return;

      const m = line.match(/^\s*(\d+)\s*[\s,.:;)\-\t|]+\s*(.+?)\s*$/);
      if (!m) {
        errors.push(`Line ${i + 1}: could not read "${line}".`);
        return;
      }

      const q = Number(m[1]);
      const optRaw = m[2].replace(/\s+/g, '').toUpperCase();

      if (q < 1 || q > total) {
        errors.push(`Line ${i + 1}: question ${q} is outside 1-${total}.`);
        return;
      }

      const clean = [];
      let bad = false;
      for (const p of optRaw.split(',')) {
        const opt = p.trim();
        if (opt === '' || !valid.has(opt)) { bad = true; break; }
        if (!clean.includes(opt)) clean.push(opt);
      }
      if (bad || clean.length === 0) {
        errors.push(`Line ${i + 1}: "${m[2]}" is not a valid option for Q${q}.`);
        return;
      }
      // '*' and '-' only make sense on their own.
      if (clean.length > 1 && (clean.includes('*') || clean.includes('-'))) {
        errors.push(`Line ${i + 1}: "*" and "-" cannot be combined with an option.`);
        return;
      }
      if (key.has(q)) errors.push(`Line ${i + 1}: question ${q} appears more than once.`);
      key.set(q, clean.join(','));
    });

    return { key, errors };
  }

  // Sequence mode: every option character in order, from Q1.
  const chars = src.replace(/[^A-Za-z*\-]/g, '').toUpperCase().split('');
  let q = 0;
  for (const ch of chars) {
    q++;
    if (q > total) {
      errors.push(`The sequence has more entries than the paper has questions (${total}).`);
      break;
    }
    if (!valid.has(ch)) {
      errors.push(`Q${q}: "${ch}" is not a valid option.`);
      continue;
    }
    key.set(q, ch);
  }

  return { key, errors };
}

/** Split one CSV line, honouring double quotes. */
function splitCsvLine(line) {
  if (line.includes('\t')) return line.split('\t');

  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Parse a candidate list: roll number, name, mobile.
 * Comma or tab separated, with or without a header row.
 *
 * @returns {{rows: Array<{roll_no:string,name:string,mobile:string}>, errors: string[]}}
 */
export function parseCandidateList(text) {
  const rows = [];
  const errors = [];
  const seen = new Set();

  const lines = String(text ?? '').trim().split(/\r\n|\r|\n/);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;

    const parts = splitCsvLine(line).map((s) => s.trim());

    // Skip an obvious header row.
    if (i === 0 && /^roll/i.test(parts[0] ?? '')) return;

    if (parts.length < 3) {
      errors.push(`Line ${i + 1}: needs roll number, name and mobile number.`);
      return;
    }

    const [roll, name] = parts;
    const mobile = normaliseMobile(parts[2]);

    if (roll === '') { errors.push(`Line ${i + 1}: roll number is blank.`); return; }
    if (name === '') { errors.push(`Line ${i + 1}: name is blank.`); return; }
    if (mobile.length !== 10) {
      errors.push(`Line ${i + 1}: "${parts[2]}" is not a 10-digit mobile number.`);
      return;
    }
    if (seen.has(roll)) {
      errors.push(`Line ${i + 1}: roll number ${roll} is repeated.`);
      return;
    }

    seen.add(roll);
    rows.push({ roll_no: roll, name, mobile });
  });

  if (rows.length === 0 && errors.length === 0) errors.push('No candidates found in the list.');

  return { rows, errors };
}
