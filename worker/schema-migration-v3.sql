-- ============================================================
--  MIGRATION v3 — Multiple meals per day
--  Run in Cloudflare D1 console before deploying worker v3
--
--  This migration:
--  1. Removes the UNIQUE(user_id, date) constraint from entries
--     (SQLite cannot DROP constraints, so we recreate the table)
--  2. Adds meal_type and name columns
-- ============================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE entries_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calories   INTEGER NOT NULL,
  protein    REAL,
  carbs      REAL,
  fat        REAL,
  weight     REAL,
  notes      TEXT,
  meal_type  TEXT NOT NULL DEFAULT 'other',
  name       TEXT,
  date       TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Copy existing data, assign 'other' as meal_type for old entries
INSERT INTO entries_new (id, user_id, calories, protein, carbs, fat, weight, notes, meal_type, date, created_at)
SELECT id, user_id, calories, protein, carbs, fat, weight, notes, 'other', date, created_at
FROM entries;

DROP TABLE entries;

ALTER TABLE entries_new RENAME TO entries;

CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);

PRAGMA foreign_keys = ON;
