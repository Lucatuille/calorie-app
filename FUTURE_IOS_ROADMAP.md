# Caliro — iOS App Roadmap

This document covers everything needed to bring Caliro to the App Store.
It is intentionally detailed — meant to be read before writing a line of mobile code,
and used as a checklist during the build.

---

## 0. Strategic Decisions (resolve before building anything)

These are not technical tasks. They are business decisions that determine how the
entire app is built. Getting them wrong after the fact is expensive.

### 0.1 Payment Strategy

- [ ] **Decide: Apple IAP vs External Payment (Stripe)**

  Apple mandates that any in-app purchase of digital features on iOS must go through
  Apple In-App Purchase (IAP). Stripe inside the app is not allowed. There are two
  valid paths:

  **Option A — Accept Apple IAP**
  - User subscribes directly inside the app, Apple handles payment
  - Apple takes 30% (15% after first year via Small Business Program)
  - At $1.99/month → ~$1.69 effective revenue per iOS user
  - You would raise the iOS price to $2.99 to preserve margins
  - Pros: seamless UX, higher conversion, simpler implementation
  - Cons: margin hit, different price on iOS vs web (legal but potentially confusing)
  - Implementation: StoreKit 2 (native) or `react-native-purchases` (RevenueCat wrapper)

  **Option B — External Payment Only (Stripe, no IAP)**
  - No subscription option inside the app at all
  - App shows a screen that says "Subscribe at caliro.dev" with a link
  - User subscribes on the web via Stripe, then logs in on iOS and gets Pro access
  - This is how Spotify and Netflix operate on iOS
  - Pros: keep 100% of Stripe revenue, existing Stripe infrastructure unchanged
  - Cons: significant friction for new users who discover the app on the App Store,
    lower conversion rate, Apple still requires you do not mention the price
    difference between platforms inside the app
  - Note: since Epic v. Apple (US, 2024) and EU DMA, you ARE allowed to include
    a link to your external purchase page. You cannot say "cheaper here" but
    you can say "subscribe on our website"

  **Recommendation for current scale:** Option A at $2.99/month on iOS.
  RevenueCat handles the IAP complexity and provides a unified subscription
  management dashboard across iOS and web.

- [ ] **Decide: Unified pricing or platform-specific pricing**
  - Web: $1.99/month (Stripe)
  - iOS Option A: $2.99/month (IAP, absorbs Apple cut)
  - iOS Option B: same $1.99 (external link to web)
  - Document this decision — it affects the upgrade screen copy and legal terms

- [ ] **Set up RevenueCat account (if choosing IAP)**
  - RevenueCat abstracts StoreKit 2 complexity
  - Free up to $2,500/month tracked revenue
  - Handles receipt validation, subscription status sync, webhooks
  - Can coexist with Stripe — unified entitlement check across platforms

### 0.2 App Identity

- [ ] **Register Apple Developer Account** ($99/year)
- [ ] **Register App Bundle ID** (`dev.caliro.app` or similar) in Apple Developer portal
- [ ] **Decide: new Expo project or monorepo with shared packages**
  - Recommended: monorepo with a `mobile/` directory alongside `client/` and `worker/`
  - Shared packages: `api.js`, utils, constants — extracted to a `shared/` package
  - Each platform imports from `shared/` — one source of truth for API calls

---

## 1. Infrastructure Preparation (backend changes)

The Cloudflare Worker API requires minimal changes. All existing endpoints work
as-is. These are the additions needed specifically for mobile.

### 1.1 Device Push Token Storage

- [ ] **Add `device_tokens` table to D1**
  ```sql
  CREATE TABLE IF NOT EXISTS device_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'ios',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, token)
  );
  ```
- [ ] **Add POST /api/device-token endpoint** — saves the Expo push token for a user
- [ ] **Add DELETE /api/device-token endpoint** — called on logout to unregister

### 1.2 Push Notification Triggers

- [ ] **Add Cloudflare Cron Trigger** in `wrangler.toml`
  ```toml
  [[triggers.crons]]
  cron = "0 9 * * 1"  # Every Monday at 09:00 UTC
  ```
- [ ] **Implement `scheduled` handler** in `worker/src/index.js`
  - Fetches all Pro users with active device tokens
  - Sends weekly digest push notification via Expo Push API
  - Expo Push API is free and wraps APNs — no direct APNs setup needed
- [ ] **Weekly digest notification copy**
  - Title: "Tu resumen de la semana"
  - Body: one-line teaser from the digest (first sentence of first point)

### 1.3 Subscription Status Endpoint (if using IAP)

- [ ] **Add RevenueCat webhook handler** in the worker
  - RevenueCat sends webhooks on subscription events (new, renewal, cancellation)
  - Update `access_level` in D1 accordingly — same column already used by Stripe
  - Existing `requireProAccess()` logic works unchanged

---

## 2. Expo Project Setup

### 2.1 Initialize

- [ ] **Create Expo project** with `npx create-expo-app mobile --template`
  - Use the blank TypeScript template
  - Place under `mobile/` in the monorepo root
- [ ] **Install Expo EAS CLI** — `npm install -g eas-cli`
- [ ] **Configure `app.json`**
  - `bundleIdentifier`: matches the Apple Developer portal bundle ID
  - `version`: `1.0.0`
  - `ios.supportsTablet`: `false` (phone-only for v1)
  - Icons: 1024×1024 PNG (Expo generates all required sizes)
  - Splash screen: Caliro brand colors
- [ ] **Configure EAS Build** — `eas build:configure`
  - This creates `eas.json` with development/preview/production profiles
- [ ] **Set up Expo EAS secrets** (equivalent of Cloudflare Worker secrets)
  - `SENTRY_DSN` (mobile)
  - `API_URL` (Worker URL)
  - RevenueCat public key (if using IAP)

### 2.2 Navigation

- [ ] **Install React Navigation**
  ```bash
  npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
  ```
- [ ] **Design the navigation structure**
  - Bottom tabs: Dashboard, Historial, Asistente, Perfil (same 4 as web BottomNav)
  - Stack navigator inside each tab for detail screens
  - Modal stack for: Add Entry, Camera, Onboarding, Upgrade
  - The web app uses React Router — React Navigation is a different mental model
    (screens are pushed onto a stack, not rendered by URL) but the same conceptual structure

### 2.3 Styling System

- [ ] **Define a StyleSheet constants file** (`mobile/src/styles/theme.ts`)
  - CSS variables don't exist in React Native — replicate them as JS constants
  - Colors: `accent`, `bg`, `surface`, `border`, `textPrimary`, `textSecondary`
  - Typography: define font sizes, weights, line heights
  - Spacing: define a spacing scale (4, 8, 12, 16, 20, 24, 32...)
  - Border radius: `md`, `lg`, `full`
- [ ] **Load custom fonts** via `expo-font`
  - Instrument Serif (italic, used for hero numbers and headings)
  - Plus Jakarta Sans (body text)
  - Same fonts as web — already have the files or load from Google Fonts
- [ ] **Implement dark mode** via `useColorScheme()` hook
  - Reads system dark/light preference automatically
  - Use a ThemeContext that provides the right color set

---

## 3. Business Logic Port (shared code)

This is the highest-value work — done once, used by both web and mobile.

### 3.1 API Layer

- [ ] **Extract `api.js` to a shared package** or copy to `mobile/src/api.ts`
  - Replace `fetch` calls — React Native has `fetch` natively, no changes needed
  - Replace `import.meta.env.VITE_API_URL` with `process.env.EXPO_PUBLIC_API_URL`
  - All endpoint functions stay identical
- [ ] **Update the 401 handler** — instead of calling a logout function, navigate to
  the login screen using React Navigation's navigation ref

### 3.2 Auth Context

- [ ] **Port `AuthContext.jsx` to React Native**
  - Replace `localStorage` with `expo-secure-store`
    ```ts
    await SecureStore.setItemAsync('token', token);
    await SecureStore.getItemAsync('token');
    await SecureStore.deleteItemAsync('token');
    ```
  - JWT refresh logic stays identical
  - Sentry.setUser() calls stay identical
  - Add: save/clear device push token on login/logout

### 3.3 Utilities

- [ ] Port `utils/tdeeCalculator.js` — pure functions, no changes needed
- [ ] Port `utils/meals.js` — pure constants, no changes needed
- [ ] Port `utils/levels.js` — pure functions, no changes needed
- [ ] Port `data/whatsNew.js` — not needed on mobile (What's New is handled by App Store release notes)

---

## 4. Core Screens

Build in this order — each one is usable before the next is built.

### 4.1 Auth Screens

- [ ] **Login screen**
  - Email + password inputs, login button
  - "Forgot password" (not currently implemented on web — skip for v1)
  - Navigate to Onboarding if `!user.onboarding_completed`, else to Dashboard
- [ ] **Register screen**
  - Name, email, password, age, weight, height, gender
  - Same required fields as the updated web registration
  - On success: set Sentry user, navigate to Onboarding

### 4.2 Onboarding

- [ ] **Port Onboarding flow** (3 steps: goal → bio data → projection)
  - Pre-fill bio data from registration (same logic as web)
  - Step 3 shows the TDEE calculation result before saving
  - On complete: navigate to Dashboard

### 4.3 Dashboard

- [ ] **Main calories ring / progress bar**
- [ ] **Today's macro summary** (protein, carbs, fat)
- [ ] **Meal list for today** grouped by meal type
- [ ] **Add Entry button** → opens modal (text input, camera, barcode — Phase 5)
- [ ] **Streak display**
- [ ] **Supplement tracker** (same toggle list as web)

### 4.4 History

- [ ] **Grouped list by date** (same as web History page)
- [ ] **Swipe to delete** entry (native gesture, better than web)
- [ ] **Tap entry to edit**

### 4.5 Progress

- [ ] **Calorie chart** (7/14/30 days) — use `react-native-svg` + `victory-native` or
  `react-native-gifted-charts` (replaces Recharts which is web-only)
- [ ] **Macro summary cards**
- [ ] **Advanced analytics bottom sheet** — same data, native bottom sheet via
  `@gorhom/bottom-sheet`

### 4.6 Assistant (Pro)

- [ ] **Chat interface** — FlatList with inverted scroll (standard pattern for chat)
- [ ] **Conversation history** — bottom sheet listing past conversations
- [ ] **Weekly digest card** — rendered as a native card at the top, same content
- [ ] **Pro gate** — same access level check, navigate to Upgrade screen if Free

### 4.7 Profile

- [ ] **Edit profile** (weight, height, age, gender)
- [ ] **Recalculate TDEE** — opens the TDEE wizard (same 3-step flow as Onboarding)
- [ ] **Subscription status** — shows current plan, upgrade/manage button
- [ ] **Export CSV** — uses `expo-sharing` to share the file
- [ ] **Logout**

### 4.8 Upgrade Screen

- [ ] **Features list** (same as web Upgrade page)
- [ ] **Subscribe button**
  - If IAP: triggers StoreKit purchase flow via RevenueCat
  - If external: opens `caliro.dev/upgrade` in Safari via `Linking.openURL()`
- [ ] **Restore purchases button** (required by App Store review for IAP apps)

---

## 5. Native Features

### 5.1 Image Analysis (Photo → Claude)

- [ ] **Install `expo-image-picker`** and **`expo-image-manipulator`**
- [ ] **Request camera and photo library permissions**
  - Add to `app.json`:
    ```json
    "infoPlist": {
      "NSCameraUsageDescription": "Caliro usa la cámara para analizar tus comidas",
      "NSPhotoLibraryUsageDescription": "Caliro accede a tu galería para analizar fotos de comidas"
    }
    ```
- [ ] **Implement image compression before upload**
  - Resize to max 1200px width, quality 0.7 via `expo-image-manipulator`
  - Mobile cameras produce 8-12MB images — Worker has a 2MB limit
  - After compression: typically 200-400KB, well within limits
- [ ] **Connect to existing `/api/analyze` endpoint** — base64 payload is identical

### 5.2 Barcode Scanner

- [ ] **Install `expo-barcode-scanner`** (or use the camera with `onBarcodeScanned`)
- [ ] **Replace `html5-qrcode` logic** — same Open Food Facts API call, different
  scanner component
- [ ] **Handle camera permission** — same permission as photo analysis if using
  `expo-camera` for both

### 5.3 Text Analysis

- [ ] **Text input modal** with keyboard-aware scroll (`KeyboardAvoidingView`)
- [ ] **Connect to existing `/api/entries/analyze-text` endpoint** — identical

### 5.4 Push Notifications

- [ ] **Install `expo-notifications`**
- [ ] **Request notification permission** on first Pro upgrade
  - Do NOT ask on app launch — ask contextually after upgrade
- [ ] **Register device token** and send to `/api/device-token`
- [ ] **Handle notification tap** — deep link to the Assistant screen
- [ ] **Local notifications** (optional, v2): daily reminder to log meals
  - Scheduled locally on device, no backend needed

### 5.5 Face ID / Biometric Lock (optional, v2)

- [ ] Install `expo-local-authentication`
- [ ] Optional setting in Profile: "Require Face ID to open"
- [ ] Gate the app behind biometric check on foreground resume

---

## 6. Sentry Mobile Integration

- [ ] **Install `@sentry/react-native`**
- [ ] **Create third Sentry project**: `caliro-ios` in the same org as `caliro-worker`
  and `caliro-frontend`
- [ ] **Initialize in `App.tsx`** with the new DSN
- [ ] **Add `Sentry.setUser()`** in AuthContext after login (same as web)
- [ ] **Configure source maps upload** in EAS Build — allows Sentry to show
  readable stack traces instead of minified code
- [ ] All three platforms (web, worker, iOS) will now appear in one Sentry org,
  errors correlated by user ID

---

## 7. App Store Submission

### 7.1 Assets

- [ ] **App icon** — 1024×1024 PNG, no transparency, no rounded corners
  (App Store applies rounding). Expo generates all required sizes automatically.
- [ ] **Screenshots** — required for iPhone 6.7" (iPhone 15 Pro Max) and 6.5"
  - At minimum: 3 screenshots showing Dashboard, Add Entry, Assistant
  - Optional: 5-6 screenshots with feature callouts
  - Tools: screenshot in simulator, add text overlays in Figma
- [ ] **App Preview video** (optional but increases conversion)
- [ ] **App Store description**
  - Short description (30 chars): "Seguimiento nutricional con IA"
  - Full description: highlight calibration engine, assistant, weekly digest
  - Keywords (100 chars): calorías, macros, nutrición, dieta, IA, proteína...
- [ ] **Privacy Policy URL** — `caliro.dev/privacy` (already exists)

### 7.2 App Store Review Checklist

- [ ] **No medical claims** — review all copy for language that could be interpreted
  as medical advice. Acceptable: "tracks your calories". Not acceptable: "helps you
  lose weight safely" with specific claims.
- [ ] **Restore Purchases button** — required if using IAP. Apple will reject without it.
- [ ] **Privacy nutrition label** — declare what data you collect in App Store Connect
  - Data linked to identity: email, health/fitness data (calories, weight)
  - Data not linked: usage data (analytics)
- [ ] **Age rating** — 4+ (no objectionable content). The AI assistant responses
  need to stay factual and neutral to maintain this rating.
- [ ] **HTTPS only** — all API calls already go to the Worker over HTTPS ✓
- [ ] **No private API usage** — standard Expo/React Native stack is clean ✓
- [ ] **Permissions justification** — camera and photo library permissions must have
  clear, honest descriptions in `app.json` that match actual usage

### 7.3 TestFlight

- [ ] **Build and upload via EAS**: `eas build --platform ios --profile production`
- [ ] **Add internal testers** (yourself, up to 25 people) via App Store Connect
- [ ] **Test the full flow**: register → onboarding → add entry → photo analysis →
  assistant → upgrade (if IAP) → restore purchase
- [ ] **Test on a real device** — simulator does not have camera, biometrics are
  limited, and push notifications don't work
- [ ] **Minimum beta period**: 1 week before submitting for App Store review

### 7.4 Submission

- [ ] Submit for App Store Review via App Store Connect
- [ ] First review typically takes 1-3 days
- [ ] Be prepared for rejection: read the rejection reason carefully,
  common first-time issues are metadata (description claims), missing
  restore purchases, or privacy label mismatch
- [ ] After approval: choose manual or automatic release

---

## 8. Post-Launch

- [ ] **Monitor Sentry `caliro-ios`** for crash reports in the first 48 hours
- [ ] **Check RevenueCat dashboard** (if IAP) for subscription conversions
- [ ] **Respond to App Store reviews** — Apple surfaces responsiveness in ranking
- [ ] **Set up `caliro-ios` Sentry alerts** same as the other two projects
- [ ] **Remove `MIN_WEEK_START` gate** from `worker/src/routes/assistant.js`
  once the weekly digest is confirmed working (this applies to web too)

---

## Effort Estimate

| Phase | Description | Effort |
|---|---|---|
| 0 | Strategic decisions + Apple account | 1 day |
| 1 | Backend additions (push tokens, cron) | 1 day |
| 2 | Expo setup + navigation + theme | 2 days |
| 3 | Business logic port (api, auth, utils) | 1 day |
| 4 | Core screens (all 8) | 2–3 weeks |
| 5 | Native features (camera, barcode, push) | 1 week |
| 6 | Sentry mobile | half day |
| 7 | App Store assets + submission | 2–3 days |
| 8 | TestFlight + review cycle | 1–2 weeks |
| **Total** | | **~6–8 weeks solo** |

The biggest time sink is Phase 4 (screens). The backend and business logic port
are fast because the architecture is already clean. Plan for the App Store review
cycle to take longer than expected — build in buffer.

---

## Key Dependencies Summary

| Library | Replaces | Purpose |
|---|---|---|
| `expo` | — | Build toolchain, managed workflow |
| `@react-navigation/native` | React Router | Navigation |
| `expo-secure-store` | localStorage | JWT storage |
| `expo-image-picker` | HTML file input | Photo selection |
| `expo-image-manipulator` | — | Image compression before upload |
| `expo-barcode-scanner` | html5-qrcode | Barcode scanning |
| `expo-notifications` | — | Push notifications |
| `expo-font` | CSS @font-face | Custom fonts |
| `victory-native` or `react-native-gifted-charts` | Recharts | Charts |
| `@gorhom/bottom-sheet` | CSS bottom sheet | Native bottom sheets |
| `react-native-purchases` | Stripe (iOS only) | RevenueCat IAP wrapper |
| `@sentry/react-native` | @sentry/react | Error monitoring |

Everything on the backend (Cloudflare Workers, D1, Stripe for web, Anthropic)
remains unchanged.
