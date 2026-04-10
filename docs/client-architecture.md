# Arquitectura del Cliente

---

## Stack Frontend

| Tecnologia | Version | Uso |
|-----------|---------|-----|
| React | 18.2 | UI framework |
| React Router | 6.22 | Routing SPA |
| Vite | 5.1 | Build tool + dev server |
| TypeScript | 6.0 | Tipado (paginas y utils) |
| Recharts | 2.12 | Graficas (peso, calorias) |
| Sentry | 10.45 | Error tracking |
| html5-qrcode | 2.3 | Escaner barcode |
| focus-trap-react | 12 | Accesibilidad modales |
| Capacitor | 8.3 | iOS wrap (devDependencies) |

---

## Routing

**Base**: `/app` (BrowserRouter con `basename="/app"`)
En Capacitor nativo: `basename="/"`

### Rutas

| Ruta | Pagina | Acceso | Carga |
|------|--------|--------|-------|
| `/login` | Login | Publico | Eager |
| `/register` | Register | Publico | Eager |
| `/` | Dashboard | Protegido | Eager |
| `/calculator` | Calculator | Protegido | Lazy |
| `/history` | History | Protegido | Lazy |
| `/progress` | Progress | Protegido | Lazy |
| `/profile` | Profile | Protegido | Lazy |
| `/assistant` | Assistant | Protegido (Pro) | Lazy |
| `/onboarding` | Onboarding | Protegido | Lazy |
| `/upgrade` | Upgrade | Protegido | Lazy |
| `/reset-password` | ResetPassword | Publico | Lazy |
| `/privacy` | Privacy | Publico | Lazy |
| `/terms` | Terms | Publico | Lazy |
| `/*` | NotFound | Publico | Lazy |

### Guards
- **PublicRoute**: Si autenticado → redirige a `/`
- **ProtectedRoute**: Si no autenticado → redirige a `/login`
- **Pro features**: Gated por `isPro(user.access_level)` a nivel de componente

---

## Paginas

### Dashboard (`/`)
Pantalla principal. Muestra:
- Calorias de hoy vs objetivo (barra de progreso)
- Macros (proteina, carbs, grasa) en mini-cards
- Mensaje de estado calorico
- Input de peso del dia
- Tracker de suplementos
- Uso de IA restante

### Calculator (`/calculator`)
Entrada de comidas. 4 metodos:
1. **Foto**: Resize a 900px JPEG 0.75 → POST /api/analyze → editar → guardar
2. **Barcode**: html5-qrcode → cache D1 → Open Food Facts → calcular macros
3. **Texto**: Descripcion libre → POST /api/entries/analyze-text → editar → guardar
4. **Manual**: Formulario directo de calorias/macros

Auto-detecta tipo de comida por hora del dia (`MEAL_HOURS` en constants.ts).

### History (`/history`)
Historial agrupado por fecha (mas reciente primero).
- Paginacion con limit/offset
- Modal PastMealRegistrar para anadir comidas en fechas pasadas
- Skeleton loader durante carga

### Progress (`/progress`)
Graficas de peso y calorias.
- Chart de peso (linea) y calorias (barras)
- Periodos: 7, 30, 90 dias
- AdvancedAnalytics (Pro, lazy): distribucion comidas, proyeccion peso, adherencia

### Profile (`/profile`)
Configuracion del usuario:
- Datos personales (peso, altura, edad, genero)
- Objetivo (peso meta, calorias)
- Calculadora TDEE (modal)
- Export datos: CSV + JSON (GDPR)
- Portal Stripe (solo Pro, oculto en nativo)
- Eliminacion de cuenta (link sutil)

### Assistant (`/assistant`)
Chat IA conversacional (solo Pro).
- Interface de chat con mensajes
- Badge "IA" sobre respuestas del asistente
- ProOnlyCard para usuarios Free
- En nativo: links externos via `openExternal()`

### Upgrade (`/upgrade`)
Pagina de planes y precios.
- Tabla comparativa Free vs Pro
- Botones Stripe checkout (mensual/anual)
- En iOS nativo: muestra "Proximamente" en lugar de Stripe

---

## Componentes

### Navegacion
- **Navbar**: Desktop, toggle tema claro/oscuro, links principales
- **BottomNav**: Mobile (<768px), 5 iconos SVG, fijo abajo

### Modales y Overlays
- **BarcodeScanner**: Escaner barcode (web: html5-qrcode, nativo: placeholder)
- **TextAnalyzer**: Input texto → analisis IA
- **TDEECalculator**: Calculadora Mifflin-St Jeor completa
- **SupplementManager**: CRUD suplementos con emoji picker
- **WhatsNew**: Release notes por version
- **WelcomeDisclaimer**: Disclaimer salud primera visita
- **FocusTrap**: Wrapper accesibilidad para modales
- **AdminOverlay**: Dashboard admin (lazy, solo is_admin)

### Widgets Dashboard
- **SupplementTracker**: Checkboxes de suplementos del dia
- **WeightInput**: Peso de hoy con tendencia (ayer, ultimo)

### Feedback Visual
- **Skeleton**: Placeholders de carga (Dashboard, History, Progress)
- **RouteErrorBoundary**: Error boundary con reporte a Sentry
- **InstallPrompt**: Banner PWA "Instalar app" (oculto en nativo)
- **WaitlistScreen**: Pantalla para access_level=0

---

## Estado y Datos

### AuthContext (estado global)
```typescript
// Provee:
- user: objeto usuario completo
- token: JWT string
- login(token, user): guardar auth
- logout(): limpiar auth + redirigir
- updateUser(fields): actualizar parcial
- loading: boolean (refresh en curso)

// Comportamiento:
- Mount → POST /api/auth/refresh → token fresco
- 401 en cualquier API → logout automatico
- Backfill macros si faltan (calcula desde target_calories)
```

### Cliente API (`api.js`)
```javascript
// Patron de llamada:
const data = await api.getTodayEntries(token);

// Internamente:
- Base URL: VITE_API_URL || 'https://calorie-app-api.lucatuille.workers.dev'
- Headers: Authorization Bearer, X-Timezone, Content-Type
- Error: throw Error con .data y .status
- 401: dispara _on401() → logout global
```

### localStorage
- `caliro_token`: JWT
- `caliro_user`: objeto usuario serializado
- `caliro_theme`: 'light' o 'dark'
- `caliro_whats_new_seen`: ultima version vista
- `caliro_disclaimer_accepted`: boolean

---

## Utilidades Clave

### constants.ts
```typescript
ADHERENCE_TOLERANCE = 250    // kcal margen para "on target"
MEAL_HOURS = {
  breakfast: [6, 11],
  lunch: [11, 16],
  snack: [16, 20],
  dinner: [20, 24]
}
MAX_IMAGE_PX = 900           // resize fotos antes de upload
JPEG_QUALITY = 0.75
MAX_TEXT_LENGTH = 500         // chars para analisis texto
MAX_SUPPLEMENTS = 20
```

### levels.ts
```typescript
// Niveles: 0=Waitlist, 1=Beta, 2=Pro, 3=Free, 99=Admin
isPro(level)      // true para 1, 2, 99
isFree(level)     // true para 3
isWaitlist(level)  // true para 0
getAiLimit(level)  // 3, 15, 30, o null (unlimited)
```

### platform.ts (Capacitor)
```typescript
isNative()     // true solo en app nativa (runtime, sin imports)
isIOS()        // true en iOS nativo
isAndroid()    // true en Android nativo
getPlatform()  // 'ios' | 'android' | 'web'
openExternal(url)  // Browser.open en nativo, window.open en web
```

**Critico**: `isNative()` NO importa nada de `@capacitor/core`. Detecta via `window.Capacitor`. Plugins se importan con `await import()` solo dentro de bloques `if (isNative())`. Bundle web = 0 bytes de Capacitor.

### tdee.ts (Motor de Calculo)
- BMR: Mifflin-St Jeor (default) o Katch-McArdle (si hay % grasa)
- PAL: base (tipo trabajo) + pasos + ejercicio (MET)
- Macros: % segun objetivo (lose/maintain/gain)
- Escenarios de perdida/ganancia con kcal/semana

### openfoodfacts.js
- Estrategia cache: D1 cache → Open Food Facts API (12s timeout) → guardar cache
- `calculateNutrition(product, grams)`: escala macros a porcion

---

## PWA

### manifest.json
- `id: "/app/"`, `start_url: "/app/"`
- Display: standalone
- Iconos: 10 tamanios (72-512px, incluye maskable)

### Service Worker (`sw.js`)
- Cache name: `caliro-v10`
- Install: cachea assets estaticos
- Activate: limpia caches viejos
- Fetch: Network-First
  - API → siempre fetch, nunca cache
  - Estaticos → cache fallback
- En Capacitor nativo: SW no se registra (`if (!isNative())`)

### _redirects (Cloudflare Pages)
```
/         /landing.html  200
/app      /index.html    200
/app/*    /index.html    200
```
**No modificar sin instruccion explicita** — reglas incorrectas rompen landing o SPA.

---

## Build

### Desarrollo
```bash
cd client && npm run dev    # Vite dev server en localhost:5173
```

### Produccion
```bash
cd client && npm run build  # Vite build + post-build.js
```

El script `post-build.js` mueve `dist/app.html` → `dist/app/index.html`.

### Mobile
```bash
cd client && npm run build:mobile  # build + cap sync ios
```

### Tests
```bash
npm run test         # Vitest (unitarios)
npm run test:e2e     # Playwright (contra caliro.dev)
```

---

## Estilos

### Enfoque
CSS puro con variables. Sin framework CSS. Inline styles en JSX para estilos dinamicos.

### Variables CSS Principales
```css
--bg                /* fondo principal */
--surface           /* fondo cards */
--border            /* bordes */
--accent: #2d6a4f   /* verde principal */
--accent-2: #e76f51  /* naranja/rojo */
--text-2, --text-3   /* texto secundario/terciario */
--shadow, --shadow-md /* sombras */
--font-serif         /* Instrument Serif (titulos) */
--font-sans          /* Inter (body) */
--radius-sm/md/lg    /* border radius */
```

### Tema Oscuro
Activado via `[data-theme="dark"]` en `<html>`.
Toggle en Navbar, persistido en localStorage.

### Responsive
- Desktop: Navbar visible, contenido max-width 680px centrado
- Mobile (<768px): Navbar oculta, BottomNav fijo abajo
- Safe areas: `env(safe-area-inset-*)` en toda la app
- `viewport-fit=cover` en app.html
