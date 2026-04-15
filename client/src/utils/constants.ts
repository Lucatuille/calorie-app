// ============================================================
//  Shared constants — single source of truth for magic numbers
// ============================================================

// ── Adherence ────────────────────────────────────────────────
export const ADHERENCE_TOLERANCE = 250; // kcal ± from target

// ── Meal hour ranges (for auto-detecting meal type) ──────────
// Alineadas con worker/src/utils/mealTypeInfer.js (Europe/Madrid).
// Antes: breakfast 6-11. Causaba bug — desayunos a las 11h se
// guardaban como 'lunch' y luego Chef no los detectaba al filtrar.
export const MEAL_HOURS: Record<string, [number, number]> = {
  breakfast: [6, 12],   // desayuno tardío español hasta antes de las 12
  lunch:     [12, 16],
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
