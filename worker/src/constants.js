// ============================================================
//  Shared constants — single source of truth for magic numbers
// ============================================================

// ── Adherence ────────────────────────────────────────────────
export const ADHERENCE_TOLERANCE = 250; // kcal ± from target

// ── Text analysis ────────────────────────────────────────────
export const MAX_TEXT_LENGTH = 500; // characters

// ── Calibration engine ───────────────────────────────────────
export const CALIBRATION_DECAY       = 0.97;  // per-day weight decay (half-life ~23 days)
export const CALIBRATION_MIN_POINTS  = 3;     // minimum corrections before applying factor
export const CALIBRATION_CAP_LOW     = 0.75;  // minimum multiplier
export const CALIBRATION_CAP_HIGH    = 1.4;   // maximum multiplier

// ── AI rate limits ───────────────────────────────────────────
export const SONNET_PHOTO_DAILY_LIMIT    = 3;
export const SONNET_ASSISTANT_DAILY_LIMIT = 1;
