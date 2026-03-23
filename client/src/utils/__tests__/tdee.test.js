import { describe, it, expect } from 'vitest';
import {
  inToCm, lbToKg, calculateBMR, calculateBasePAL,
  calculateExercisePAL, calculateMacros, calculateResult,
} from '../tdee';

// ── Unit conversions ───────────────────────────────────────
describe('inToCm', () => {
  it('converts 5ft 10in to ~178cm', () => {
    const cm = inToCm(5, 10);
    expect(cm).toBeCloseTo(177.8, 0);
  });
  it('converts 6ft 0in to ~183cm', () => {
    expect(inToCm(6, 0)).toBeCloseTo(182.88, 0);
  });
  it('handles null/undefined gracefully', () => {
    expect(inToCm(null, null)).toBe(0);
  });
});

describe('lbToKg', () => {
  it('converts 150lb to ~68kg', () => {
    expect(lbToKg(150)).toBeCloseTo(68.04, 0);
  });
  it('converts 200lb to ~90.7kg', () => {
    expect(lbToKg(200)).toBeCloseTo(90.72, 0);
  });
});

// ── BMR ────────────────────────────────────────────────────
describe('calculateBMR', () => {
  it('male 80kg 180cm 30yo → reasonable BMR (1700-1900)', () => {
    const { bmr, formula } = calculateBMR(80, 180, 30, 'male');
    expect(bmr).toBeGreaterThan(1700);
    expect(bmr).toBeLessThan(1900);
    expect(formula).toBe('mifflin-st-jeor');
  });

  it('female 60kg 165cm 25yo → reasonable BMR (1300-1500)', () => {
    const { bmr } = calculateBMR(60, 165, 25, 'female');
    expect(bmr).toBeGreaterThan(1300);
    expect(bmr).toBeLessThan(1500);
  });

  it('male BMR > female BMR for same stats', () => {
    const male   = calculateBMR(70, 170, 30, 'male');
    const female = calculateBMR(70, 170, 30, 'female');
    expect(male.bmr).toBeGreaterThan(female.bmr);
  });

  it('difference between male and female is exactly 166 kcal', () => {
    // Mifflin: male has +5, female has -161, diff = 166
    const male   = calculateBMR(70, 170, 30, 'male');
    const female = calculateBMR(70, 170, 30, 'female');
    expect(male.bmr - female.bmr).toBe(166);
  });

  it('older person has lower BMR', () => {
    const young = calculateBMR(70, 170, 25, 'male');
    const old   = calculateBMR(70, 170, 50, 'male');
    expect(young.bmr).toBeGreaterThan(old.bmr);
  });

  it('uses Katch-McArdle when body fat is provided', () => {
    const { bmr, formula, leanMass } = calculateBMR(80, 180, 30, 'male', 15);
    expect(formula).toBe('katch-mcardle');
    expect(leanMass).toBe(68); // 80 * (1 - 0.15)
    expect(bmr).toBeGreaterThan(1800); // 370 + 21.6 * 68 = ~1839
  });

  it('returns rounded BMR', () => {
    const { bmr } = calculateBMR(75, 175, 28, 'male');
    expect(bmr).toBe(Math.round(bmr));
  });
});

// ── PAL ────────────────────────────────────────────────────
describe('calculateBasePAL', () => {
  it('desk + low steps → 1.2 (minimum)', () => {
    expect(calculateBasePAL('desk', 'low')).toBe(1.2);
  });

  it('physical + very high steps → 1.5 (capped)', () => {
    expect(calculateBasePAL('physical', 'very')).toBe(1.5);
  });

  it('standing + medium steps → 1.4', () => {
    expect(calculateBasePAL('standing', 'medium')).toBeCloseTo(1.4);
  });

  it('unknown job type defaults to 0 contribution', () => {
    expect(calculateBasePAL('astronaut', 'low')).toBe(1.2);
  });

  it('never exceeds 1.5', () => {
    expect(calculateBasePAL('physical', 'very')).toBeLessThanOrEqual(1.5);
  });
});

describe('calculateExercisePAL', () => {
  it('0 days → 0', () => {
    expect(calculateExercisePAL(0, 'medium', 'mixed')).toBe(0);
  });

  it('null days → 0', () => {
    expect(calculateExercisePAL(null, 'medium', 'mixed')).toBe(0);
  });

  it('3 days medium mixed → positive small value', () => {
    const pal = calculateExercisePAL(3, 'medium', 'mixed');
    expect(pal).toBeGreaterThan(0);
    expect(pal).toBeLessThan(0.2);
  });

  it('7 days long cardio → higher than 3 days short weights', () => {
    const heavy = calculateExercisePAL(7, 'long', 'cardio');
    const light = calculateExercisePAL(3, 'short', 'weights');
    expect(heavy).toBeGreaterThan(light);
  });

  it('never exceeds 0.5', () => {
    const extreme = calculateExercisePAL(7, 'long', 'cardio');
    expect(extreme).toBeLessThanOrEqual(0.5);
  });
});

// ── Macros ─────────────────────────────────────────────────
describe('calculateMacros', () => {
  it('lose goal: 30/40/30 split', () => {
    const m = calculateMacros(2000, 'lose');
    expect(m.proteinPct).toBe(30);
    expect(m.carbsPct).toBe(40);
    expect(m.fatPct).toBe(30);
  });

  it('maintain goal: 25/45/30 split', () => {
    const m = calculateMacros(2000, 'maintain');
    expect(m.proteinPct).toBe(25);
    expect(m.carbsPct).toBe(45);
    expect(m.fatPct).toBe(30);
  });

  it('gain goal: 25/50/25 split', () => {
    const m = calculateMacros(2000, 'gain');
    expect(m.proteinPct).toBe(25);
    expect(m.carbsPct).toBe(50);
    expect(m.fatPct).toBe(25);
  });

  it('protein grams = calories * pct / 4', () => {
    const m = calculateMacros(2000, 'lose');
    expect(m.protein).toBe(Math.round(2000 * 0.30 / 4)); // 150
  });

  it('carbs grams = calories * pct / 4', () => {
    const m = calculateMacros(2000, 'lose');
    expect(m.carbs).toBe(Math.round(2000 * 0.40 / 4)); // 200
  });

  it('fat grams = calories * pct / 9', () => {
    const m = calculateMacros(2000, 'lose');
    expect(m.fat).toBe(Math.round(2000 * 0.30 / 9)); // 67
  });

  it('unknown goal falls back to maintain', () => {
    const m = calculateMacros(2000, 'bulk');
    expect(m.proteinPct).toBe(25); // maintain default
  });

  it('all values are rounded integers', () => {
    const m = calculateMacros(1873, 'lose');
    expect(m.protein).toBe(Math.round(m.protein));
    expect(m.carbs).toBe(Math.round(m.carbs));
    expect(m.fat).toBe(Math.round(m.fat));
  });
});

// ── calculateResult (full pipeline) ────────────────────────
describe('calculateResult', () => {
  const baseData = {
    weight: '80', weightUnit: 'kg',
    heightCm: '180', heightUnit: 'cm',
    age: '30', gender: 'male',
    jobType: 'desk', steps: 'medium',
    exerciseDays: 3, exerciseDuration: 'medium', exerciseType: 'mixed',
    goal: 'maintain',
  };

  it('returns all expected fields', () => {
    const r = calculateResult(baseData);
    expect(r).toHaveProperty('bmr');
    expect(r).toHaveProperty('tdee');
    expect(r).toHaveProperty('targetCalories');
    expect(r).toHaveProperty('macros');
    expect(r).toHaveProperty('formula');
    expect(r).toHaveProperty('finalPAL');
    expect(r).toHaveProperty('alternatives');
  });

  it('TDEE = BMR × PAL', () => {
    const r = calculateResult(baseData);
    expect(r.tdee).toBe(Math.round(r.bmr * r.finalPAL));
  });

  it('maintain goal: target = TDEE (no adjustment)', () => {
    const r = calculateResult(baseData);
    expect(r.targetCalories).toBe(r.tdee);
    expect(r.adjustment).toBe(0);
  });

  it('lose goal: target < TDEE', () => {
    const r = calculateResult({ ...baseData, goal: 'lose', loseRate: 'moderate' });
    expect(r.targetCalories).toBeLessThan(r.tdee);
    expect(r.adjustment).toBeLessThan(0);
  });

  it('gain goal: target > TDEE', () => {
    const r = calculateResult({ ...baseData, goal: 'gain', gainRate: 'moderate' });
    expect(r.targetCalories).toBeGreaterThan(r.tdee);
    expect(r.adjustment).toBeGreaterThan(0);
  });

  it('never goes below MIN_CALORIES for males (1500)', () => {
    const r = calculateResult({
      ...baseData, weight: '50', goal: 'lose', loseRate: 'very_aggressive',
    });
    expect(r.targetCalories).toBeGreaterThanOrEqual(1500);
    expect(r.belowMin).toBe(true);
  });

  it('never goes below MIN_CALORIES for females (1200)', () => {
    const r = calculateResult({
      ...baseData, weight: '45', gender: 'female', goal: 'lose', loseRate: 'very_aggressive',
    });
    expect(r.targetCalories).toBeGreaterThanOrEqual(1200);
  });

  it('handles lb weight unit', () => {
    const r = calculateResult({ ...baseData, weight: '176', weightUnit: 'lb' });
    expect(r.weightKg).toBeCloseTo(79.8, 0);
  });

  it('handles ft/in height unit', () => {
    const r = calculateResult({
      ...baseData, heightUnit: 'ft', heightFt: '5', heightIn: '11',
    });
    expect(r.height).toBeCloseTo(180, 0);
  });

  it('macros use targetCalories (not TDEE)', () => {
    const r = calculateResult({ ...baseData, goal: 'lose', loseRate: 'moderate' });
    const expectedProtein = Math.round(r.targetCalories * 0.30 / 4);
    expect(r.macros.protein).toBe(expectedProtein);
  });

  it('PAL is capped at 1.9', () => {
    const r = calculateResult({
      ...baseData, jobType: 'physical', steps: 'very',
      exerciseDays: 7, exerciseDuration: 'long', exerciseType: 'cardio',
    });
    expect(r.finalPAL).toBeLessThanOrEqual(1.9);
  });
});
