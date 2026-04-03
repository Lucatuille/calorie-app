# Quality & Growth Roadmap — LucaEats/Caliro

Current score: **6/10**. Target: **8.5/10**.
This document covers every flaw identified in the codebase audit, organized by
implementation safety and impact. Each item is tagged with effort, risk, and
whether it costs money.

---

## Phase 0 — Quick Wins (1–2 sessions, zero risk) [X]

These changes touch nothing structural. No regressions possible.

### 0.1 ARIA Labels on Icon Buttons [X]
**Effort:** 30 min | **Risk:** None | **Cost:** Free

Every icon-only `<button>` needs `aria-label`. Examples:
```jsx
// Before
<button onClick={...}><svg>+</svg></button>

// After
<button onClick={...} aria-label="Añadir comida"><svg>+</svg></button>
```

**Files to sweep:**
- Dashboard.jsx (green + button, delete × buttons)
- History.jsx (edit pencil, delete ×, green + buttons)
- Calculator.jsx (method tabs, discard, photo button)
- PastMealRegistrar.jsx (same pattern)
- All modal close buttons (✕)
- Nav/hamburger buttons

### 0.2 Semantic HTML Skeleton [X]
**Effort:** 1 hour | **Risk:** None | **Cost:** Free

Wrap existing divs in semantic elements. No visual change.
```jsx
// App.jsx or layout
<header>  → top nav / greeting
<nav>     → bottom navigation
<main>    → page content
<section> → each card group
```

Files: App.jsx, Dashboard.jsx, History.jsx, Progress.jsx, Calculator.jsx

### 0.3 Remove Axios [X]
**Effort:** 15 min | **Risk:** None | **Cost:** Free

`axios` is imported in `package.json` but never used — all API calls use
the custom `fetch` wrapper in `api.js`. Remove it:
```bash
cd client && npm uninstall axios
```
Saves ~15KB from the bundle.

### 0.4 Extract Magic Numbers to Constants [X]
**Effort:** 45 min | **Risk:** None | **Cost:** Free

Create `client/src/utils/constants.js`:
```js
export const ADHERENCE_TOLERANCE = 250;     // kcal ± from target
export const MEAL_HOURS = {
  breakfast: [6, 11],
  lunch:     [11, 16],
  snack:     [16, 20],
  dinner:    [20, 24],
};
export const MAX_TEXT_LENGTH = 500;
export const MAX_IMAGE_SIZE  = 900;         // px, resize before upload
export const SONNET_DAILY_LIMIT = 3;
export const CALIBRATION_HALF_LIFE = 23;    // days (decay 0.97^d)
export const CALIBRATION_MIN_CORRECTIONS = 3;
export const CALIBRATION_CAP = [0.75, 1.4];
```
Then replace hardcoded values in Calculator.jsx, analyze.js, calibration.js,
Progress.jsx, Dashboard.jsx. One file at a time — grep for each value.

### 0.5 Focus Styles [X]
**Effort:** 20 min | **Risk:** None | **Cost:** Free

Add to `global.css`:
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
button:focus:not(:focus-visible) { outline: none; }
```
This gives keyboard users visible focus without affecting mouse/touch users.

---

## Phase 1 — Foundation (3–5 sessions, low risk) 

### 1.1 CSS Class Extraction (Inline Styles → Classes) [X]
**Effort:** 4–6 hours | **Risk:** Low (visual only) | **Cost:** Free

This is the biggest quality-of-life improvement. Strategy:

**Step 1:** Identify repeated style patterns across components: [X]
- Card containers (`background: var(--surface)`, border, radius, shadow)
- Section labels (9px uppercase, letter-spacing, weight 600)
- Input fields (border, radius, padding, font)
- Pill buttons (border-radius 99, padding, font, active/inactive states)
- Grid layouts (4-column macro grid)

**Step 2:** Add classes to `global.css`: [X]
```css
.card         { background: var(--surface); border: 0.5px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); }
.card-padded  { padding: 14px 16px; }
.section-label { font-size: 9px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.7px; font-weight: 600; font-family: var(--font-sans); }
.input        { width: 100%; background: var(--surface); border: 0.5px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 13px; color: var(--text-primary); font-family: var(--font-sans); outline: none; box-sizing: border-box; }
.pill         { padding: 5px 12px; border-radius: var(--radius-full); font-size: 12px; cursor: pointer; font-family: var(--font-sans); border: 0.5px solid var(--border); background: transparent; color: var(--text-secondary); }
.pill--active { border-color: var(--accent); background: rgba(45,106,79,0.1); color: var(--accent); font-weight: 600; }
.macro-grid   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
```

**Step 3:** Replace inline styles one component at a time. Order: [X]
1. History.jsx (simplest, edit form has lots of repetition)
2. Calculator.jsx (biggest file, most benefit)
3. Dashboard.jsx
4. Progress.jsx
5. PastMealRegistrar.jsx
6. TextAnalyzer.jsx
7. Profile.jsx, Onboarding.jsx

**How to do it safely:** one file per commit. Visual diff in browser after each.
No logic changes — purely cosmetic refactor.

**CRITICAL — Migration Rules (learned from failed History.jsx attempt):**
1. **NEVER replace inline styles with a CSS class unless the values are an EXACT match.**
   If the original has `padding: '4px 12px'` and the class has `padding: 5px 12px`, that's
   a visual regression. Keep the inline style.
2. **Do NOT use existing `.btn` / `.btn-primary` / `.btn-secondary` classes** for compact
   inline buttons. Those global classes have their own padding/border-radius that differ
   from the small action buttons in cards. Keep inline styles for one-off buttons.
3. **Diff each property one-by-one** before converting. Open the original file side-by-side
   with the CSS class definition and verify every value matches.
4. **Preserve `style={{}}` overrides** for unique values. A class handles the 80% common
   case; the remaining 20% stays as inline `style={{}}` on top of the class.
5. **Background colors vary per context.** Inputs in edit forms use `var(--surface-3)`,
   inputs in modals use `var(--surface)`. The `.input` class uses `var(--surface-3)` as
   the base; override with `style={{ background: 'var(--surface)' }}` where needed.
6. **Test in browser BEFORE committing.** Open the exact page, click through every
   interaction (edit, delete, pills), compare with a screenshot of the original.

### 1.2 Error Boundaries Per Route [X]
**Effort:** 1 hour | **Risk:** None | **Cost:** Free

Currently one boundary wraps the entire app. If Dashboard crashes, everything
goes down. Add per-route boundaries:

```jsx
// client/src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { Sentry.captureException(error, { extra: info }); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Algo salió mal. Recarga la página.</p>
        <button onClick={() => this.setState({ hasError: false })}>Reintentar</button>
      </div>
    );
    return this.props.children;
  }
}
```

Wrap each route in App.jsx:
```jsx
<Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
```

### 1.3 Modal Focus Trap [X]
**Effort:** 30 min | **Risk:** None | **Cost:** Free

PastMealRegistrar, TextAnalyzer, BarcodeScanner, and SupplementManager all
render portals. None of them trap focus — Tab key goes behind the modal.

Solution: small `useFocusTrap` hook or use `focus-trap-react` package (~3KB).
Apply to every portal-based component.

### 1.4 Color Contrast Audit [X]
**Effort:** 1 hour | **Risk:** Low (may need color tweaks) | **Cost:** Free

Run every page through Chrome DevTools Accessibility panel or axe-core.
Known suspect areas:
- `var(--text-tertiary)` on `var(--surface)` in dark mode
- `#666` on `#0f0f0f` (dark mode secondary text)
- `var(--text-3)` in charts/labels

Fix: darken/lighten problem colors until WCAG AA passes (4.5:1 for body, 3:1
for large text). Update CSS variables — all components pick it up automatically.

---

## Phase 2 — Type Safety (2–3 sessions, medium risk)

### 2.1 TypeScript Migration — Incremental 
**Effort:** 8–12 hours total | **Risk:** Medium | **Cost:** Free

Do NOT convert the whole project at once. Incremental strategy:

**Step 1:** Enable TS in the project (1 hour)
```bash
cd client && npm install -D typescript @types/react @types/react-dom
```
Create `tsconfig.json` with `allowJs: true` — existing JS files work unchanged.
Rename files one at a time from `.js` → `.ts` or `.jsx` → `.tsx`.

**Step 2:** Type the foundation files first (lowest risk, highest value)
1. `client/src/utils/constants.ts` (new file, pure types)
2. `client/src/utils/tdee.ts` (pure functions, easy to type)
3. `client/src/utils/levels.ts` (pure functions)
4. `client/src/utils/meals.ts` (pure functions)
5. `client/src/api.ts` (critical — types all API responses)

**Step 3:** Type the context
6. `client/src/context/AuthContext.tsx` (defines `User` type used everywhere)

**Step 4:** Type pages one at a time (biggest files last)
7. History.tsx → Calculator.tsx → Dashboard.tsx → Progress.tsx

**Risk mitigation:** `strict: false` at first. Gradually enable strict checks.
Each file rename is one commit.

### 2.2 Worker Types
**Effort:** 3 hours | **Risk:** Low | **Cost:** Free

Cloudflare Workers supports TypeScript natively via wrangler.
```bash
cd worker && npm install -D typescript @cloudflare/workers-types
```
Type the critical shared types: `User`, `Entry`, `CalibrationProfile`,
API response shapes. Start with `utils.ts`, then routes one at a time.

---

## Phase 3 — Testing (3–5 sessions, zero risk to production)

### 3.1 Unit Tests for Critical Functions [X]
**Effort:** 3 hours | **Risk:** None | **Cost:** Free

Test pure functions first (no mocking needed):
```
client/src/utils/tdee.js        → calculateBMR, calculateMacros, calculateBasePAL
client/src/utils/levels.js      → isFree, isPro, canAccess, getAiLimit
client/src/utils/meals.js       → getMeal, getDefaultMealType
worker/src/utils/calibration.js → calculateCalibrationProfile, applyCalibration, findSimilarMeal
```

Framework: vitest (already installed in worker, add to client).
These tests are fast, stable, and catch formula regressions.

### 3.2 API Integration Tests [X]
**Effort:** 4 hours | **Risk:** None | **Cost:** Free

Test Worker endpoints with vitest + Miniflare (Cloudflare's local runtime):
```
POST /api/auth/register  → creates user, returns token
POST /api/auth/login     → validates credentials
POST /api/entries        → saves entry with correct date
GET  /api/entries/today  → returns only today's entries
PUT  /api/profile        → updates macros correctly
GET  /api/progress/chart → returns correct day count
```

These catch the bugs we've been fixing (off-by-one, missing fields, etc.)
before they reach production.

### 3.3 E2E Tests for Critical Flows
**Effort:** 6 hours | **Risk:** None | **Cost:** Free (Playwright is free)

**Priority flows:**
1. Register → Onboarding → Dashboard (macros populated?)
2. Login → Add meal (photo/text/manual) → See in History
3. Add past meal from History → Check Progress updated
4. Stripe checkout → Pro access verified
5. PWA install → Offline fallback works

Framework: Playwright (works with Vite, free, headless CI-ready).
Start with flows 1 and 2 — they cover 80% of user actions.

### 3.4 Lighthouse CI
**Effort:** 1 hour | **Risk:** None | **Cost:** Free

Add to GitHub Actions:
```yaml
- name: Lighthouse
  uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      https://caliro.dev
      https://caliro.dev/app/login
    budgetPath: ./lighthouse-budget.json
```

Set performance budgets: LCP < 2.5s, CLS < 0.1, bundle < 400KB.
Fails the build if regressions happen.

---

## Phase 4 — Performance (2–3 sessions, low risk) 

### 4.1 Code Splitting / Lazy Loading [X]
**Effort:** 2 hours | **Risk:** Low | **Cost:** Free

React.lazy + Suspense for route-level splitting:
```jsx
const Calculator = lazy(() => import('./pages/Calculator'));
const History    = lazy(() => import('./pages/History'));
const Progress   = lazy(() => import('./pages/Progress'));
const Assistant  = lazy(() => import('./pages/Assistant'));
const Admin      = lazy(() => import('./pages/Admin'));

// In routes
<Suspense fallback={<Spinner />}>
  <Route path="/calculator" element={<Calculator />} />
</Suspense>
```

`recharts` and `html5-qrcode` are heavy and only used in specific pages.
Lazy loading them means the Dashboard loads instantly.

**Expected impact:** Initial bundle from ~335KB gzipped → ~180KB gzipped.

### 4.2 Bundle Analysis [X]
**Effort:** 30 min | **Risk:** None | **Cost:** Free

```bash
npm install -D rollup-plugin-visualizer
```
Add to `vite.config.js`:
```js
import { visualizer } from 'rollup-plugin-visualizer';
plugins: [visualizer({ open: true })]
```

Run `npm run build` → opens treemap. Identify what's actually heavy.
Then decide: tree-shake, lazy-load, or replace.

### 4.3 Image Optimization
**Effort:** 1 hour | **Risk:** None | **Cost:** Free

**Icons:** Convert PNG icons to WebP. Add both formats to manifest.
**Photos:** Client already resizes to 900px max — good. Consider:
- Reduce JPEG quality from 0.82 to 0.72 (significant size reduction, imperceptible quality loss)
- Add a progress indicator for large uploads

---

## Phase 5 — Security Hardening (1–2 sessions, medium risk)

### 5.1 CSRF Protection[X]
**Effort:** 2 hours | **Risk:** Medium (touches auth flow) | **Cost:** Free

**Option A (simple):** Check `Origin` header on all POST/PUT/DELETE requests
in the Worker. Reject requests from unexpected origins.
```js
const origin = request.headers.get('Origin');
if (!['https://caliro.dev', 'https://calorie-app.pages.dev'].includes(origin)) {
  return errorResponse('Forbidden', 403);
}
```

**Option B (stronger):** Double-submit cookie pattern. Send a random token in
both a cookie and a header. Worker validates they match.

Option A is sufficient for this app's threat model.

### 5.2 Password Policy [X]
**Effort:** 30 min | **Risk:** None | **Cost:** Free

Add to `/api/auth/register`:
```js
if (password.length < 8) return errorResponse('La contraseña debe tener al menos 8 caracteres');
```
And client-side validation in the Register form.

### 5.3 HttpOnly Cookie Migration (Future)
**Effort:** 8+ hours | **Risk:** High | **Cost:** Free

⚠️ **DO NOT do this now.** This is the nuclear option for localStorage XSS.

Requires:
- Worker sets `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`
- Client stops using localStorage for token
- All API calls use `credentials: 'include'`
- CORS config must allow credentials
- PWA offline mode needs rethinking (no localStorage fallback)

This is a major architectural change. Only pursue if:
- You have test coverage (Phase 3 done)
- You have TypeScript (Phase 2 done)
- You've had an actual XSS vulnerability

**Current mitigation:** CSP headers + no user-generated HTML rendering = XSS
surface is already small. The risk is theoretical, not imminent.

### 5.4 Content Security Policy Headers
**Effort:** 30 min | **Risk:** Low | **Cost:** Free

Add CSP headers via the Worker proxy or Cloudflare Transform Rules:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://calorie-app-api.lucatuille.workers.dev https://*.sentry.io;
  font-src 'self' https://fonts.gstatic.com;
```

This prevents XSS even if an injection vulnerability exists — scripts from
unknown origins are blocked by the browser.

---

## Phase 6 — Documentation & DX (1 session, zero risk)

### 6.1 Local Development Setup Guide
**Effort:** 30 min | **Risk:** None | **Cost:** Free

Create `CONTRIBUTING.md`:
```markdown
## Setup
1. Clone: `git clone ...`
2. Client: `cd client && npm install && npm run dev`
3. Worker: `cd worker && npm install && npx wrangler dev --local`
4. Environment: Copy `.env.example` to `.env.local`

## Environment Variables
VITE_API_URL=http://localhost:8787
JWT_SECRET=dev-secret
ANTHROPIC_API_KEY=sk-...
```

### 6.2 .env.example File
**Effort:** 10 min | **Risk:** None | **Cost:** Free

Create `.env.example` (no real values):
```
VITE_API_URL=http://localhost:8787
# Worker secrets (set via wrangler secret put):
# JWT_SECRET
# ANTHROPIC_API_KEY
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
```

### 6.3 API Documentation
**Effort:** 2 hours | **Risk:** None | **Cost:** Free

Document all endpoints in a `PROMPTS/API.md`:
- Method, path, auth requirement
- Request body shape
- Response shape
- Error codes

This is essential if you ever:
- Build a mobile app
- Onboard another developer
- Integrate with third-party services

---

## Implementation Order (Safe Path)

```
Week 1:  Phase 0 (quick wins) — zero risk, immediate quality boost [X]
Week 2:  Phase 1.1 (CSS extraction) — start with History.jsx [X]
Week 3:  Phase 1.2-1.4 (error boundaries, focus trap, contrast) [X]
Week 4:  Phase 3.1 (unit tests for pure functions) [X]
Week 5:  Phase 2.1 steps 1-2 (TS setup + type utilities) [X]
Week 6:  Phase 4.1-4.2 (code splitting + bundle analysis) [X]
Week 7:  Phase 3.2 (API integration tests) [X]
Week 8:  Phase 5.1-5.2 (CSRF + password policy) [X]
Week 9:  Phase 2.1 steps 3-4 (type context + pages) [X]
Week 10: Phase 3.3 (E2E tests)
Week 11: Phase 5.4 (CSP headers)
Week 12: Phase 6 (documentation)
```

---

## Risk & Cost Summary

| Item | Risk | Cost | Hard? |
|------|------|------|-------|
| ARIA labels | None | Free | No |
| Semantic HTML | None | Free | No |
| Remove axios | None | Free | No |
| Magic numbers → constants | None | Free | No |
| Focus styles | None | Free | No |
| CSS class extraction | Low | Free | Tedious, not hard |
| Error boundaries | None | Free | No |
| Focus traps | None | Free | No |
| Color contrast | Low | Free | No |
| TypeScript (incremental) | Medium | Free | Medium — learning curve if new |
| Unit tests | None | Free | No |
| API integration tests | None | Free | Medium — Miniflare setup |
| E2E tests | None | Free | Medium — Playwright setup |
| Lighthouse CI | None | Free | No |
| Code splitting | Low | Free | No |
| Bundle analysis | None | Free | No |
| CSRF protection | Medium | Free | No |
| Password policy | None | Free | No |
| CSP headers | Low | Free | No |
| HttpOnly cookies | **High** | Free | **Yes — major refactor** |
| Documentation | None | Free | No |

**Nothing costs money.** The only truly risky item is HttpOnly cookie migration,
which is explicitly marked as "do later, after tests exist."

---

## Success Metrics

After completing Phases 0–4:
- Accessibility score: 3/10 → **7/10**
- Testing score: 2/10 → **7/10**
- Code quality: 6/10 → **8/10**
- Performance: 6/10 → **8/10**
- Security: 7/10 → **8/10**
- **Overall: 6/10 → 8.5/10**

The app goes from "works but fragile" to "production-grade and maintainable."
