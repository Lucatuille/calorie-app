-- ============================================================
--  Chef Caliro V1 — schema (Fase 0)
--
--  1. planner_usage: rate limit diario + semanal para los 3
--     modos del planificador (suggest / day / week).
--  2. users.dietary_preferences: JSON con dieta, alergias y
--     disgustos del usuario. Se inyecta como regla dura en los
--     prompts de Chef.
--
--  Idempotente — se puede ejecutar varias veces sin error.
-- ============================================================

-- Tabla de uso del planificador — una fila por (usuario, feature, día).
CREATE TABLE IF NOT EXISTS planner_usage (
  user_id INTEGER NOT NULL,
  feature TEXT    NOT NULL,   -- 'suggest' | 'day' | 'week'
  date    TEXT    NOT NULL,   -- YYYY-MM-DD
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, feature, date)
);

CREATE INDEX IF NOT EXISTS idx_planner_usage_user_date
  ON planner_usage (user_id, date);

-- Preferencias dietéticas del usuario — JSON nullable.
-- Schema esperado:
--   {
--     "diet": "omnivore" | "vegetarian" | "vegan" | "pescatarian",
--     "allergies": ["gluten", "lactose", "nuts", "shellfish", "egg", "soy"],
--     "dislikes": "cilantro, brocoli, higado"   -- texto libre, max 200 chars
--   }
ALTER TABLE users ADD COLUMN dietary_preferences TEXT;
