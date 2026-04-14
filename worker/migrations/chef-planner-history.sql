-- ============================================================
--  Chef Caliro — planner_history (Fase 2e)
--
--  Guarda cada plan generado por Sonnet (day | week) para:
--  1. Evitar repetición plato-a-plato entre días.
--  2. Rotar proteína principal respecto a planes recientes.
--  3. Futura analytics ("tus 10 platos más planificados").
--
--  Idempotente — se puede ejecutar varias veces sin error.
-- ============================================================

CREATE TABLE IF NOT EXISTS planner_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  feature    TEXT    NOT NULL,   -- 'day' | 'week'
  date       TEXT    NOT NULL,   -- YYYY-MM-DD (fecha de generación)
  plan_json  TEXT    NOT NULL,   -- plan completo serializado
  created_at INTEGER NOT NULL    -- unix ms
);

CREATE INDEX IF NOT EXISTS idx_planner_history_user_feature_date
  ON planner_history (user_id, feature, date DESC);
