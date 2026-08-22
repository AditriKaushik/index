/* =====================================================================
   Sessions and password hashing.

   Netlify Functions are stateless, so there is no server-side session
   store. The session is a signed token in an httpOnly cookie: the payload
   is readable but cannot be altered without the signing secret.

   Passwords use scrypt from node:crypto - strong, and with no native
   dependency to install.
   ===================================================================== */

import crypto from 'node:crypto';

const COOKIE = 'omr_session';
const MAX_AGE = 60 * 60 * 3; // 3 hours, matching the PHP build

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is not set (needs at least 16 characters).');
  }
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/* ---------------- passwords ---------------- */

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  try {
    const salt = Buffer.from(parts[1], 'base64url');
    const expected = Buffer.from(parts[2], 'base64url');
    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ---------------- session token ---------------- */

export function signSession(payload) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySession(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [data, sig] = token.split('.', 2);
  if (!data || !sig) return null;

  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/* ---------------- cookies ---------------- */

export function readSession(request) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE) return verifySession(rest.join('='));
  }
  return null;
}

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Normalise an Indian mobile number to its last 10 digits. */
export function normaliseMobile(raw) {
  const digits = String(raw ?? '').replace(/\D+/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}
