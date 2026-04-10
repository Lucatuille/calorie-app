# Esquema de Base de Datos

**Motor**: Cloudflare D1 (SQLite)
**Database ID**: `89b25589-4ea7-4f62-b34c-6238d68c6cd4`

---

## Tablas Principales

### users
Usuarios registrados en la plataforma.

```sql
CREATE TABLE users (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  name                   TEXT NOT NULL,
  email                  TEXT NOT NULL UNIQUE,
  password               TEXT NOT NULL,
  -- password format: "pbkdf2:100000:{base64salt}:{base64hash}" (nuevo)
  --                  o base64url SHA-256 sin prefijo (legacy, auto-upgrade en login)
  age                    INTEGER,
  weight                 REAL,           -- peso actual (kg)
  height                 REAL,           -- altura (cm)
  gender                 TEXT CHECK(gender IN ('male', 'female')),
  target_calories        INTEGER,
  target_protein         REAL,
  target_carbs           REAL,
  target_fat             REAL,
  goal_weight            REAL,           -- peso objetivo (kg)
  tdee                   INTEGER,
  bmr                    INTEGER,
  pal_factor             REAL,           -- nivel de actividad fisica
  formula_used           TEXT,           -- 'mifflin-st-jeor', etc.
  tdee_calculated_at     TEXT,
  access_level           INTEGER DEFAULT 3,
  -- 0 = Waitlist, 1 = Founder/Beta, 2 = Pro, 3 = Free, 99 = Admin
  is_admin               INTEGER DEFAULT 0,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  onboarding_completed   INTEGER DEFAULT 0,
  last_login             DATETIME,
  created_at             TEXT DEFAULT (datetime('now'))
);
```

---

### entries
Comidas registradas. Multiples entradas por dia permitidas.

```sql
CREATE TABLE entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calories    INTEGER NOT NULL,
  protein     REAL,
  carbs       REAL,
  fat         REAL,
  weight      REAL,                -- peso corporal ese dia (opcional, legacy)
  notes       TEXT,
  meal_type   TEXT DEFAULT 'other', -- breakfast, lunch, dinner, snack, other
  name        TEXT,                 -- nombre/descripcion de la comida
  date        TEXT NOT NULL DEFAULT (date('now')),
  created_at  TEXT DEFAULT (datetime('now'))
);

-- NO hay UNIQUE(user_id, date) — multiples comidas por dia
CREATE INDEX idx_entries_user_date ON entries(user_id, date);
```

---

### weight_logs
Registro historico de peso (una entrada por dia maximo).

```sql
CREATE TABLE weight_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  weight_kg  REAL NOT NULL,        -- rango validado: 20-300 kg
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_weight_logs_user_date ON weight_logs(user_id, date);
```

---

### user_supplements & supplement_logs
Suplementos del usuario y su tracking diario.

```sql
CREATE TABLE user_supplements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,       -- max 20 chars
  emoji       TEXT DEFAULT '💊',
  order_index INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
  -- max 20 suplementos por usuario
);

CREATE TABLE supplement_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supplement_id INTEGER NOT NULL REFERENCES user_supplements(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL,
  date          TEXT NOT NULL,
  taken         INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(supplement_id, date)
);
```

---

## Tablas de IA

### ai_corrections
Correcciones del usuario sobre estimaciones de la IA. Base para calibracion.

```sql
CREATE TABLE ai_corrections (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                 INTEGER NOT NULL,
  entry_id                INTEGER,
  ai_raw_estimate         INTEGER,     -- estimacion original de Claude
  ai_calibrated           INTEGER,     -- estimacion tras calibracion
  user_final              INTEGER,     -- valor final del usuario
  correction_pct          REAL,        -- (user_final - ai_calibrated) / ai_calibrated
  food_categories         TEXT,        -- JSON array ["pollo", "arroz"]
  meal_type               TEXT,
  has_context             INTEGER,     -- 0/1
  is_weekend              INTEGER,     -- 0/1
  day_of_week             INTEGER,     -- 0-6
  hour_of_day             INTEGER,
  accepted_without_change INTEGER,     -- 0/1 (usuario confirmo sin editar)
  -- Columnas de training data (para futuro fine-tuning)
  input_text              TEXT,        -- descripcion del usuario o contexto foto
  input_type              TEXT DEFAULT 'photo',  -- photo, text, barcode
  ai_response_text        TEXT,        -- respuesta completa de Claude
  created_at              TEXT
);
```

---

### user_calibration
Perfil de calibracion calculado por usuario. Se recalcula con cada nueva correccion.

```sql
CREATE TABLE user_calibration (
  user_id        INTEGER PRIMARY KEY,
  global_bias    REAL,        -- sesgo general (ej: +0.05 = IA subestima 5%)
  confidence     REAL,        -- 0-1, fiabilidad del perfil
  data_points    INTEGER,     -- numero de correcciones usadas
  meal_factors   TEXT,        -- JSON { "breakfast": { "bias": 0.03, "samples": 8, "confidence": 0.7 } }
  food_factors   TEXT,        -- JSON { "pasta": { "bias": -0.1, "samples": 5, "confidence": 0.6 } }
  time_factors   TEXT,        -- JSON { "weekend_extra": 0.05 }
  frequent_meals TEXT,        -- JSON [{ "name": "...", "avg_kcal": 450, "times": 12, "last_seen": "..." }]
  updated_at     TEXT
);
```

---

### ai_usage_log
Contador diario de uso de IA por usuario (rate limiting).

```sql
CREATE TABLE ai_usage_log (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL,
  date               TEXT NOT NULL,
  count              INTEGER DEFAULT 0,         -- usos foto + texto
  sonnet_photo_count INTEGER DEFAULT 0,         -- fotos con Sonnet (limite aparte)
  UNIQUE(user_id, date)
);
```

---

### ai_usage_logs
Log de tokens consumidos (auditoria de costes).

```sql
CREATE TABLE ai_usage_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  created_at    TEXT DEFAULT (datetime('now'))
);
```

---

## Tablas del Asistente

### assistant_conversations & assistant_messages

```sql
CREATE TABLE assistant_conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT,             -- generado por Claude en el primer mensaje
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE assistant_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,  -- 'user' o 'assistant'
  content         TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);
```

---

### assistant_usage & assistant_digests

```sql
CREATE TABLE assistant_usage (
  user_id INTEGER NOT NULL,
  date    TEXT NOT NULL,
  count   INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE TABLE assistant_digests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  content    TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Tablas de Soporte

### auth_attempts
Rate limiting con ventana deslizante. Compartida por todos los endpoints.

```sql
CREATE TABLE auth_attempts (
  key          TEXT PRIMARY KEY,    -- formato: "endpoint:identifier" (ej: "login:ip:1.2.3.4")
  count        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL    -- Unix timestamp del inicio de ventana
);
```

---

### password_reset_tokens

```sql
CREATE TABLE password_reset_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 del token raw
  expires_at INTEGER NOT NULL,      -- Unix timestamp (1 hora desde creacion)
  created_at INTEGER DEFAULT (unixepoch()),
  used_at    INTEGER                -- NULL si no usado
);

CREATE INDEX idx_reset_tokens_hash ON password_reset_tokens(token_hash);
```

---

### products_cache
Cache de productos escaneados por codigo de barras.

```sql
CREATE TABLE products_cache (
  barcode       TEXT PRIMARY KEY,
  name          TEXT,
  brand         TEXT,
  image_url     TEXT,
  quantity      TEXT,
  quantity_unit TEXT,
  calories_100g REAL,
  protein_100g  REAL,
  carbs_100g    REAL,
  fat_100g      REAL,
  source        TEXT,          -- 'openfoodfacts', etc.
  scan_count    INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);
```

---

### spanish_dishes
Base de datos de platos espanoles con datos nutricionales de referencia.

```sql
CREATE TABLE spanish_dishes (
  nombre               TEXT PRIMARY KEY,
  categoria            TEXT,
  aliases              TEXT,          -- JSON array de nombres alternativos
  token_principal      TEXT,          -- keyword principal para busqueda
  tokens_secundarios   TEXT,          -- JSON keywords secundarios
  tokens_exclusion     TEXT,          -- JSON keywords de exclusion
  porcion_g            INTEGER,       -- porcion estandar en gramos
  porcion_desc         TEXT,
  kcal_ref             INTEGER,       -- calorias referencia
  kcal_min             INTEGER,
  kcal_max             INTEGER,
  proteina_g           REAL,
  carbos_g             REAL,
  grasa_g              REAL,
  kcal_per_100g        REAL,
  proteina_per_100g    REAL,
  carbos_per_100g      REAL,
  grasa_per_100g       REAL,
  fuente_primaria      TEXT,
  confianza            TEXT,          -- 'alta', 'media', 'baja'
  notas_claude         TEXT,
  porciones_guia       TEXT,          -- JSON con descripciones de porciones
  referencias_visuales TEXT           -- pistas visuales para estimacion de peso
);
```

---

### upgrade_events
Tracking del funnel de conversion a Pro.

```sql
CREATE TABLE upgrade_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  event      TEXT NOT NULL,
  -- Valores: ai_limit_shown, ai_limit_click_pro, assistant_lock_click, upgrade_page_view
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Relaciones y Cascadas

```
users (1) ──> (N) entries           ON DELETE CASCADE
users (1) ──> (N) weight_logs       ON DELETE CASCADE
users (1) ──> (N) user_supplements  ON DELETE CASCADE
users (1) ──> (N) ai_corrections
users (1) ──> (1) user_calibration
users (1) ──> (N) ai_usage_log
users (1) ──> (N) assistant_conversations  ON DELETE CASCADE

user_supplements (1) ──> (N) supplement_logs  ON DELETE CASCADE
assistant_conversations (1) ──> (N) assistant_messages  ON DELETE CASCADE
```

**Nota**: La eliminacion de cuenta (`DELETE /api/profile`) ejecuta CASCADE automatico para las tablas con FK + limpieza manual para tablas sin FK definida.

---

## Notas de Migracion

- Todas las migraciones son idempotentes (`IF NOT EXISTS`, `ON CONFLICT`)
- Nunca usar la consola web de D1 para multi-statement SQL
- Siempre usar CLI: `npx wrangler d1 execute calorie-app-db --file=migration.sql --remote`
- Las columnas `input_text`, `input_type`, `ai_response_text` en `ai_corrections` son nullable (anadidas post-lanzamiento)
