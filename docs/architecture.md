# Arquitectura del Sistema

## Stack Tecnologico

| Capa | Tecnologia | Ubicacion |
|------|-----------|-----------|
| Frontend | React 18 + Vite 5 + TypeScript | `client/` |
| Backend API | Cloudflare Workers | `worker/` |
| Proxy + Headers | Cloudflare Workers | `worker-proxy/` |
| Base de datos | Cloudflare D1 (SQLite) | ID: `89b25589-...` |
| Almacenamiento | Cloudflare R2 | Bucket: `caliro-backups` |
| IA | Claude Haiku 4.5 / Sonnet 4.6 (Anthropic API) | Desde Worker |
| Pagos | Stripe (Checkout + Webhooks) | Desde Worker |
| Email | Resend | Desde Worker |
| Analytics | Umami Cloud | Script en cliente |
| Errores | Sentry | Cliente + Worker |
| Mobile (preparado) | Capacitor 8 (iOS) | `client/` (devDeps) |

---

## Diagrama de Flujo

```
Usuario (Browser/PWA)
    |
    v
caliro.dev/* ──> [worker-proxy] ──> calorie-app.pages.dev (Cloudflare Pages)
                  (CSP, HSTS,         (React SPA: dist/app/)
                   X-Frame-Options)
    |
    v (API calls)
calorie-app-api.lucatuille.workers.dev ──> [worker]
    |                                        |
    ├── D1 (SQLite)                          ├── Anthropic API (Claude)
    ├── R2 (backups)                         ├── Stripe API
    └── Resend (emails)                      └── Sentry
```

---

## Dominios y URLs

| URL | Funcion |
|-----|---------|
| `caliro.dev` | Dominio canonico (pasa por worker-proxy) |
| `calorie-app.pages.dev` | Alias Cloudflare Pages (acceso directo) |
| `lucaeats.org` | Dominio legacy, redirige a caliro.dev |
| `calorie-app-api.lucatuille.workers.dev` | API Worker |

---

## Estructura de Directorios

```
calorie-app/
├── client/                    # Frontend React + Vite
│   ├── src/
│   │   ├── pages/             # 14 paginas (Dashboard, Calculator, etc.)
│   │   ├── components/        # 20 componentes reutilizables
│   │   ├── context/           # AuthContext (estado global)
│   │   ├── hooks/             # usePageTitle, useWhatsNew
│   │   ├── utils/             # helpers, constantes, TDEE, plataforma
│   │   ├── data/              # datos estaticos (whatsNew)
│   │   ├── api.js             # cliente API centralizado
│   │   ├── App.tsx            # router principal
│   │   └── main.tsx           # bootstrap + SW registration
│   ├── public/                # assets estaticos
│   │   ├── blog/              # articulos SEO (HTML estatico)
│   │   ├── icons/             # iconos PWA (8 tamanios)
│   │   ├── sw.js              # Service Worker
│   │   ├── manifest.json      # PWA manifest
│   │   ├── _redirects         # reglas de routing Cloudflare
│   │   └── sitemap.xml        # SEO
│   ├── scripts/               # post-build, generacion iconos, OG images
│   ├── ios-assets/            # recursos iOS (preparados)
│   ├── ios-templates/         # Info.plist template
│   ├── capacitor.config.ts    # config Capacitor
│   ├── vite.config.js         # config Vite + Vitest
│   └── package.json
│
├── worker/                    # Backend API (Cloudflare Worker)
│   ├── src/
│   │   ├── index.js           # router principal + scheduled handler
│   │   ├── utils.js           # CORS, JWT, auth, rate limiting, passwords
│   │   ├── constants.js       # constantes magicas
│   │   ├── scheduled.js       # backup automatico D1 → R2
│   │   ├── routes/            # 13 modulos de rutas
│   │   │   ├── auth.js        # registro, login, forgot/reset password
│   │   │   ├── entries.js     # CRUD comidas
│   │   │   ├── analyze.js     # analisis foto + texto con Claude
│   │   │   ├── progress.js    # resumen, graficas, analytics avanzados
│   │   │   ├── profile.js     # perfil, export GDPR, eliminacion cuenta
│   │   │   ├── assistant.js   # asistente IA conversacional (Pro)
│   │   │   ├── calibration.js # calibracion personalizada (Pro)
│   │   │   ├── supplements.js # suplementos
│   │   │   ├── products.js    # cache productos (barcode)
│   │   │   ├── weight.js      # registro de peso
│   │   │   ├── admin.js       # dashboard admin
│   │   │   ├── stripe.js      # pagos, webhooks
│   │   │   └── __tests__/     # tests unitarios (~135+)
│   │   └── utils/
│   │       ├── calibration.js # motor de calibracion
│   │       ├── levels.js      # niveles de acceso
│   │       └── spanishDishes.js
│   ├── wrangler.toml          # config Worker, D1, R2, crons
│   └── package.json
│
├── worker-proxy/              # Proxy de seguridad
│   ├── src/index.js           # reescribe hostname + inyecta headers
│   └── wrangler.toml          # ruta caliro.dev/*
│
├── docs/                      # documentacion tecnica
├── CLAUDE.md                  # instrucciones para Claude Code
└── .gitignore
```

---

## Deployment

### Orden de Deploy

Cuando cambian **ambos** (worker + frontend):
```bash
cd worker && npm run deploy    # 1. Worker primero
git push                       # 2. Frontend (auto-deploy via Pages)
```

Solo frontend: `git push`
Solo worker: `cd worker && npm run deploy`
Solo proxy: `cd worker-proxy && npx wrangler deploy`

### Migraciones D1

Multi-statement (archivos SQL):
```bash
npx wrangler d1 execute calorie-app-db --file=migration.sql --remote
```

Sentencia simple:
```bash
npx wrangler d1 execute calorie-app-db --command="ALTER TABLE ..." --remote
```

**Nunca usar la consola web de D1** para migraciones multi-statement o PRAGMA.

---

## Secretos del Worker

Configurados via `wrangler secret put`:

| Secreto | Uso |
|---------|-----|
| `JWT_SECRET` | Firma HMAC-SHA256 de tokens JWT |
| `ANTHROPIC_API_KEY` | API de Claude (analisis IA) |
| `STRIPE_SECRET_KEY` | API de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Verificacion webhooks Stripe |
| `RESEND_API_KEY` | Envio de emails |
| `SENTRY_DSN` | Tracking de errores (opcional) |

---

## Backup Automatico

- **Cron**: Diario a las 03:00 UTC
- **Proceso**: Dump de 26 tablas D1 → JSON → R2 bucket `caliro-backups`
- **Retencion**: 30 dias (limpieza automatica)
- **Backup manual**: `POST /api/admin/backups/run` (solo admin)
- **Estado**: `GET /api/admin/backups` (salud del sistema)
