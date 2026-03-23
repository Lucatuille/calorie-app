// ============================================================
//  TDEE Calculation Utilities
//  Mifflin-St Jeor (1990) + Katch-McArdle (Cunningham 1980)
// ============================================================

// ── Types ──────────────────────────────────────────────────
interface BMRResult {
  bmr: number;
  formula: 'mifflin-st-jeor' | 'katch-mcardle';
  leanMass: number | null;
}

export interface MacroResult {
  protein: number;
  carbs: number;
  fat: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

type Goal = 'lose' | 'maintain' | 'gain';

interface TDEEInput {
  weight: string;
  weightUnit?: string;
  heightCm?: string;
  heightUnit?: string;
  heightFt?: string;
  heightIn?: string;
  age: string;
  gender: string;
  jobType: string;
  steps: string;
  exerciseDays?: number;
  exerciseDuration?: string;
  exerciseType?: string;
  goal?: string;
  loseRate?: string;
  gainRate?: string;
  showBodyFat?: boolean;
  bodyFat?: string;
}

// ── Unit conversions ─────────────────────────────────────────
export function inToCm(ft: string | number | null, inches: string | number | null): number {
  return (parseInt(ft as string) || 0) * 30.48 + (parseFloat(inches as string) || 0) * 2.54;
}
export function lbToKg(lb: string | number): number {
  return parseFloat(lb as string) * 0.453592;
}

// ── BMR formulas ─────────────────────────────────────────────
export function calculateBMR(
  weight: number, height: number, age: number, gender: string, bodyFatPct: number | null = null
): BMRResult {
  if (bodyFatPct !== null) {
    // Katch-McArdle (Cunningham 1980) — más preciso si se conoce % grasa
    const leanMass = weight * (1 - bodyFatPct / 100);
    return {
      bmr:      Math.round(370 + 21.6 * leanMass),
      formula:  'katch-mcardle',
      leanMass: Math.round(leanMass * 10) / 10,
    };
  }
  // Mifflin-St Jeor (1990) — gold standard sin composición corporal
  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  return { bmr: Math.round(bmr), formula: 'mifflin-st-jeor', leanMass: null };
}

// ── Physical Activity Level (PAL) ────────────────────────────
export function calculateBasePAL(jobType: string, steps: string): number {
  const jobFactors:  Record<string, number> = { desk: 0.0, standing: 0.1, physical: 0.3, home: 0.05 };
  const stepFactors: Record<string, number> = { low: 0.0, medium: 0.1, high: 0.2, very: 0.3 };
  return Math.min(1.2 + (jobFactors[jobType] || 0) + (stepFactors[steps] || 0), 1.5);
}

export function calculateExercisePAL(days: number | null, duration: string, type: string): number {
  if (!days) return 0;
  const metByType:     Record<string, number> = { weights: 5.0, cardio: 7.0, mixed: 6.0 };
  const durationHours: Record<string, number> = { short: 0.4, medium: 0.75, hour: 1.0, long: 1.5 };
  const met   = metByType[type]     || 6.0;
  const hours = durationHours[duration] || 1.0;
  // Contribución al PAL diario: (MET × horas × días/semana) / 168h × factor conservador
  return Math.min((met * hours * days) / 168 * 0.85, 0.5);
}

// ── Macros distribution ───────────────────────────────────────
const MACRO_RATIOS: Record<string, { protein: number; carbs: number; fat: number }> = {
  lose:     { protein: 0.30, carbs: 0.40, fat: 0.30 },
  maintain: { protein: 0.25, carbs: 0.45, fat: 0.30 },
  gain:     { protein: 0.25, carbs: 0.50, fat: 0.25 },
};

export function calculateMacros(calories: number, goal: string): MacroResult {
  const r = MACRO_RATIOS[goal] || MACRO_RATIOS.maintain;
  return {
    protein: Math.round((calories * r.protein) / 4),
    carbs:   Math.round((calories * r.carbs)   / 4),
    fat:     Math.round((calories * r.fat)     / 9),
    proteinPct: Math.round(r.protein * 100),
    carbsPct:   Math.round(r.carbs   * 100),
    fatPct:     Math.round(r.fat     * 100),
  };
}

// ── Deficit / surplus tables ─────────────────────────────────
const LOSE_TABLE = [
  { key: 'gentle',          label: 'Suave',        emoji: '🐢', rate: 0.25, deficit: 275,  note: 'muy sostenible' },
  { key: 'moderate',        label: 'Moderado',     emoji: '🚶', rate: 0.5,  deficit: 550,  note: 'recomendado' },
  { key: 'aggressive',      label: 'Agresivo',     emoji: '🏃', rate: 0.75, deficit: 825,  note: 'exigente' },
  { key: 'very_aggressive', label: 'Muy agresivo', emoji: '⚡', rate: 1.0,  deficit: 1100, note: 'difícil ⚠️' },
];

const GAIN_TABLE = [
  { key: 'lean',     label: 'Limpio',   emoji: '🐢', rate: 0.25, surplus: 275 },
  { key: 'moderate', label: 'Moderado', emoji: '🚶', rate: 0.5,  surplus: 550 },
];

export { LOSE_TABLE, GAIN_TABLE };

// ── Full calculation ──────────────────────────────────────────
export function calculateResult(data: TDEEInput) {
  // Normalise units
  let weight = parseFloat(data.weight);
  if (data.weightUnit === 'lb') weight = lbToKg(weight);

  let height: number;
  if (data.heightUnit === 'cm') {
    height = parseFloat(data.heightCm!);
  } else {
    height = inToCm(data.heightFt!, data.heightIn!);
  }

  const age     = parseInt(data.age);
  const bodyFat = data.showBodyFat && data.bodyFat ? parseFloat(data.bodyFat) : null;

  const { bmr, formula, leanMass } = calculateBMR(weight, height, age, data.gender, bodyFat);

  const basePAL     = calculateBasePAL(data.jobType, data.steps);
  const exercisePAL = (data.exerciseDays ?? 0) > 0
    ? calculateExercisePAL(data.exerciseDays!, data.exerciseDuration!, data.exerciseType!)
    : 0;
  const finalPAL = Math.min(basePAL + exercisePAL, 1.9);
  const tdee     = Math.round(bmr * finalPAL);

  // Kcal breakdown (for display)
  const activityKcal = Math.round(bmr * (basePAL - 1.2));
  const exerciseKcal = Math.round(bmr * exercisePAL);

  // Target calories
  const MIN_CALORIES = data.gender === 'male' ? 1500 : 1200;

  let adjustment = 0;
  if (data.goal === 'lose') {
    const row = LOSE_TABLE.find(r => r.key === data.loseRate) || LOSE_TABLE[1];
    adjustment = -row.deficit;
  } else if (data.goal === 'gain') {
    const row = GAIN_TABLE.find(r => r.key === data.gainRate) || GAIN_TABLE[1];
    adjustment = row.surplus;
  }

  let targetCalories = tdee + adjustment;
  const belowMin     = targetCalories < MIN_CALORIES;
  if (belowMin) targetCalories = MIN_CALORIES;

  const macros = calculateMacros(targetCalories, data.goal || 'maintain');

  // All alternatives (only relevant for lose)
  const alternatives = LOSE_TABLE.map(row => ({
    ...row,
    kcal:      Math.max(MIN_CALORIES, tdee - row.deficit),
    monthlyKg: (row.rate * 4).toFixed(1),
    belowMin:  tdee - row.deficit < MIN_CALORIES,
  }));

  // Human-readable weight used (in user's preferred unit for display)
  const weightKg = Math.round(weight * 10) / 10;

  return {
    bmr, tdee, targetCalories, adjustment, macros,
    formula, leanMass, bodyFat, finalPAL, basePAL, exercisePAL,
    activityKcal, exerciseKcal, belowMin, MIN_CALORIES,
    alternatives, weightKg, height: Math.round(height), age,
  };
}
