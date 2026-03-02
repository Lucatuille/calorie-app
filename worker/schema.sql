-- ============================================================
--  CALORIE APP — D1 Database Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  email            TEXT    NOT NULL UNIQUE,
  password         TEXT    NOT NULL,
  age              INTEGER,
  weight           REAL,
  height           REAL,
  gender           TEXT CHECK(gender IN ('male', 'female')),
  target_calories  INTEGER,
  created_at       TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calories   INTEGER NOT NULL,
  protein    REAL,
  carbs      REAL,
  fat        REAL,
  weight     REAL,
  notes      TEXT,
  date       TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);
