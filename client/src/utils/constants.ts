// ============================================================
//  Shared constants — single source of truth for magic numbers
// ============================================================

// ── Adherence ────────────────────────────────────────────────
export const ADHERENCE_TOLERANCE = 250; // kcal ± from target

// ── Meal hour ranges (for auto-detecting meal type) ──────────
// Alineadas con worker/src/utils/mealTypeInfer.js (Europe/Madrid).
// Ventanas para default del form Calculator. Deben sincronizarse con
// worker/src/utils/mealTypeInfer.js (inferFromHour) para que el backend
// y el cliente coincidan al clasificar entries por hora.
// 2026-04-17: breakfast ampliado a 13:00 (desayuno tardío / media mañana
// español). Antes era 12 y un desayuno a las 12:30 defaulteaba a 'lunch'
// → Chef no detectaba el slot y regeneraba desayuno.
export const MEAL_HOURS: Record<string, [number, number]> = {
  breakfast: [6, 13],   // desayuno hasta antes de las 13 (patrón ES)
  lunch:     [13, 16],
  snack:     [16, 19],
  dinner:    [19, 24],
};

// ── Photo processing ─────────────────────────────────────────
export const MAX_IMAGE_PX      = 900;   // resize before upload
export const JPEG_QUALITY      = 0.75;  // compression quality (~25% más pequeño que 0.82, sin pérdida visual perceptible para análisis IA)

// ── Text analysis ────────────────────────────────────────────
export const MAX_TEXT_LENGTH    = 500;   // characters

// ── Supplements ──────────────────────────────────────────────
export const MAX_SUPPLEMENTS   = 20;
