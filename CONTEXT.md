# LucaEats — Documento de contexto del proyecto

> Referencia completa para cualquier persona o IA que trabaje en este proyecto.
> Última actualización: 2026-03-05.

---

## 1. ¿Qué es esto?

**LucaEats** es una Progressive Web App (PWA) de seguimiento nutricional. Permite:
- Registrar comidas con calorías y macros (manualmente o con foto + IA)
- Ver resumen diario, semanal y mensual en el dashboard
- Analíticas avanzadas: proyección de peso científica, histograma calórico, tendencias
- Racha de días registrados (streak)
- Tracking de suplementos diarios con toggle
- Historial editable de comidas pasadas
- Exportar datos en CSV
- Calcular TDEE (Mifflin-St Jeor)

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite, CSS puro (sin Tailwind) |
| Backend | Cloudflare Workers (Edge, runtime Workers) |
| Base de datos | Cloudflare D1 (SQLite) |
| Despliegue frontend | Cloudflare Pages (auto-deploy en git push) |
| Despliegue backend | Wrangler CLI (`npm run deploy`) |
| Gráficos | Recharts |
| IA / Visión | Claude Haiku (Anthropic API) vía fetch directo desde el Worker |
| Auth | JWT firmado con `JWT_SECRET` en Worker Secrets |

---

## 3. URLs y repositorio

| Recurso | URL |
|---------|-----|
| Frontend (producción) | https://caliro.dev (canónico) — https://lucaeats.org redirige aquí |
| Alias Cloudflare Pages | https://calorie-app.pages.dev |
| Worker API | https://calorie-app-api.lucatuille.workers.dev |
| GitHub | https://github.com/Lucatuille/calorie-app |
| D1 Database ID | `89b25589-4ea7-4f62-b34c-6238d68c6cd4` |

---

## 4. Estructura de directorios

```
calorie-app/
├── client/                     # Frontend React + Vite
│   ├── public/
│   │   ├── manifest.json       # PWA manifest (nombre: LucaEats, tema: #2d6a4f)
│   │   ├── sw.js               # Service Worker v2 — Network First
│   │   ├── _headers            # Cloudflare Pages: cache-control por ruta
│   │   └── icons/              # Iconos PWA (8 tamaños + favicon + apple-touch)
│   └── src/
│       ├── App.jsx             # Router + AuthProvider + rutas protegidas/públicas
│       ├── main.jsx            # Punto de entrada, monta <App />
│       ├── api.js              # TODOS los calls al Worker (un solo fichero)
│       ├── context/
│       │   └── AuthContext.jsx # user, token, login(), logout(), ready
│       ├── pages/
│       │   ├── Dashboard.jsx   # Página principal: hoy, semana, suplementos, stats
│       │   ├── Calculator.jsx  # Registrar comida + análisis foto IA + TDEE
│       │   ├── History.jsx     # Historial agrupado por fecha, editar/eliminar
│       │   ├── Progress.jsx    # Gráficos de calorías y peso + Analytics
│       │   ├── Profile.jsx     # Datos usuario, objetivos, exportar CSV
│       │   ├── Login.jsx
│       │   └── Register.jsx
│       ├── components/
│       │   ├── Navbar.jsx          # Responsive: hamburguesa en móvil
│       │   ├── AdvancedAnalytics.jsx  # Bottom sheet con 5 secciones analíticas
│       │   ├── SupplementTracker.jsx  # Grid de suplementos del día con toggle
│       │   ├── SupplementManager.jsx  # Modal (desktop) / bottom sheet (móvil)
│       │   └── InstallPrompt.jsx      # Banner PWA "Instalar app"
│       ├── utils/
│       │   ├── meals.js        # MEAL_TYPES, getMeal() (breakfast/lunch/dinner/snack/other)
│       │   └── supplements.js  # COMMON_SUPPLEMENTS, EMOJI_PICKER_OPTIONS, todayDate()
│       └── styles/
│           └── global.css      # Variables CSS, reset, clases utilitarias
│
├── worker/                     # Cloudflare Worker
│   ├── wrangler.toml           # Config: nombre, D1 binding (DB), compatibilidad
│   ├── schema.sql              # Schema original (ver sección 6 para schema real actual)
│   └── src/
│       ├── index.js            # Router principal, CORS, manejo de errores
│       ├── utils.js            # corsHeaders, jsonResponse, errorResponse, authenticate()
│       └── routes/
│           ├── auth.js         # POST /register, POST /login
│           ├── entries.js      # CRUD de entradas de comida
│           ├── progress.js     # Summary, chart, advanced analytics (proyección científica)
│           ├── profile.js      # GET/PUT perfil, GET export CSV
│           ├── analyze.js      # POST análisis de foto con Claude Vision
│           └── supplements.js  # CRUD suplementos + toggle diario
│
├── ROADMAP.md                  # Tracker de features por fases (A→E)
├── CONTEXT.md                  # Este archivo
└── PROMPT_*.md                 # Prompts de features implementadas (contexto histórico)
```

---

## 5. Variables de entorno y secrets

### Cloudflare Pages (frontend)
```
VITE_API_URL = https://calorie-app-api.lucatuille.workers.dev
```

### Cloudflare Worker Secrets (no en código)
```bash
wrangler secret put JWT_SECRET          # Token de firma JWT
wrangler secret put ANTHROPIC_API_KEY   # Para análisis de fotos con Claude
```

---

## 6. Schema de base de datos (estado actual real)

> ⚠️ El `schema.sql` en el repo es el original. El schema real en producción tiene estas columnas adicionales añadidas con ALTER TABLE.

```sql
-- Usuarios
CREATE TABLE users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  email            TEXT    NOT NULL UNIQUE,
  password_hash    TEXT    NOT NULL,    -- bcrypt
  age              INTEGER,
  weight           REAL,
  height           REAL,
  gender           TEXT CHECK(gender IN ('male', 'female')),
  target_calories  INTEGER,
  target_protein   REAL,               -- añadido: objetivo proteína (g)
  target_carbs     REAL,               -- añadido: objetivo carbos (g)
  target_fat       REAL,               -- añadido: objetivo grasa (g)
  goal_weight      REAL,               -- añadido: peso objetivo
  created_at       TEXT DEFAULT (datetime('now'))
);

-- Entradas de comida (una fila por comida, varias por día)
CREATE TABLE entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calories   INTEGER NOT NULL,
  protein    REAL,
  carbs      REAL,
  fat        REAL,
  weight     REAL,               -- peso corporal ese día (opcional)
  notes      TEXT,
  meal_type  TEXT DEFAULT 'other',  -- breakfast/lunch/dinner/snack/other
  name       TEXT,                  -- nombre de la comida
  date       TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
  -- ⚠️ SIN UNIQUE(user_id, date) — varias comidas por día permitidas
);
CREATE INDEX idx_entries_user_date ON entries(user_id, date);

-- Suplementos del usuario
CREATE TABLE user_supplements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  emoji       TEXT    NOT NULL DEFAULT '💊',
  order_index INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

-- Log diario de suplementos tomados
CREATE TABLE supplement_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id  INTEGER NOT NULL REFERENCES user_supplements(id) ON DELETE CASCADE,
  date           TEXT    NOT NULL,
  taken          INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT DEFAULT (datetime('now')),
  UNIQUE(supplement_id, date)
);
```

### Ejecutar migraciones D1
```bash
# Multi-statement SQL (fichero):
npx wrangler d1 execute calorie-app-db --file=migration.sql --remote

# Sentencia simple:
npx wrangler d1 execute calorie-app-db --command="ALTER TABLE ..." --remote
```

> PRAGMA foreign_keys no funciona en la consola web de D1. Usar CLI.

---

## 7. API — Todas las rutas del Worker

### Auth (públicas)
```
POST /api/auth/register   { name, email, password }  → { token, user }
POST /api/auth/login      { email, password }         → { token, user }
```

### Entries (requieren Bearer token)
```
GET    /api/entries/today             → [ ...entradas de hoy ]
GET    /api/entries?limit=90         → [ ...últimas N entradas ]
POST   /api/entries                  { calories, protein, carbs, fat, weight,
                                        notes, meal_type, name, date }
PUT    /api/entries/:id              { mismos campos }
DELETE /api/entries/:id
```

### Progress
```
GET /api/progress/summary            → { entries[], summary: { streak, avgThisWeek,
                                          avgLastWeek, avgCalories, totalDaysLogged,
                                          adherence, currentWeight } }
GET /api/progress/chart?days=30      → [ { date, calories, weight }... ]
GET /api/progress/advanced?period=month  → objeto analítico completo (ver sección 8)
```

### Profile
```
GET /api/profile                     → objeto usuario
PUT /api/profile                     { name, age, weight, height, gender,
                                        target_calories, target_protein,
                                        target_carbs, target_fat, goal_weight }
GET /api/profile/export              → CSV con todas las entradas
```

### Analyze (IA)
```
POST /api/analyze                    { image: base64, mediaType: "image/jpeg",
                                        context?: "texto opcional del usuario" }
                                     → { calories, protein, carbs, fat, notes }
```

### Supplements
```
GET    /api/supplements/today?date=YYYY-MM-DD   → [ { id, name, emoji, order_index, taken } ]
POST   /api/supplements                          { name, emoji, order_index }
DELETE /api/supplements/:id
POST   /api/supplements/:id/toggle              { date, taken: bool }
PUT    /api/supplements/reorder                 [ { id, order_index }... ]
```

### Health
```
GET /api/health    → { status: "ok", timestamp }
```

---

## 8. Analytics avanzado — objeto de respuesta

`GET /api/progress/advanced?period=week|month|90days`

```js
{
  period: "month",
  days_with_data: 18,
  total_days: 30,
  daily_data: [ { date, calories, weight }... ],

  calories: {
    avg, min, max,
    days_in_target, days_over, days_under,   // ±250 kcal del objetivo
    best_day_of_week, worst_day_of_week,
    trend: "improving" | "worsening" | "stable"
  },

  meals: {
    breakfast_pct, lunch_pct, dinner_pct, snack_pct, other_pct
  },

  weight: {
    start, current, change, trend_per_week
  },

  // Proyección científica (modelo Hall et al.)
  scenarios: {
    optimistic:   { day30, day60, day90 },
    realistic:    { day30, day60, day90 },
    conservative: { day30, day60, day90 }
  },
  plateau_prediction: null | "likely" | "imminent",
  adherence_rate: 0.0–1.0,
  calorie_variability_cv: number,       // Coeficiente de variación %
  metabolic_adaptation_factor: number,  // 0.85–1.0
  data_quality_score: number,           // 0–1
  weekly_rate_realistic: number,        // kg/semana
  days_to_goal_realistic: number | null,

  streaks: {
    longest_in_period, current
  }
}
```

---

## 9. Frontend — páginas y componentes clave

### AuthContext (`context/AuthContext.jsx`)
- Guarda `user` y `token` en `localStorage`
- Expone `login(token, user)`, `logout()`, `ready` (evita flash de redirect)

### Dashboard (`pages/Dashboard.jsx`)
- Carga en paralelo: `getTodayEntries` + `getSummary` + `getProfile`
- `todayTotal` = reduce sobre array de comidas del día
- Componentes inline: `MacroDonut` (conic-gradient), `CalProgress` (barra ±250 kcal)
- Secciones: header con streak → tarjeta hoy → resumen semanal → **SupplementTracker** → stats 30d → acciones rápidas

### Calculator (`pages/Calculator.jsx`)
- Estado separado para foto: `photoData { base64, mediaType }` y `photoContext`
- Flujo foto: seleccionar → preview → escribir contexto opcional → "Analizar con IA" → spinner → card resultado → "Usar estimación" rellena el formulario
- Formulario: `meal_type` (botones selector), name, calories, protein, carbs, fat, weight, notes
- TDEE calculator al final (Mifflin-St Jeor)

### SupplementTracker (`components/SupplementTracker.jsx`)
- Fetch en mount + `visibilitychange` si cambió la fecha (detección de día nuevo)
- Grid adaptativo: 2 columnas (≤2 suplementos), 3 (≤6), 4 (>6)
- Toggle con **optimistic update**: cambia estado local inmediatamente, revierte si falla la API
- Loading: 3 skeleton boxes con animación shimmer
- Abre `SupplementManager` al pulsar ✏️ o el botón vacío

### SupplementManager (`components/SupplementManager.jsx`)
- **Renderiza via `createPortal(content, document.body)`** — imprescindible para que `position: fixed` funcione correctamente en Safari/iOS cuando el ancestro tiene animaciones CSS
- **Responsive**: bottom sheet en móvil (≤640px), modal centrado en desktop (>640px)
- Detecta breakpoint con `window.matchMedia('(max-width: 640px)')` + listener de resize
- Render guard: `visible` + `animOpen` con doble `requestAnimationFrame` para evitar flash en montaje
- Cierra con Escape, clic en overlay, o botón ✕

### AdvancedAnalytics (`components/AdvancedAnalytics.jsx`)
- Bottom sheet (renderiza con portal también)
- 5 secciones: Resumen → Calorías (BarChart con colores) → Por tipo de comida → Proyección de peso (3 escenarios dashed) → Tendencia

---

## 10. Diseño y CSS

### Variables CSS principales (`global.css`)
```css
--accent:    #2d6a4f   /* verde principal */
--accent-2:  #e76f51   /* naranja/rojo */
--surface:   fondo de cards
--bg:        fondo de página
--border:    bordes y separadores
--text-2:    texto secundario
--text-3:    texto terciario / labels
--shadow:    sombra suave de cards
--shadow-md: sombra media (hover)
--danger:    rojo para errores/eliminaciones
```

### Tipografía
- Títulos: `Instrument Serif` (Google Fonts)
- UI: `Plus Jakarta Sans` (Google Fonts)

### Clases utilitarias relevantes
```css
.page          /* contenedor de página con padding */
.stagger       /* animación de entrada escalonada — ⚠️ crea stacking context */
.card          /* tarjeta con fondo surface, border, shadow */
.btn           /* botón base */
.btn-primary   /* verde */
.btn-secondary /* neutro */
.btn-sm        /* tamaño pequeño */
.btn-full      /* ancho 100% */
.field         /* wrapper de input con label */
.spinner       /* spinner de carga circular */
.progress-track / .progress-fill
.stat-grid / .stat-box / .stat-label / .stat-value / .stat-unit
.macro-chip .chip-protein / .chip-carbs / .chip-fat
.title-xl / .title-md / .body-sm / .muted
```

> ⚠️ `.stagger` usa animación CSS. En Safari/iOS esto crea un nuevo stacking context
> que rompe `position: fixed` en los hijos. Siempre usar `createPortal` para modales/sheets.

---

## 11. Lógica de negocio importante

### Adherencia (±250 kcal)
```js
const onTarget = Math.abs(calories - target_calories) <= 250;
// Verde: en rango | Naranja: >250 sobre | Azul: >250 bajo
```

### Streak
- Días consecutivos con al menos una entrada registrada
- Calculado en backend con `SELECT DISTINCT date ORDER BY date DESC`

### Proyección de peso (modelo científico)
Implementado en `worker/src/routes/progress.js`:
- **Densidad energética variable**: 5000 kcal/kg primeros 14 días, 7200 kcal/kg después
- **Adaptación metabólica**: reducción ~15% del déficit por cada 10% de peso perdido (Hall et al.)
- **Promedio ponderado**: 70% últimas 2 semanas + 30% período anterior
- **3 escenarios**: optimista (100% adherencia), realista (adherencia real), conservador (70%)
- **Bandas de incertidumbre** a 30, 60 y 90 días

### Fecha timezone-safe
```js
// Siempre pasar la fecha desde el cliente, nunca confiar en el servidor
export const todayDate = () => new Date().toLocaleDateString('en-CA');
// Devuelve YYYY-MM-DD en la timezone local del usuario
```

---

## 12. Flujo de despliegue

### Solo frontend
```bash
git add .
git commit -m "descripción"
git push
# Cloudflare Pages auto-construye y despliega (~2-3 min)
```

### Solo worker
```bash
cd worker
npm run deploy
# Despliega inmediatamente via Wrangler
```

### Ambos a la vez
```bash
# 1. Primero el worker
cd worker && npm run deploy && cd ..
# 2. Luego el frontend
git add . && git commit -m "..." && git push
```

### Schema D1 (nuevas tablas o columnas)
```bash
npx wrangler d1 execute calorie-app-db --file=migration.sql --remote
```

---

## 13. PWA

- **manifest.json**: nombre "LucaEats", `display: standalone`, tema `#2d6a4f`
- **sw.js** (v2): estrategia **Network First** para todo — garantiza actualizaciones tras deploy
- **_headers**: `no-store` en `index.html` y `sw.js` para evitar que Cloudflare Pages cachee en el edge; `immutable` en `/assets/*`
- **InstallPrompt.jsx**: banner `beforeinstallprompt`, descartable, flag en `localStorage`
- **Iconos**: generados con `sharp` desde `logo.svg`, 8 tamaños + favicon + apple-touch

---

## 14. Problemas conocidos y soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| `position: fixed` no fija al viewport en iOS | Ancestro con animación CSS crea stacking context | Usar `createPortal(content, document.body)` |
| Botón/feature desaparece tras deploy en PWA | Service Worker sirviendo JS antiguo (Cache First) | SW v2 con Network First + `_headers` no-store |
| D1 multi-statement SQL falla en consola web | Limitación de la consola D1 de Cloudflare | Usar `wrangler d1 execute --file --remote` |
| `PRAGMA foreign_keys` falla en consola web | No soportado | Usar CLI de wrangler |
| Foto IA: estimación imprecisa | Falta de contexto | Textarea de contexto opcional antes de analizar |

---

## 15. Convenciones del proyecto

- **Estilos**: inline en JSX para componentes, `global.css` para utilidades globales. Sin Tailwind.
- **Commits**: en español con descripción en el body. Co-authored con Claude.
- **API client**: todo en `client/src/api.js`, ningún `fetch` directo en componentes.
- **Fechas**: siempre `new Date().toLocaleDateString('en-CA')` desde el cliente → `YYYY-MM-DD`.
- **Auth**: JWT en `Authorization: Bearer <token>`, validado en cada ruta protegida del Worker.
- **Modales/sheets**: siempre con `createPortal` + render guard (`visible`/`animOpen`) para evitar flashes y problemas de stacking context.
- **Optimistic updates**: cambiar estado local primero, revertir si falla la API (ver SupplementTracker).
