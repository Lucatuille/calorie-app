// ============================================================
//  calibratePlan — escala porciones para acercar el plan al target.
//
//  Sonnet a veces sub-estima porciones: target 1800 kcal, plan 1400.
//  En vez de aceptar el desfase, reescalamos kcal + macros + gramos
//  en los ingredientes con un factor multiplicador uniforme.
//
//  Tolerancia ±10%: si el plan ya está dentro, no tocamos.
//  Extremos: si factor <0.7 o >1.4 NO escalamos (plan demasiado roto;
//  un x1.5 o x0.5 daría porciones absurdas).
// ============================================================

const TOLERANCE_LOW  = 0.92; // dentro de 0.92 - 1.10 = no escalar
const TOLERANCE_HIGH = 1.10;
const EXTREME_LOW    = 0.70; // fuera de 0.70 - 1.40 = no escalar
const EXTREME_HIGH   = 1.40;

/**
 * Escala los meals proporcionalmente para que la suma de kcal se
 * acerque a targetKcal. Mutate-in-place.
 *
 * @param {Array} meals — array de meals con kcal/protein/carbs/fat/ingredients
 * @param {number} targetKcal — objetivo de kcal para el conjunto
 * @returns {{ calibrated: boolean, factor?: number, originalKcal?: number }}
 */
export function calibrateMeals(meals, targetKcal) {
  if (!Array.isArray(meals) || meals.length === 0) return { calibrated: false };
  if (!targetKcal || targetKcal <= 0) return { calibrated: false };

  const originalKcal = meals.reduce((s, m) => s + (m.kcal || 0), 0);
  if (originalKcal <= 0) return { calibrated: false };

  const factor = targetKcal / originalKcal;

  // Dentro de tolerancia ±10% → no escalar
  if (factor >= TOLERANCE_LOW && factor <= TOLERANCE_HIGH) {
    return { calibrated: false, factor, originalKcal };
  }

  // Extremos → no escalar (plan roto; escalar daría porciones absurdas)
  if (factor < EXTREME_LOW || factor > EXTREME_HIGH) {
    return { calibrated: false, factor, originalKcal, extreme: true };
  }

  // Escalar
  for (const meal of meals) {
    meal.kcal    = Math.round((meal.kcal    || 0) * factor);
    meal.protein = Math.round((meal.protein || 0) * factor);
    meal.carbs   = Math.round((meal.carbs   || 0) * factor);
    meal.fat     = Math.round((meal.fat     || 0) * factor);
    if (meal.portion_g) {
      meal.portion_g = Math.round(meal.portion_g * factor);
    }
    if (meal.ingredients) {
      meal.ingredients = scaleIngredientsGrams(meal.ingredients, factor);
    }
  }

  return { calibrated: true, factor, originalKcal };
}

/**
 * Escala gramos en un string de ingredientes.
 * "60g avena · 1 plátano · 150g yogur" con factor 1.2 → "72g avena · 1 plátano · 180g yogur"
 * Solo toca números seguidos inmediatamente de "g". No toca "1 plátano", "1 cdta", etc.
 */
export function scaleIngredientsGrams(text, factor) {
  return String(text).replace(/(\d+)g\b/gi, (_, n) => {
    const scaled = Math.round(parseInt(n, 10) * factor);
    return `${scaled}g`;
  });
}

/**
 * Recalcula totals de un array de meals.
 */
export function recomputeTotals(meals) {
  return {
    kcal:    meals.reduce((s, m) => s + (m.kcal    || 0), 0),
    protein: meals.reduce((s, m) => s + (m.protein || 0), 0),
    carbs:   meals.reduce((s, m) => s + (m.carbs   || 0), 0),
    fat:     meals.reduce((s, m) => s + (m.fat     || 0), 0),
  };
}
