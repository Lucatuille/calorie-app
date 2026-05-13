-- ============================================================
--  Email día 3 — flag de tracking de envío por usuario
--  Fecha: 2026-05-11
-- ============================================================
--
-- Columna para marcar cuándo se envió el email día 3 a cada user.
-- NULL = pendiente / no aplica (registrado antes del rollout).
-- TEXT timestamp = enviado en ese momento (no reenviar).
--
-- Ejecución (single statement, OK en D1 web console):
--   ALTER TABLE users ADD COLUMN day3_email_sent_at TEXT DEFAULT NULL;

ALTER TABLE users ADD COLUMN day3_email_sent_at TEXT DEFAULT NULL;
