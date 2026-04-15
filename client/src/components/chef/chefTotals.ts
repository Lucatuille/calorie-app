// ============================================================
//  chefTotals — helpers para recalcular totales de planes tras
//  edición manual de meals. Paridad con worker/src/utils/calibratePlan.js
//  (recomputeTotals), pero puro cliente sin imports.
// ============================================================

export type MealLike = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type Totals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function recomputeTotals(meals: MealLike[]): Totals {
  return {
    kcal:    meals.reduce((s, m) => s + (m.kcal    || 0), 0),
    protein: meals.reduce((s, m) => s + (m.protein || 0), 0),
    carbs:   meals.reduce((s, m) => s + (m.carbs   || 0), 0),
    fat:     meals.reduce((s, m) => s + (m.fat     || 0), 0),
  };
}

export function recomputeWeekTotals(days: { totals?: Totals }[]): Totals {
  return {
    kcal:    days.reduce((s, d) => s + (d.totals?.kcal    || 0), 0),
    protein: days.reduce((s, d) => s + (d.totals?.protein || 0), 0),
    carbs:   days.reduce((s, d) => s + (d.totals?.carbs   || 0), 0),
    fat:     days.reduce((s, d) => s + (d.totals?.fat     || 0), 0),
  };
}
