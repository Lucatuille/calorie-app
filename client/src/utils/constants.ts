// ============================================================
//  Shared constants — single source of truth for magic numbers
// ============================================================

// ── Adherence ────────────────────────────────────────────────
export const ADHERENCE_TOLERANCE = 250; // kcal ± from target

// ── Meal hour ranges (for auto-detecting meal type) ──────────
export const MEAL_HOURS: Record<string, [number, number]> = {
  breakfast: [6, 11],
  lunch:     [11, 16],
  snack:     [16, 20],
  dinner:    [20, 24],
};

// ── Photo processing ─────────────────────────────────────────
export const MAX_IMAGE_PX      = 900;   // resize before upload
export const JPEG_QUALITY      = 0.75;  // compression quality (~25% más pequeño que 0.82, sin pérdida visual perceptible para análisis IA)

// ── Text analysis ────────────────────────────────────────────
export const MAX_TEXT_LENGTH    = 500;   // characters

// ── Supplements ──────────────────────────────────────────────
export const MAX_SUPPLEMENTS   = 20;
