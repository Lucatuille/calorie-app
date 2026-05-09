-- ============================================================
--  Onboarding silencioso — flags de estado por usuario
--  Fecha: 2026-05-09
-- ============================================================
--
-- Añade columna onboarding_state a users como JSON string.
-- Se usa para persistir flags de señales sutiles del onboarding:
--   - help_modal_seen        → apaga pulse del icono "?"
--   - first_digest_seen_at   → controla dot del tab Chef + línea contextual
--   - history_tooltip_seen   → controla tooltip al entrar a Historial (sprint posterior)
--
-- Nota: SQLite ALTER TABLE no admite IF NOT EXISTS para columnas, así que
-- esta migración solo se ejecuta una vez. Ejecutar con:
--   npx wrangler d1 execute calorie-app-db --file=worker/migrations/add-onboarding-state.sql --remote

ALTER TABLE users ADD COLUMN onboarding_state TEXT DEFAULT '{}';
