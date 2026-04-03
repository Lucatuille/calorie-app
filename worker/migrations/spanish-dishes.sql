CREATE TABLE IF NOT EXISTS spanish_dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identificación
  nombre TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  subcategoria TEXT,

  -- Matching
  aliases TEXT NOT NULL DEFAULT '[]',
  token_principal TEXT NOT NULL,
  tokens_secundarios TEXT DEFAULT '[]',
  tokens_exclusion TEXT DEFAULT '[]',

  -- Porción de referencia
  porcion_g INTEGER NOT NULL,
  porcion_desc TEXT NOT NULL,

  -- Macros por porción de referencia
  kcal_ref INTEGER NOT NULL,
  kcal_min INTEGER NOT NULL,
  kcal_max INTEGER NOT NULL,
  proteina_g REAL NOT NULL,
  carbos_g REAL NOT NULL,
  grasa_g REAL NOT NULL,
  fibra_g REAL,

  -- Macros por 100g (para ajustes proporcionales)
  kcal_per_100g REAL NOT NULL,
  proteina_per_100g REAL NOT NULL,
  carbos_per_100g REAL NOT NULL,
  grasa_per_100g REAL NOT NULL,

  -- Variantes (JSON array)
  variantes TEXT DEFAULT '[]',

  -- Contexto para Claude
  notas_claude TEXT,
  factores_variables TEXT,

  -- Metadata de calidad
  fuente_primaria TEXT NOT NULL,
  fuentes_validacion TEXT DEFAULT '[]',
  confianza TEXT NOT NULL CHECK(confianza IN ('alta', 'media', 'baja')),
  metodo_calculo TEXT,

  -- Control
  creado_en INTEGER NOT NULL DEFAULT (unixepoch()),
  actualizado_en INTEGER NOT NULL DEFAULT (unixepoch()),
  revisado_por TEXT
);

CREATE INDEX IF NOT EXISTS idx_sd_nombre ON spanish_dishes(nombre);
CREATE INDEX IF NOT EXISTS idx_sd_categoria ON spanish_dishes(categoria);
CREATE INDEX IF NOT EXISTS idx_sd_token ON spanish_dishes(token_principal);
