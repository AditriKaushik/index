/* =====================================================================
   The database schema, and the code that applies it.

   The portal creates its own tables on first use, so there is no SQL to
   run by hand. Every statement is written to be safe to re-run.
   ===================================================================== */

import { hashPassword } from './auth.mjs';

/** The first head office login, created only when there are no logins at all. */
export const SEED_USERNAME = 'admin';
export const SEED_PASSWORD = 'admin@123';

const DDL = [
  `CREATE TABLE IF NOT EXISTS branches (
     id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     username      TEXT    NOT NULL UNIQUE,
     password_hash TEXT    NOT NULL,
     name          TEXT    NOT NULL,
     role          TEXT    NOT NULL DEFAULT 'branch' CHECK (role IN ('admin','branch')),
     active        BOOLEAN NOT NULL DEFAULT TRUE,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  // marks_wrong is stored NEGATIVE, e.g. -0.25
  `CREATE TABLE IF NOT EXISTS tests (
     id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     code             TEXT NOT NULL UNIQUE,
     name             TEXT NOT NULL,
     total_questions  SMALLINT NOT NULL CHECK (total_questions BETWEEN 1 AND 500),
     option_count     SMALLINT NOT NULL DEFAULT 4 CHECK (option_count BETWEEN 2 AND 5),
     marks_correct    NUMERIC(5,2) NOT NULL DEFAULT  1.00,
     marks_wrong      NUMERIC(5,2) NOT NULL DEFAULT -0.25,
     duration_minutes SMALLINT NOT NULL DEFAULT 0,
     status           TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','open','closed','published')),
     created_by       INTEGER REFERENCES branches(id) ON DELETE SET NULL,
     created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status)`,

  // NULL marks on a section mean "inherit from the test"
  `CREATE TABLE IF NOT EXISTS sections (
     id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     test_id       INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
     name          TEXT NOT NULL,
     q_from        SMALLINT NOT NULL,
     q_to          SMALLINT NOT NULL,
     marks_correct NUMERIC(5,2),
     marks_wrong   NUMERIC(5,2),
     sort_order    SMALLINT NOT NULL DEFAULT 0,
     CHECK (q_to >= q_from)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sections_test ON sections(test_id)`,

  //  'A' single correct   'A,C' either accepted
  //  '*' bonus            '-'   dropped
  `CREATE TABLE IF NOT EXISTS answer_keys (
     id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     test_id        INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
     q_no           SMALLINT NOT NULL,
     correct_option TEXT NOT NULL,
     UNIQUE (test_id, q_no)
   )`,

  `CREATE TABLE IF NOT EXISTS candidates (
     id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     roll_no    TEXT NOT NULL UNIQUE,
     name       TEXT NOT NULL,
     mobile     TEXT NOT NULL,
     branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_candidates_mobile ON candidates(mobile)`,

  `CREATE TABLE IF NOT EXISTS test_candidates (
     id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     test_id      INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
     candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
     status       TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','submitted')),
     started_at   TIMESTAMPTZ,
     submitted_at TIMESTAMPTZ,
     UNIQUE (test_id, candidate_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tc_candidate ON test_candidates(candidate_id)`,

  `CREATE TABLE IF NOT EXISTS responses (
     test_id       INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
     candidate_id  INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
     q_no          SMALLINT NOT NULL,
     marked_option TEXT,
     updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (test_id, candidate_id, q_no)
   )`,

  `CREATE TABLE IF NOT EXISTS results (
     id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     test_id      INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
     candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
     attempted    SMALLINT NOT NULL DEFAULT 0,
     correct      SMALLINT NOT NULL DEFAULT 0,
     wrong        SMALLINT NOT NULL DEFAULT 0,
     unattempted  SMALLINT NOT NULL DEFAULT 0,
     score        NUMERIC(8,2) NOT NULL DEFAULT 0,
     max_score    NUMERIC(8,2) NOT NULL DEFAULT 0,
     percentage   NUMERIC(6,2) NOT NULL DEFAULT 0,
     rank_overall INTEGER,
     percentile   NUMERIC(6,2),
     submitted_at TIMESTAMPTZ,
     evaluated_at TIMESTAMPTZ,
     UNIQUE (test_id, candidate_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_results_rank ON results(test_id, score DESC)`,

  `CREATE TABLE IF NOT EXISTS section_results (
     id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     result_id   INTEGER NOT NULL REFERENCES results(id)  ON DELETE CASCADE,
     section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
     correct     SMALLINT NOT NULL DEFAULT 0,
     wrong       SMALLINT NOT NULL DEFAULT 0,
     unattempted SMALLINT NOT NULL DEFAULT 0,
     score       NUMERIC(8,2) NOT NULL DEFAULT 0,
     UNIQUE (result_id, section_id)
   )`,
];

let applied = false;

/**
 * Create the tables if they are not there yet, and seed the first login.
 * Runs at most once per warm function instance, and is safe if two
 * instances race: every statement tolerates already existing.
 */
export async function ensureSchema(pool) {
  if (applied) return;

  const client = await pool.connect();
  try {
    for (const statement of DDL) {
      await client.query(statement);
    }

    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM branches');
    if (rows[0].n === 0) {
      // The hash is generated here rather than shipped in the repository,
      // so the stored hash is never a published value.
      await client.query(
        `INSERT INTO branches (username, password_hash, name, role)
         VALUES ($1,$2,$3,'admin') ON CONFLICT (username) DO NOTHING`,
        [SEED_USERNAME, hashPassword(SEED_PASSWORD), 'Head Office']
      );
    }

    applied = true;
  } finally {
    client.release();
  }
}

/** Whether the seeded login still has its published default password. */
export async function seedPasswordUnchanged(pool) {
  const { rows } = await pool.query(
    'SELECT password_hash FROM branches WHERE username = $1', [SEED_USERNAME]
  );
  if (!rows.length) return false;
  const { verifyPassword } = await import('./auth.mjs');
  return verifyPassword(SEED_PASSWORD, rows[0].password_hash);
}
