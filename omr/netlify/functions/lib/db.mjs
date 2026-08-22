/* =====================================================================
   Postgres access.

   The connection string comes from whichever of these is set:
     NETLIFY_DATABASE_URL          set automatically by Netlify DB
     NETLIFY_DATABASE_URL_UNPOOLED same, direct connection
     DATABASE_URL                  set by hand, e.g. a Neon string

   so the app works whether the database was provisioned by Netlify or
   brought along by you.
   ===================================================================== */

import pg from 'pg';
import { ensureSchema } from './schema.mjs';

// NUMERIC columns arrive as strings by default. Parse them as numbers so the
// scoring engine never has to guess.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

let pool = null;
let ready = null;

export function connectionString() {
  return process.env.NETLIFY_DATABASE_URL
    || process.env.NETLIFY_DATABASE_URL_UNPOOLED
    || process.env.DATABASE_URL
    || null;
}

export function db() {
  if (pool) return pool;

  const cs = connectionString();
  if (!cs) {
    throw new Error('NO_DATABASE_URL');
  }

  pool = new pg.Pool({
    connectionString: cs,
    // A hosted Postgres requires TLS; a local one does not offer it.
    ssl: /localhost|127\.0\.0\.1/.test(cs) ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

/**
 * Every query goes through here, so the tables are created on the first
 * request this instance serves and never thought about again.
 */
async function pooled() {
  const p = db();
  if (!ready) {
    ready = ensureSchema(p).catch((err) => {
      ready = null;          // let the next request try again
      throw err;
    });
  }
  await ready;
  return p;
}

/** Run a query and return the rows. */
export async function q(text, params = []) {
  const p = await pooled();
  const res = await p.query(text, params);
  return res.rows;
}

/** Run a query and return the first row, or null. */
export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows.length ? rows[0] : null;
}

/** Run a query and return the first column of the first row. */
export async function scalar(text, params = []) {
  const row = await one(text, params);
  return row ? Object.values(row)[0] : null;
}

/** Run a set of statements inside a transaction. */
export async function tx(fn) {
  const p = await pooled();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
