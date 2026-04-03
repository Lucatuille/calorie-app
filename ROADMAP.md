# Caliro — Roadmap

---

## Built ✅

### Foundation
- Auth (register, login, JWT, refresh)
- Profile with TDEE wizard (Mifflin-St Jeor, activity levels, goal)
- Daily calorie + macro tracking (multiple meals per day)
- Dashboard with progress bar, macro rings, streak
- History grouped by date
- Weight chart, weekly summary, CSV export

### AI Features
- Photo analysis (Claude Haiku Vision) with calibration applied
- Text analysis ("pollo con arroz") with calibration applied
- Calibration engine: per-user bias correction from corrections, applied to all future estimates
- Barcode scanner (Open Food Facts)
- AI rate limits (3/day free, higher for Pro)

### Analytics
- Advanced analytics bottom sheet: adherence, macros, weight projection, streaks
- Progress chart (7/14/30 days)

### Monetization
- Access levels: Free (3), Pro (2), Founder (1), Admin (99), Waitlist (0)
- Stripe checkout + webhook
- Upgrade page (/app/upgrade)

### Supplements
- Daily supplement tracker with toggle
- Supplement manager (add/delete)

### Assistant (Pro)
- Conversation history with titles
- Complexity routing: Haiku (quick) vs Sonnet (analytical)
- Full user context: today, week, macros, meal-type patterns, weekday/weekend patterns, macro deficit profile
- Calibration integrated into assistant context
- Sonnet daily cap (1/user/day, silent downgrade)
- Weekly digest: proactive 3-point summary card, bottom sheet overlay, generated once/week per user

### UX & Infrastructure
- PWA (manifest, service worker, install prompt)
- Dark mode
- What's New modal (versioned, shows once per release)
- Onboarding wizard pre-fills registration data
- Admin overlay (usage stats, user management, AI costs)
- Welcome disclaimer

---

## Pending Fixes 🔧

### High priority

**1. Registration bio fields — optional but critical**
Fields (age, weight, height) are labeled optional but TDEE can't be computed without them.
If a user skips them, they hit the onboarding wizard with empty fields and no TDEE calculation is possible.
Fix: make them required, or add a graceful empty-state in Onboarding that explains why they're needed.

**2. Branding — LucaEats still leaks**
Register.jsx line 107: "Política de privacidad de LucaEats" in the terms checkbox.
Likely more instances. Do a full grep for "LucaEats" across client/ and worker/.

**3. MIN_WEEK_START hardcoded gate**
`const MIN_WEEK_START = '2026-03-23'` in assistant.js prevents digest generation before that date.
After the week of March 23 passes and first digests generate successfully, remove this constant
and the guard — it becomes dead code.

### Medium priority

**4. No production error visibility**
When the assistant route throws, D1 queries fail silently, or Stripe webhooks break —
there's no alert. Find out from user complaints, not monitoring.
Fix: Cloudflare Workers Logpush or a lightweight error beacon. Even structured console.error
with enough context would help filter Worker logs.

**5. Auth rate limiting — verify table exists**
The code is correct and fails open safely (won't block users if table is missing).
But if `auth_attempts` was never created in D1, brute-force protection is inactive.
Fix: run `CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);` in D1 CLI and confirm.

### Low priority / not blocking

**D1 limitations**
Not a production problem. The issues encountered (multi-statement SQL in web console, PRAGMA)
are developer experience quirks, fully worked around with `wrangler d1 execute --file`.
At current scale D1 is the right choice. Reassess if user base grows to tens of thousands.

**Worker deploy is manual**
Frontend auto-deploys on `git push`. Worker requires `cd worker && npm run deploy`.
Risk: shipping a frontend that calls an API endpoint not yet deployed on the worker.
Fix (optional): add a GitHub Action that runs `wrangler deploy` on push to main when
files under `worker/` change.

---

## Pricing & Conversion 💰

**Current state**
- Free: 3 AI analyses/day, no assistant
- Pro: $1.99/month — unlimited AI analyses, full assistant, weekly digest
- Founders: lifetime Pro access (early users)

**The conversion problem**
The app has strong features at $1.99 — arguably underpriced. But the Free→Pro moment
is unclear. What specific wall does a Free user hit that makes them want to upgrade?

- 3 AI analyses/day may be enough for casual users (they never hit the limit)
- The assistant is Pro-only but Free users may not know what they're missing
- There's no in-app demo or preview of the assistant for Free users

**Way to proceed**
1. Audit the upgrade trigger: add logging to see how often Free users hit the 3/day AI limit.
   That's the only natural upgrade moment today.
2. Consider a "taste" of the assistant for Free users — e.g. 1 assistant message/day.
   Let them see the pattern analysis, then hit a soft wall.
3. Consider raising price to $3.99 or $4.99. At $1.99 the LTV is very low and
   the calibration + assistant system is worth more. Underpricing signals low quality.
4. The weekly digest is a strong retention hook for Pro but invisible to Free users.
   Surface it: "Pro users get a weekly analysis of their patterns" with a sample in the upgrade page.


E2E tests (Phase 3.3) — the last quality roadmap item, dedicated session

OG image — design task, not code
Calibration Engine V2 — waiting for more user data (~500 corrections)

iOS native app — blocked until everything above is solid