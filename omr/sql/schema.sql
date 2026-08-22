-- =====================================================================
-- Mahendra's Online OMR Portal - database schema
-- MySQL 5.7+ / MariaDB 10.2+
--
-- Import with:  mysql -u USER -p DBNAME < sql/schema.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Staff / branch logins
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS branches;
CREATE TABLE branches (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(128) NOT NULL,
  role          ENUM('admin','branch') NOT NULL DEFAULT 'branch',
  status        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_branch_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Tests. Marking scheme lives here and can be overridden per section.
-- marks_wrong is stored as a NEGATIVE number, e.g. -0.25
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS tests;
CREATE TABLE tests (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(32)  NOT NULL,
  name             VARCHAR(191) NOT NULL,
  total_questions  SMALLINT UNSIGNED NOT NULL,
  option_count     TINYINT  UNSIGNED NOT NULL DEFAULT 4,
  marks_correct    DECIMAL(5,2) NOT NULL DEFAULT  1.00,
  marks_wrong      DECIMAL(5,2) NOT NULL DEFAULT -0.25,
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status           ENUM('draft','open','closed','published') NOT NULL DEFAULT 'draft',
  created_by       INT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_test_code (code),
  KEY idx_test_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Optional sections. NULL marks mean "inherit the test's scheme".
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sections;
CREATE TABLE sections (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  test_id       INT NOT NULL,
  name          VARCHAR(128) NOT NULL,
  q_from        SMALLINT UNSIGNED NOT NULL,
  q_to          SMALLINT UNSIGNED NOT NULL,
  marks_correct DECIMAL(5,2) NULL,
  marks_wrong   DECIMAL(5,2) NULL,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  KEY idx_section_test (test_id),
  CONSTRAINT fk_section_test FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Answer key.
--   correct_option = 'A'      single correct
--                  = 'A,C'    either accepted
--                  = '*'      bonus  - every candidate gets full marks
--                  = '-'      dropped - no marks, no penalty, for anyone
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS answer_keys;
CREATE TABLE answer_keys (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  test_id        INT NOT NULL,
  q_no           SMALLINT UNSIGNED NOT NULL,
  correct_option VARCHAR(16) NOT NULL,
  UNIQUE KEY uq_key (test_id, q_no),
  CONSTRAINT fk_key_test FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Candidates
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS candidates;
CREATE TABLE candidates (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  roll_no    VARCHAR(32)  NOT NULL,
  name       VARCHAR(191) NOT NULL,
  mobile     VARCHAR(15)  NOT NULL,
  branch_id  INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_roll (roll_no),
  KEY idx_mobile (mobile),
  KEY idx_cand_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Which candidate sat which test
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS test_candidates;
CREATE TABLE test_candidates (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  test_id      INT NOT NULL,
  candidate_id INT NOT NULL,
  status       ENUM('pending','in_progress','submitted') NOT NULL DEFAULT 'pending',
  started_at   DATETIME NULL,
  submitted_at DATETIME NULL,
  UNIQUE KEY uq_tc (test_id, candidate_id),
  KEY idx_tc_cand (candidate_id),
  CONSTRAINT fk_tc_test FOREIGN KEY (test_id)      REFERENCES tests(id)      ON DELETE CASCADE,
  CONSTRAINT fk_tc_cand FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- The filled OMR itself. One row per bubbled question.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS responses;
CREATE TABLE responses (
  test_id       INT NOT NULL,
  candidate_id  INT NOT NULL,
  q_no          SMALLINT UNSIGNED NOT NULL,
  marked_option CHAR(1) NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (test_id, candidate_id, q_no),
  CONSTRAINT fk_resp_test FOREIGN KEY (test_id)      REFERENCES tests(id)      ON DELETE CASCADE,
  CONSTRAINT fk_resp_cand FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Evaluated result + rank
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS results;
CREATE TABLE results (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  test_id      INT NOT NULL,
  candidate_id INT NOT NULL,
  attempted    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  correct      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  wrong        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  unattempted  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  score        DECIMAL(8,2) NOT NULL DEFAULT 0,
  max_score    DECIMAL(8,2) NOT NULL DEFAULT 0,
  percentage   DECIMAL(6,2) NOT NULL DEFAULT 0,
  rank_overall INT NULL,
  percentile   DECIMAL(6,2) NULL,
  submitted_at DATETIME NULL,
  evaluated_at DATETIME NULL,
  UNIQUE KEY uq_result (test_id, candidate_id),
  KEY idx_result_rank (test_id, score),
  CONSTRAINT fk_res_test FOREIGN KEY (test_id)      REFERENCES tests(id)      ON DELETE CASCADE,
  CONSTRAINT fk_res_cand FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Per-section breakdown of a result
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS section_results;
CREATE TABLE section_results (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  result_id   INT NOT NULL,
  section_id  INT NOT NULL,
  correct     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  wrong       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  unattempted SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  score       DECIMAL(8,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_sec_result (result_id, section_id),
  CONSTRAINT fk_sr_result  FOREIGN KEY (result_id)  REFERENCES results(id)  ON DELETE CASCADE,
  CONSTRAINT fk_sr_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Seed: one admin login.
-- Username: admin   Password: admin@123
-- CHANGE THIS IMMEDIATELY after your first login.
-- ---------------------------------------------------------------------
INSERT INTO branches (username, password_hash, name, role) VALUES
('admin', '$2y$12$fLi.9Msg9I1UU50Ai5bJtuIdudNpRJsr4j2zbrf6x4UlnPoH8jhTC', 'Head Office', 'admin');
