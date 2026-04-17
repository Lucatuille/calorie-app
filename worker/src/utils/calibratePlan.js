// ============================================================
//  calibratePlan — escala porciones para acercar el plan al target.
//
//  Sonnet a veces sub-estima porciones: target 1800 kcal, plan 1400.
//  En vez de aceptar el desfase, reescalamos el plan con un factor.
//
//  Nuevo (2026-04-17): si el caller pasa un target macro-aware
//  `{ kcal, protein }`, protegemos la proteína (no se escala) y
//  llegamos al target kcal subiendo/bajando solo carbos+grasa.
//  Motivo nutricional: en déficit la proteína es un piso absoluto
//  (1.6–2.2 g/kg), no un porcentaje; escalarla al azar puede dejar
//  al usuario 30g por debajo o inflarla sin sentido.
//
//  Firma legacy (`calibrateMeals(meals, number)`) se mantiene para
//  compat — hace scaling uniforme como antes.
//
//  Tolerancia ±10%: si el plan ya está dentro, no tocamos.
//  Extremos: si factor <0.7 o >1.4 devolvemos { extreme: true }
//  para que el caller lo refleje en la respuesta al cliente.
// ============================================================

const TOLERANCE_LOW  = 0.92;
const TOLERANCE_HIGH = 1.10;
const EXTREME_LOW    = 0.70;
const EXTREME_HIGH   = 1.40;

/**
 * Calibra un array de meals hacia un target kcal (y opcionalmente proteína).
 *
 * @param {Array} meals — [{kcal, protein, carbs, fat, portion_g?, ingredients?}]
 * @param {number|{kcal: number, protein?: number}} target
 *   - number  → legacy: escala uniforme. Sin protección de proteína.
 *   - object  → protein-aware: proteína protegida, C+F absorben el ajuste.
 * @returns {{
 *   calibrated: boolean,
 *   factor?: number,
 *   originalKcal?: number,
 *   extreme?: boolean,
 *   overBudgetSkipped?: boolean,
 * }}
 */
export function calibrateMeals(meals, target) {
  // Normalizar target: número → {kcal}, objeto tal cual.
  const targetObj = (typeof target === 'number' || target == null)
    ? { kcal: target }
    : target;
  const targetKcal = targetObj.kcal;
  const targetProtein = targetObj.protein;

  if (!Array.isArray(meals) || meals.length === 0) {
    return { calibrated: false };
  }

  // target <= 0 significa "el usuario ya se pasó del objetivo".
  // No calibrar (no tiene sentido escalar hacia un target negativo)
  // pero marcarlo para que el caller avise al cliente.
  if (typeof targetKcal !== 'number' || targetKcal <= 0) {
    return { calibrated: false, overBudgetSkipped: true };
  }

  const totals = recomputeTotals(meals);
  if (totals.kcal <= 0) return { calibrated: false };

  const factor = targetKcal / totals.kcal;

  // Dentro de tolerancia → no escalar.
  if (factor >= TOLERANCE_LOW && factor <= TOLERANCE_HIGH) {
    return { calibrated: false, factor, originalKcal: totals.kcal };
  }

  // Extremos → no escalar; flaggear para que el caller advierta.
  if (factor < EXTREME_LOW || factor > EXTREME_HIGH) {
    return {
      calibrated: false,
      factor,
      originalKcal: totals.kcal,
      extreme: true,
    };
  }

  // Branch: protein-aware si llega target.protein válido, uniforme si no.
  const proteinProtected = typeof targetProtein === 'number' && targetProtein > 0;

  if (proteinProtected) {
    scaleProteinAware(meals, factor);
  } else {
    scaleUniform(meals, factor);
  }

  return { calibrated: true, factor, originalKcal: totals.kcal };
}

/**
 * Escalado uniforme: kcal + macros × factor. Legacy, sin protección.
 */
function scaleUniform(meals, factor) {
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
}

/**
 * Escalado protein-aware: cada meal mantiene su proteína; kcal llega
 * al target moviendo carbos y grasa. Si la proteína pura ya excede el
 * target kcal del meal, fallback a uniforme en ese meal para evitar
 * carbs/fat negativos.
 */
function scaleProteinAware(meals, factor) {
  for (const meal of meals) {
    const oldKcal   = meal.kcal    || 0;
    const oldP      = meal.protein || 0;
    const oldC      = meal.carbs   || 0;
    const oldF      = meal.fat     || 0;
    const oldPort   = meal.portion_g || 0;
    const oldIngr   = meal.ingredients || '';

    const newKcal      = Math.round(oldKcal * factor);
    const proteinKcal  = oldP * 4;
    const cfBudget     = newKcal - proteinKcal;   // kcal disponibles para C+F
    const oldCfKcal    = oldC * 4 + oldF * 9;     // kcal actuales de C+F

    // Fallback uniforme si:
    //  - proteína sola ya supera el target kcal del meal (cfBudget <= 0)
    //  - no hay C ni F que rebalancear (oldCfKcal <= 0)
    if (cfBudget <= 0 || oldCfKcal <= 0) {
      meal.kcal    = newKcal;
      meal.protein = Math.round(oldP * factor);
      meal.carbs   = Math.round(oldC * factor);
      meal.fat     = Math.round(oldF * factor);
    } else {
      const cfFactor = cfBudget / oldCfKcal;
      meal.kcal    = newKcal;
      // proteína intacta (el piso)
      meal.carbs   = Math.round(oldC * cfFactor);
      meal.fat     = Math.round(oldF * cfFactor);
    }

    // portion_g + ingredientes: escalado por ratio kcal efectivo, no
    // por el factor global (el meal puede haber cambiado su densidad
    // energética al proteger proteína).
    if (oldKcal > 0) {
      const massRatio = newKcal / oldKcal;
      if (oldPort) meal.portion_g = Math.round(oldPort * massRatio);
      if (oldIngr) meal.ingredients = scaleIngredientsGrams(oldIngr, massRatio);
    }
  }
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
