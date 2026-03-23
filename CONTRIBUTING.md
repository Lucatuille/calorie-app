# Contributing to Caliro

## Setup

```bash
# Clone
git clone https://github.com/Lucatuille/calorie-app.git
cd calorie-app

# Client
cd client
npm install
cp .env.example .env.local    # edit VITE_API_URL if needed
npm run dev                    # → http://localhost:5173

# Worker (separate terminal)
cd worker
npm install
npx wrangler dev --local       # → http://localhost:8787
```

## Worker Secrets (production)

Set via `wrangler secret put <NAME>`:
- `JWT_SECRET` — random string for auth tokens
- `ANTHROPIC_API_KEY` — Claude API key
- `STRIPE_SECRET_KEY` — Stripe payments
- `STRIPE_WEBHOOK_SECRET` — Stripe webhooks
- `SENTRY_DSN` — error tracking (optional)

## Database

D1 (SQLite) — ID: `89b25589-4ea7-4f62-b34c-6238d68c6cd4`

Migrations:
```bash
# Multi-statement SQL — always use CLI
npx wrangler d1 execute calorie-app-db --file=migration.sql --remote

# Single statements (ALTER TABLE, CREATE TABLE IF NOT EXISTS)
npx wrangler d1 execute calorie-app-db --command="SQL HERE" --remote
```

Never use the D1 web console for multi-statement SQL or PRAGMA.

## Deploy

Worker first, then frontend:
```bash
cd worker && npm run deploy    # 1. deploy worker
git push                       # 2. push frontend (Cloudflare Pages auto-builds)
```

If only frontend: `git push`
If only worker: `cd worker && npm run deploy`

## Tests

```bash
# Client — 94 unit tests
cd client && npm test

# Worker — 56 tests (calibration + API)
cd worker && npx vitest run

# Bundle analysis
cd client && ANALYZE=1 npm run build
```

## Commit Style

- Messages in **Spanish**, descriptive body
- Format: `tipo(scope): descripción`
- Types: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `perf`, `a11y`, `security`
- Always include: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

## Architecture

```
client/              → React + Vite + TypeScript → Cloudflare Pages
  src/
    pages/           → Route pages (Dashboard, Calculator, etc.)
    components/      → Reusable components
    context/         → AuthContext (global auth state)
    utils/           → Pure utility functions (typed)
    styles/          → global.css (design system)

worker/              → Cloudflare Workers API
  src/
    routes/          → API route handlers
    utils/           → JWT, CORS, calibration engine
    constants.js     → Shared constants

worker-proxy/        → Frontend proxy (caliro.dev → pages.dev)
```

## Access Levels

```
0  = Waitlist  — blocked
1  = Founder   — full Pro (lifetime)
2  = Pro       — paid via Stripe
3  = Free      — default, limited AI (3/day)
99 = Admin     — full access
```
