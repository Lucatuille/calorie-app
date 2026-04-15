import { describe, it, expect } from 'vitest';
import {
  calculateCalibrationProfile,
  applyCalibration,
  findSimilarMeal,
  updateFrequentMeals,
} from '../calibration.js';

// ── Helper: create a mock correction ───────────────────────
function mockCorrection({
  ai_calibrated = 500,
  user_final = 500,
  accepted_without_change = false,
  meal_type = 'lunch',
  food_categories = '[]',
  is_weekend = 0,
  created_at = new Date().toISOString(),
} = {}) {
  return {
    ai_calibrated, user_final, accepted_without_change: accepted_without_change ? 1 : 0,
    meal_type, food_categories, is_weekend, created_at,
  };
}

// ── calculateCalibrationProfile ────────────────────────────
describe('calculateCalibrationProfile', () => {
  it('returns zero profile for empty corrections', () => {
    const p = calculateCalibrationProfile([]);
    expect(p.global_bias).toBe(0);
    expect(p.confidence).toBe(0);
    expect(p.data_points).toBe(0);
  });

  it('returns zero profile for null', () => {
    const p = calculateCalibrationProfile(null);
    expect(p.global_bias).toBe(0);
  });

  it('calculates positive bias when user consistently adds calories', () => {
    const corrections = Array.from({ length: 5 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 600 })
    );
    const p = calculateCalibrationProfile(corrections);
    expect(p.global_bias).toBeGreaterThan(0);
  });

  it('calculates negative bias when user consistently reduces calories', () => {
    const corrections = Array.from({ length: 5 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 400 })
    );
    const p = calculateCalibrationProfile(corrections);
    expect(p.global_bias).toBeLessThan(0);
  });

  it('zero bias when all corrections accepted without change', () => {
    const corrections = Array.from({ length: 5 }, () =>
      mockCorrection({ accepted_without_change: true })
    );
    const p = calculateCalibrationProfile(corrections);
    expect(p.global_bias).toBe(0);
  });

  it('dampens bias after 5 consecutive accepted-without-change', () => {
    // First: user corrected upward
    const old = Array.from({ length: 3 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 600, created_at: '2026-01-01T12:00:00Z' })
    );
    // Then: 5 consecutive accepted (AI is now accurate)
    const recent = Array.from({ length: 5 }, () =>
      mockCorrection({ accepted_without_change: true })
    );
    // corrections come DESC (most recent first)
    const p = calculateCalibrationProfile([...recent, ...old]);
    // Bias should be dampened (halved at least once)
    const pNoRecent = calculateCalibrationProfile(old);
    expect(Math.abs(p.global_bias)).toBeLessThan(Math.abs(pNoRecent.global_bias));
  });

  it('confidence increases with more corrections', () => {
    const few = Array.from({ length: 2 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 550 })
    );
    const many = Array.from({ length: 10 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 550 })
    );
    const pFew  = calculateCalibrationProfile(few);
    const pMany = calculateCalibrationProfile(many);
    expect(pMany.confidence).toBeGreaterThan(pFew.confidence);
  });

  it('confidence maxes at 1', () => {
    const lots = Array.from({ length: 50 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 550 })
    );
    const p = calculateCalibrationProfile(lots);
    expect(p.confidence).toBeLessThanOrEqual(1);
  });

  it('builds meal_factors when >= 3 corrections for a meal type', () => {
    const corrections = Array.from({ length: 4 }, () =>
      mockCorrection({ meal_type: 'dinner', ai_calibrated: 500, user_final: 600 })
    );
    const p = calculateCalibrationProfile(corrections);
    expect(p.meal_factors).toHaveProperty('dinner');
    expect(p.meal_factors.dinner.samples).toBe(4);
  });

  it('does not build meal_factors with < 3 corrections', () => {
    const corrections = Array.from({ length: 2 }, () =>
      mockCorrection({ meal_type: 'breakfast', ai_calibrated: 500, user_final: 600 })
    );
    const p = calculateCalibrationProfile(corrections);
    expect(p.meal_factors).not.toHaveProperty('breakfast');
  });

  it('builds food_factors with normalized categories', () => {
    const corrections = Array.from({ length: 3 }, () =>
      mockCorrection({
        ai_calibrated: 500, user_final: 600,
        food_categories: '["grilled_chicken", "rice"]',
      })
    );
    const p = calculateCalibrationProfile(corrections);
    // "grilled_chicken" normalizes to "pollo"
    expect(p.food_factors).toHaveProperty('pollo');
  });

  it('detects weekend time factor when weekend vs weekday differ', () => {
    const weekday = Array.from({ length: 3 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 500, is_weekend: 0 })
    );
    const weekend = Array.from({ length: 3 }, () =>
      mockCorrection({ ai_calibrated: 500, user_final: 650, is_weekend: 1 })
    );
    const p = calculateCalibrationProfile([...weekend, ...weekday]);
    expect(p.time_factors.weekend_extra).toBeGreaterThan(0);
  });

  it('data_points counts all corrections', () => {
    const corrections = Array.from({ length: 7 }, () => mockCorrection());
    const p = calculateCalibrationProfile(corrections);
    expect(p.data_points).toBe(7);
  });
});

// ── applyCalibration ───────────────────────────────────────
describe('applyCalibration', () => {
  it('returns base estimate when profile is null', () => {
    expect(applyCalibration(500, null, {})).toBe(500);
  });

  it('returns base estimate when confidence is too low', () => {
    const profile = { global_bias: 0.2, confidence: 0.01 };
    expect(applyCalibration(500, profile, {})).toBe(500);
  });

  it('applies positive global bias', () => {
    const profile = { global_bias: 0.1, confidence: 0.5, meal_factors: {}, food_factors: {}, time_factors: {} };
    const result = applyCalibration(500, profile, { meal_type: 'other' });
    expect(result).toBeGreaterThan(500);
  });

  it('applies negative global bias', () => {
    const profile = { global_bias: -0.1, confidence: 0.5, meal_factors: {}, food_factors: {}, time_factors: {} };
    const result = applyCalibration(500, profile, { meal_type: 'other' });
    expect(result).toBeLessThan(500);
  });

  it('cap: never below 75% of base', () => {
    const profile = { global_bias: -0.5, confidence: 1, meal_factors: {}, food_factors: {}, time_factors: {} };
    const result = applyCalibration(1000, profile, { meal_type: 'other' });
    expect(result).toBeGreaterThanOrEqual(750);
  });

  it('cap: never above 140% of base', () => {
    const profile = { global_bias: 0.8, confidence: 1, meal_factors: {}, food_factors: {}, time_factors: {} };
    const result = applyCalibration(1000, profile, { meal_type: 'other' });
    expect(result).toBeLessThanOrEqual(1400);
  });

  it('blends meal factor with global bias', () => {
    const profile = {
      global_bias: 0.05, confidence: 0.8,
      meal_factors: { dinner: { bias: 0.15, confidence: 0.8, samples: 5 } },
      food_factors: {}, time_factors: {},
    };
    const withMeal    = applyCalibration(500, profile, { meal_type: 'dinner' });
    const withoutMeal = applyCalibration(500, profile, { meal_type: 'other' });
    expect(withMeal).toBeGreaterThan(withoutMeal);
  });

  it('applies weekend factor', () => {
    const profile = {
      global_bias: 0, confidence: 0.5,
      meal_factors: {}, food_factors: {},
      time_factors: { weekend_extra: 0.1 },
    };
    const weekday = applyCalibration(500, profile, { meal_type: 'other', is_weekend: false });
    const weekend = applyCalibration(500, profile, { meal_type: 'other', is_weekend: true });
    expect(weekend).toBeGreaterThan(weekday);
  });

  it('returns rounded integer', () => {
    const profile = { global_bias: 0.123, confidence: 0.5, meal_factors: {}, food_factors: {}, time_factors: {} };
    const result = applyCalibration(500, profile, { meal_type: 'other' });
    expect(result).toBe(Math.round(result));
  });
});

// ── findSimilarMeal ────────────────────────────────────────
describe('findSimilarMeal', () => {
  const frequentMeals = [
    { name: 'Pollo a la plancha con arroz', avg_kcal: 450, times: 5 },
    { name: 'Ensalada mixta con atún', avg_kcal: 350, times: 3 },
    { name: 'Pasta carbonara', avg_kcal: 700, times: 8 },
  ];

  it('matches when 2+ words overlap', () => {
    const match = findSimilarMeal('Pollo plancha verduras', frequentMeals);
    expect(match).not.toBeNull();
    expect(match.name).toContain('Pollo');
  });

  it('matches single-word query when word matches', () => {
    const match = findSimilarMeal('Carbonara', frequentMeals);
    expect(match).not.toBeNull();
    expect(match.name).toContain('carbonara');
  });

  it('returns null for no match', () => {
    expect(findSimilarMeal('Pizza margarita', frequentMeals)).toBeNull();
  });

  it('returns null for empty name', () => {
    expect(findSimilarMeal('', frequentMeals)).toBeNull();
  });

  it('returns null for null name', () => {
    expect(findSimilarMeal(null, frequentMeals)).toBeNull();
  });

  it('returns null for empty frequent meals', () => {
    expect(findSimilarMeal('Pollo', [])).toBeNull();
  });

  it('returns null for null frequent meals', () => {
    expect(findSimilarMeal('Pollo', null)).toBeNull();
  });

  it('ignores short words (<=3 chars)', () => {
    // "con" and "de" are <=3 chars, should be filtered
    const match = findSimilarMeal('pan con algo', frequentMeals);
    expect(match).toBeNull(); // only "algo" is >3, not enough to match
  });
});

// ── updateFrequentMeals ────────────────────────────────────
describe('updateFrequentMeals', () => {
  it('adds new meal to empty list', () => {
    const result = updateFrequentMeals([], 'Pollo plancha', 450);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Pollo plancha');
    expect(result[0].avg_kcal).toBe(450);
    expect(result[0].times).toBe(1);
  });

  it('increments times for exact match', () => {
    const meals = [{ name: 'Pollo plancha', avg_kcal: 450, times: 3, last_seen: '2026-01-01' }];
    const result = updateFrequentMeals(meals, 'Pollo plancha', 500);
    expect(result[0].times).toBe(4);
    expect(result[0].avg_kcal).toBe(Math.round((450 * 3 + 500) / 4)); // 463
  });

  it('matches fuzzy (pollo asado → pollo asado al horno)', () => {
    const meals = [{ name: 'Pollo asado al horno', avg_kcal: 500, times: 2, last_seen: '2026-01-01' }];
    const result = updateFrequentMeals(meals, 'Pollo asado con patatas', 550);
    expect(result).toHaveLength(1); // merged, not added
    expect(result[0].times).toBe(3);
  });

  it('keeps shorter name on fuzzy match', () => {
    const meals = [{ name: 'Pechuga de pollo a la plancha con ensalada', avg_kcal: 400, times: 2, last_seen: '2026-01-01' }];
    const result = updateFrequentMeals(meals, 'Pollo plancha', 450);
    expect(result[0].name).toBe('Pollo plancha');
  });

  it('caps list at 20 entries', () => {
    const meals = Array.from({ length: 20 }, (_, i) => ({
      name: `Meal ${i}`, avg_kcal: 300, times: 1, last_seen: '2026-01-01',
    }));
    const result = updateFrequentMeals(meals, 'New meal', 500);
    expect(result).toHaveLength(20);
  });

  it('sorts by times descending', () => {
    const meals = [
      { name: 'Rare meal', avg_kcal: 300, times: 1, last_seen: '2026-01-01' },
      { name: 'Common meal', avg_kcal: 400, times: 10, last_seen: '2026-01-01' },
    ];
    const result = updateFrequentMeals(meals, 'New meal', 500);
    expect(result[0].name).toBe('Common meal');
  });

  it('returns unchanged list for null meal name', () => {
    const meals = [{ name: 'Test', avg_kcal: 300, times: 1, last_seen: '2026-01-01' }];
    const result = updateFrequentMeals(meals, null, 500);
    expect(result).toHaveLength(1);
  });

  // ── Macros — reglas de backfill ────────────────────────────

  it('new meal con macros → se guardan', () => {
    const result = updateFrequentMeals([], 'Pollo', 450, { protein: 40, carbs: 20, fat: 10 });
    expect(result[0].avg_protein).toBe(40);
    expect(result[0].avg_carbs).toBe(20);
    expect(result[0].avg_fat).toBe(10);
  });

  it('new meal sin macros → null', () => {
    const result = updateFrequentMeals([], 'Pollo', 450);
    expect(result[0].avg_protein).toBe(null);
    expect(result[0].avg_carbs).toBe(null);
    expect(result[0].avg_fat).toBe(null);
  });

  it('existing con macros null → SE INICIALIZA con nuevo valor (no weighted avg con 0)', () => {
    // Bug reportado: frequent se creó sin macros, ahora el usuario guarda con macros.
    // Antes: quedaba null forever. Ahora: se llena.
    const meals = [{
      name: 'Pollo', avg_kcal: 450, times: 3, last_seen: '2026-01-01',
      avg_protein: null, avg_carbs: null, avg_fat: null,
    }];
    const result = updateFrequentMeals(meals, 'Pollo', 500, { protein: 40, carbs: 20, fat: 10 });
    expect(result[0].avg_protein).toBe(40); // inicializado, no weighted
    expect(result[0].avg_carbs).toBe(20);
    expect(result[0].avg_fat).toBe(10);
  });

  it('existing con macros 0 → SE INICIALIZA con nuevo valor', () => {
    const meals = [{
      name: 'Pollo', avg_kcal: 450, times: 3, last_seen: '2026-01-01',
      avg_protein: 0, avg_carbs: 0, avg_fat: 0,
    }];
    const result = updateFrequentMeals(meals, 'Pollo', 500, { protein: 40, carbs: 20, fat: 10 });
    expect(result[0].avg_protein).toBe(40);
    expect(result[0].avg_carbs).toBe(20);
    expect(result[0].avg_fat).toBe(10);
  });

  it('existing con macros válidos + nuevo con macros → weighted average', () => {
    const meals = [{
      name: 'Pollo', avg_kcal: 450, times: 3, last_seen: '2026-01-01',
      avg_protein: 30, avg_carbs: 25, avg_fat: 12,
    }];
    const result = updateFrequentMeals(meals, 'Pollo', 500, { protein: 40, carbs: 20, fat: 10 });
    expect(result[0].avg_protein).toBe(Math.round((30 * 3 + 40) / 4)); // 33
    expect(result[0].avg_carbs).toBe(Math.round((25 * 3 + 20) / 4));   // 24
    expect(result[0].avg_fat).toBe(Math.round((12 * 3 + 10) / 4));     // 12
  });

  it('existing con macros válidos + nuevo SIN macros → NO se pisan con 0', () => {
    const meals = [{
      name: 'Pollo', avg_kcal: 450, times: 3, last_seen: '2026-01-01',
      avg_protein: 40, avg_carbs: 20, avg_fat: 10,
    }];
    const result = updateFrequentMeals(meals, 'Pollo', 500); // sin macros
    expect(result[0].avg_protein).toBe(40); // sin cambios
    expect(result[0].avg_carbs).toBe(20);
    expect(result[0].avg_fat).toBe(10);
  });

  it('solo un macro disponible (ej. protein sí, carbs/fat no)', () => {
    const meals = [{
      name: 'Pollo', avg_kcal: 450, times: 3, last_seen: '2026-01-01',
      avg_protein: null, avg_carbs: null, avg_fat: null,
    }];
    const result = updateFrequentMeals(meals, 'Pollo', 500, { protein: 40, carbs: 0, fat: 0 });
    expect(result[0].avg_protein).toBe(40);    // inicializado
    expect(result[0].avg_carbs).toBe(null);    // sin cambio (0 = no data)
    expect(result[0].avg_fat).toBe(null);
  });
});
