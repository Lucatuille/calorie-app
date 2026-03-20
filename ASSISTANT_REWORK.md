# Migration: lucaeats.org → caliro.dev

## Phase 0 — Cloudflare Pages (dashboard, no code)
- [x] Pages project → "Custom domains" → add `caliro.dev` (auto-CNAME since bought in Cloudflare)
- [x] Wait until `caliro.dev` resolves to the app
- [x] Verify `caliro.dev` loads the landing
- [x] **Do NOT touch `_redirects` yet**

---

## Phase 1 — Code (single commit) ✅
### HTML files — `lucaeats.org` → `caliro.dev`
- [x] `client/public/landing.html` — canonical, hreflang, og:url, contact email footer
- [x] `client/index.html` — canonical, og:url, og:image, twitter:image, title, description, schema name+url
- [x] `client/public/blog/index.html` — canonical, hreflang, og:url, contact email
- [x] `client/public/blog/alternativa-myfitnesspal-espana.html` — same tags
- [x] `client/public/sitemap.xml` — all `<loc>` entries
- [x] `client/public/robots.txt` — sitemap URL

### manifest.json
- [x] `name` → `"Caliro — Seguimiento calórico con IA"`
- [x] `short_name` → `"Caliro"`

### PWA service worker
- [x] `client/public/sw.js` — `CACHE_NAME` → `'caliro-v1'`

### Stripe URLs
- [x] `worker/src/routes/stripe.js` — `success_url` + `cancel_url` → `caliro.dev`

### localStorage keys
- [x] `client/src/App.jsx` — `caliro_disclaimer_v1`
- [x] `client/src/hooks/useWhatsNew.js` — `caliro_whats_new_seen`
- [x] `client/src/pages/Register.jsx` — same

### Deploy
- [x] `cd worker && npm run deploy`
- [x] `git push`

> ⚠️ Note: `hola@caliro.dev` is already set in HTML. Set up the mailbox in Cloudflare Email Routing before the old domain expires.

---

## Phase 2 — Stripe dashboard (after deploy)
- [ ] Stripe → Webhooks → edit endpoint URL
  - Worker URL does NOT change (`calorie-app-api.lucatuille.workers.dev/api/stripe-webhook`)
  - Only update if the worker is renamed (not planned)
- [ ] Send a test webhook and verify it fires correctly

---

## Phase 3 — SEO redirects ✅
- [x] Cloudflare → lucaeats.org → Redirect Rule: all requests → `concat("https://caliro.dev", http.request.uri.path)`, 301
- [x] Google Search Console → `caliro.dev` verified + sitemap submitted (3 pages, Correcta)
- [x] Submit sitemap: `https://caliro.dev/sitemap.xml`
- [ ] ~~Old property (lucaeats.org) → "Cambio de dirección"~~ — skipped, tool fails due to redirect chain through _redirects. 301 is live and transfers SEO authority automatically.

---

## Phase 4 — Do NOT do
- ❌ Do NOT rename the Worker (`calorie-app-api.lucatuille.workers.dev`) — not user-facing, renaming breaks VITE_API_URL
- ❌ Do NOT touch `_redirects` — routing is correct as-is
- ❌ Do NOT cancel `lucaeats.org` for at least 6 months — 301 transfers SEO authority

---

## Notes
- CORS in worker is `*` wildcard — no change needed
- Worker URL stays the same throughout
- localStorage is origin-scoped: existing lucaeats.org users unaffected by key rename
- `articulo-myfitnesspal.html` (root, untracked) — update separately if published
