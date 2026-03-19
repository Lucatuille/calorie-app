# LucaEats — Claude Code Instructions

## Stack
- **Frontend**: React + Vite → `client/` → Cloudflare Pages (auto-deploy on `git push`)
- **Backend**: Cloudflare Workers → `worker/` → deploy manually (see below)
- **Database**: Cloudflare D1 (SQLite) — ID `89b25589-4ea7-4f62-b34c-6238d68c6cd4`
- **AI**: Claude Haiku Vision via direct fetch from Worker (Anthropic API)
- **Payments**: Stripe (checkout + webhooks)

## Deploy Order — Always Worker First
When both frontend and backend change:
```
cd worker && npm run deploy    # 1. deploy worker
git push                       # 2. push frontend (Cloudflare Pages auto-builds)
```
If only frontend changes: `git push` is enough.
If only worker changes: `cd worker && npm run deploy`.

## D1 Database Migrations
**Always use CLI for multi-statement SQL — never the web console for migrations:**
```bash
npx wrangler d1 execute calorie-app-db --file=migration.sql --remote
```
Simple single statements (ALTER TABLE, CREATE TABLE IF NOT EXISTS) can use:
```bash
npx wrangler d1 execute calorie-app-db --command="SQL HERE" --remote
```

## Routing — Handle With Care
The app runs at `/app/*`. The landing page is at `/`.
`client/public/_redirects`:
```
/         /landing.html  200
/app      /index.html    200
/app/*    /index.html    200
```
- **Never modify `_redirects` without explicit instruction** — wrong rules break the landing page or the SPA.
- `BrowserRouter` uses `basename="/app"` — all React Router paths are relative to `/app`.
- Public routes: `/app/login`, `/app/register`, `/app/privacy`. Everything else is protected.

## Access Levels
```
0  = Waitlist  — blocked everywhere
1  = Founder   — full Pro access (beta, lifetime)
2  = Pro       — paid via Stripe
3  = Free      — default for new users, limited AI (3/day)
99 = Admin     — full access, no limits
```
New users register at level 3 (Free). Level 0 is manually assigned only.
Pro features require `requireProAccess(request, env)` from `worker/src/utils.js` — never trust JWT alone.

## Key Files
- `client/src/api.js` — all API calls; exports `setLogoutHandler` for global 401 handling
- `client/src/context/AuthContext.jsx` — global auth state; calls `/api/auth/refresh` on every load
- `client/src/utils/levels.js` — `isFree()`, `isPro()`, `getAiLimit()`, `canAccess()`
- `worker/src/utils.js` — `authenticate()`, `requireProAccess()`, `proAccessDenied()`, JWT, CORS
- `worker/src/routes/analyze.js` — photo + text AI analysis, rate limiting, calibration
- `worker/wrangler.toml` — Worker config and D1 binding

## Worker Secrets (set via `wrangler secret put`)
- `JWT_SECRET`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Auth Rate Limiting Table
Requires this table in D1 (run once if not exists):
```sql
CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
```

## DB Schema (current)
```sql
users: id, name, email, password, age, weight, height, gender,
       target_calories, target_protein, target_carbs, target_fat,
       goal_weight, tdee, bmr, pal_factor, formula_used, tdee_calculated_at,
       access_level, is_admin, stripe_customer_id, stripe_subscription_id,
       onboarding_completed, last_login, created_at

entries: id, user_id, calories, protein, carbs, fat, weight, notes,
         meal_type, name, date, created_at
         -- NO UNIQUE(user_id, date) — multiple meals per day allowed
         -- INDEX: idx_entries_user_date ON entries(user_id, date)

user_calibration: user_id, global_bias, confidence, data_points,
                  meal_factors, food_factors, time_factors, frequent_meals, updated_at

ai_corrections: id, user_id, entry_id, ai_raw_estimate, ai_calibrated, user_final,
                correction_pct, food_categories, meal_type, has_context,
                is_weekend, day_of_week, hour_of_day, accepted_without_change, created_at

ai_usage_log:   user_id, date, count          -- daily rate limit counter (photo + text AI)
ai_usage_logs:  user_id, input_tokens, output_tokens, created_at  -- token audit log
assistant_usage: (separate daily counter for assistant chat)

auth_attempts:  key, count, window_start  -- auth rate limiting
assistant_conversations: id, user_id, title, created_at, updated_at
assistant_messages: id, conversation_id, role, content, created_at
```

## Commit Style
- Messages in **Spanish**, descriptive body
- Format: `tipo(scope): descripción`
- Always include: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

## Known Landmines
- `_redirects` routing — see above, handle with care
- D1 web console fails on multi-statement SQL and PRAGMA — always use CLI
- Calibration endpoints require Pro access — Free users get 403 silently (caught in Profile)
- `onboarding_completed` uses `!user.onboarding_completed` check (not `=== 0`) — handles null
- AI analysis rate limit is atomic: increment BEFORE calling Claude, rollback on failure
- `stop_reason === 'max_tokens'` from Anthropic means truncated response — return 422 with specific message, not a generic 502

## Live URLs
- Frontend: https://lucaeats.org / https://calorie-app.pages.dev
- Worker: https://calorie-app-api.lucatuille.workers.dev
- GitHub: https://github.com/Lucatuille/calorie-app
