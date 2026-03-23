# Caliro API Documentation

**Base URL:** `https://calorie-app-api.lucatuille.workers.dev`

All responses are JSON. All mutations require `Authorization: Bearer <token>`.

---

## Auth

### POST /api/auth/register
Creates a new user account.
```json
// Request
{ "name": "Luca", "email": "luca@test.com", "password": "12345678" }

// Response 201
{ "token": "eyJ...", "user": { "id": 1, "name": "Luca", "email": "luca@test.com", "access_level": 3, "onboarding_completed": 0, "age": null, "weight": null, "height": null, "gender": null } }

// Error 400: missing fields, password < 8 chars, duplicate email
```

### POST /api/auth/login
```json
// Request
{ "email": "luca@test.com", "password": "12345678" }

// Response 200
{ "token": "eyJ...", "user": { "id": 1, "name": "Luca", ..., "target_calories": 2000, "target_protein": 150, ... } }

// Error 401: wrong credentials
// Error 429: too many attempts
```

### POST /api/auth/refresh
Exchange valid token for a fresh one. No body needed.
```
Authorization: Bearer <token>

// Response 200
{ "token": "eyJ...", "user": { ... } }

// Error 401: invalid/expired token
```

---

## Entries

### POST /api/entries
```json
// Request
{ "calories": 500, "protein": 30, "carbs": 50, "fat": 20, "meal_type": "lunch", "name": "Pollo con arroz", "date": "2026-03-20" }

// date is optional — defaults to today
// calories is required

// Response 201
{ "id": 42, "calories": 500, "protein": 30, "carbs": 50, "fat": 20, "meal_type": "lunch", "name": "Pollo con arroz", "date": "2026-03-20" }
```

### GET /api/entries/today
Returns all entries for today.
```json
// Response 200
[{ "id": 42, "calories": 500, ... }, ...]
```

### GET /api/entries?limit=90
Returns recent entries (default limit 90).

### PUT /api/entries/:id
Update an entry. Same fields as POST (except date).

### DELETE /api/entries/:id
Delete an entry.

---

## Profile

### GET /api/profile
Returns full user profile including TDEE, macros, calibration data.

### PUT /api/profile
```json
// Request — all fields optional, COALESCE preserves existing TDEE fields
{ "name": "Luca", "age": 30, "weight": 75, "height": 180, "gender": "male", "target_calories": 2000, "target_protein": 150, "target_carbs": 200, "target_fat": 67, "tdee": 2200, "onboarding_completed": 1 }
```

---

## Progress

### GET /api/progress/summary
Returns 30-day aggregates, streak, averages, weight trend.

### GET /api/progress/chart?days=7
Returns daily calorie/macro/weight totals. Days: 7, 30, or 90.

### GET /api/progress/advanced?period=month
Returns deep analytics: projection, day-of-week patterns, meal type breakdown, adherence.
Periods: week, month, 90days. **Requires Pro access.**

---

## AI Analysis

### POST /api/analyze
Photo analysis with Claude Vision.
```json
{ "image": "<base64>", "mediaType": "image/jpeg", "context": "casero, 200g", "meal_type": "lunch", "photo_location": "casa", "photo_plate_size": "normal", "date": "2026-03-20" }
```
Rate limited by access level. Pro: Sonnet (first 3/day), then Haiku. Free: Haiku only (3/day).

### POST /api/entries/analyze-text
Text analysis with Claude.
```json
{ "text": "150g pechuga plancha con ensalada", "meal_type": "lunch", "date": "2026-03-20" }
```

---

## Supplements

### GET /api/supplements
### POST /api/supplements
### PUT /api/supplements/:id
### DELETE /api/supplements/:id
### POST /api/supplements/:id/toggle

---

## Calibration

### POST /api/calibration/correction
Save AI correction for calibration engine. **Requires Pro.**

### GET /api/calibration/profile
Get user's calibration profile (bias, factors).

---

## Assistant

### POST /api/assistant/chat
```json
{ "message": "¿Cuántas calorías llevo hoy?", "conversation_id": 42, "is_intro": false }
```
**Requires Pro.** Rate limited per access level.

### GET /api/assistant/conversations
List user's conversations.

### GET /api/assistant/conversations/:id
Get messages for a conversation.

---

## Stripe

### POST /api/create-checkout-session
### POST /api/stripe-webhook
### GET /api/subscription-status

---

## Health

### GET /api/health
```json
{ "status": "ok", "timestamp": "2026-03-23T20:00:00.000Z" }
```
