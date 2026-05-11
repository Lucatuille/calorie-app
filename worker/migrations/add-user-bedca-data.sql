-- ============================================================
--  BEDCA tool sync — 1 snapshot JSON por usuario
--  Fecha: 2026-05-10
-- ============================================================
--
-- Tabla de sync para el bedca tool (caliro.dev/bedca/).
-- Endpoint admin-only: GET/PUT /api/bedca/data.
-- localStorage del browser sigue siendo cache rapido. D1 es source of truth.
--
-- Ejecutar con:
--   npx wrangler d1 execute calorie-app-db --file=worker/migrations/add-user-bedca-data.sql --remote

CREATE TABLE IF NOT EXISTS user_bedca_data (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now'))
);
