# Feature: Add Past Meals from History

## Overview
Users can add meals to past days from the History page. A green "+" button appears on each
day header. Tapping it opens an **independent** add-meal flow (not the Calculator page) that
is visually identical but scoped to a specific date.

## Architecture Decision: Independent Component
The existing Calculator.jsx is tightly coupled to "today":
- Fetches today's entries on mount
- Shows today's running total
- Uses `getDefaultMealType()` based on current hour
- Shows live calorie counter against daily target
- Renders the full list of today's meals below the form

Modifying Calculator to accept an optional date would require conditionalizing ~15 behaviors
and risk regressions. Instead, we create a **PastMealRegistrar** — a lightweight overlay/modal
that reuses the same form UI and AI analysis but is date-aware from the start.

## What PastMealRegistrar Does
1. Receives `targetDate` (YYYY-MM-DD string) and `onClose` callback as props
2. Shows a banner: "Añadiendo comida para **Sábado 22 mar**"
3. Offers the same 3 methods: Photo IA, Escanear, Describir
4. Form fields: meal_type pills, name, calories, protein, carbs, fat, notes
5. Calls `api.saveEntry({ ..., date: targetDate })` — backend already accepts `date` param
6. On save: calls `onClose(true)` so History reloads
7. Does NOT show today's running total or today's entry list (irrelevant for past days)
8. `getDefaultMealType()` → always 'other' (can't infer from current hour for past dates)

## What Stays Unchanged
- Calculator.jsx — zero changes, keeps working exactly as today
- Dashboard.jsx — its "+" button keeps navigating to /app/register (Calculator)
- POST /api/entries — already accepts optional `date` field
- Progress calculations — use `entry.date` field, not `created_at`
- Streaks — detect consecutive days from entries, adding old entries fills gaps correctly
- Assistant — hardcoded to "today" context, stays that way

## Changes Required

### 1. client/src/components/PastMealRegistrar.jsx (NEW)
- Modal/overlay component
- Props: `targetDate`, `onClose`, `token`
- Contains: method tabs (photo/scan/text), form, save button
- Reuses: TextAnalyzer, BarcodeScanner (pass `targetDate` to TextAnalyzer)
- Passes `date: targetDate` to `api.saveEntry()`
- Photo analysis: works as-is (rate limit counts against today — correct)
- Text analysis: passes `targetDate` so backend uses correct day-of-week for calibration

### 2. client/src/pages/History.jsx
- Import PastMealRegistrar
- State: `addingForDate` (null or YYYY-MM-DD string)
- Green "+" button on each day header (same style as Dashboard's button)
- When clicked: `setAddingForDate(date)`
- Renders `<PastMealRegistrar targetDate={addingForDate} onClose={...} />`
- On close with save: reload entries

### 3. client/src/components/TextAnalyzer.jsx
- Accept optional `date` prop
- Pass to `api.analyzeText({ ..., date })` so backend can use correct day-of-week

### 4. worker/src/routes/analyze.js (minor)
- Text analysis: accept optional `date` from request body
- Use it for `isWeekend` calculation instead of `new Date().getDay()`
- If not provided, fall back to current date (backwards compatible)

### 5. client/src/api.js
- `saveEntry` already passes body as-is — just include `date` in the object
- No changes needed

## Date Flow
```
History.jsx
  └── addingForDate = "2026-03-21"
       └── PastMealRegistrar(targetDate="2026-03-21")
            ├── Photo AI → analyzePhoto() → rate limit uses TODAY (correct)
            ├── Text AI  → analyzeText({ date: "2026-03-21" }) → isWeekend uses entry date
            ├── Scan     → BarcodeScanner → no date needed (just nutrition lookup)
            └── Save     → api.saveEntry({ ..., date: "2026-03-21" })
```

## UI Flow
```
History page
├── Hoy · 3 comidas           380 kcal    [+]
│   └── entries...
├── Ayer · 2 comidas           450 kcal    [+]  ← click
│   └── entries...
│
│   ┌─────────────────────────────────────┐
│   │  Añadiendo comida para Sábado 22 mar│
│   │  [Foto IA] [Escanear] [Describir]  │
│   │  [meal type pills]                  │
│   │  [name] [calories] [macros]         │
│   │  [Guardar]              [Cancelar]  │
│   └─────────────────────────────────────┘
```

## Risk Assessment
- **LOW**: Calculator.jsx untouched — no regression risk
- **LOW**: Backend already accepts `date` — no migration needed
- **LOW**: Progress/streaks use `entry.date` — past entries slot in correctly
- **MEDIUM**: PastMealRegistrar duplicates some UI from Calculator — but this is intentional
  isolation. The alternative (sharing via props) creates fragile coupling.
- **LOW**: AI rate limiting counts against today regardless — prevents abuse, simple
