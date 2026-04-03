CREATE TABLE IF NOT EXISTS upgrade_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  event      TEXT    NOT NULL,
  created_at TEXT    DEFAULT (datetime('now'))
);
