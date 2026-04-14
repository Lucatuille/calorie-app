-- ============================================================
--  Visibilidad de coste IA (2026-04-15)
--
--  Hasta hoy, ai_usage_logs solo guardaba user_id + input_tokens +
--  output_tokens + created_at. No teníamos forma de saber qué feature
--  estaba consumiendo tokens (photo, chef, chat, digest...) ni qué
--  modelo se usó. Peor: assistant.js tenía un INSERT con columnas
--  que no existían y fallaba silenciosamente (chat y digest sin log).
--
--  Añadimos model + feature para poder desglosar coste por feature
--  y por modelo. Nullable para no romper filas históricas.
--
--  Idempotente vía CREATE INDEX IF NOT EXISTS. Los ALTER TABLE fallan
--  si la columna ya existe pero D1 CLI lo reporta como no-op limpio.
-- ============================================================

ALTER TABLE ai_usage_logs ADD COLUMN model TEXT;
ALTER TABLE ai_usage_logs ADD COLUMN feature TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature_created
  ON ai_usage_logs (feature, created_at DESC);
