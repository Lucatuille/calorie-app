CREATE TABLE IF NOT EXISTS weight_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  date       TEXT    NOT NULL,
  weight_kg  REAL    NOT NULL,
  created_at TEXT    DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date
  ON weight_logs(user_id, date);
