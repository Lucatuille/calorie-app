-- ============================================================
--  MIGRATION v2 — Macro goals
--  Run in Cloudflare D1 console before deploying worker v2
-- ============================================================

ALTER TABLE users ADD COLUMN target_protein REAL;
ALTER TABLE users ADD COLUMN target_carbs   REAL;
ALTER TABLE users ADD COLUMN target_fat     REAL;
