-- Columnas para futuro fine-tuning de IA
-- input_text: descripción del usuario o contexto de la foto
-- input_type: 'photo', 'text', 'barcode'
-- ai_response_text: razonamiento completo de Claude

ALTER TABLE ai_corrections ADD COLUMN input_text TEXT;
ALTER TABLE ai_corrections ADD COLUMN input_type TEXT DEFAULT 'photo';
ALTER TABLE ai_corrections ADD COLUMN ai_response_text TEXT;
