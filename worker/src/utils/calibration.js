// ============================================================
//  CALIBRATION UTILS — Motor de auto-calibración personal
// ============================================================

// ── Normalización de categorías ────────────────────────────
// Claude puede devolver variantes del mismo concepto; las mapeamos
// a un token canónico antes de agrupar.

const CATEGORY_MAP = {
  pasta_italiana: 'pasta', italian_pasta: 'pasta', spaghetti: 'pasta',
  pasta_dish: 'pasta', noodles: 'pasta', macarrones: 'pasta',
  grilled_chicken: 'pollo', chicken: 'pollo', pollo_asado: 'pollo',
  chicken_breast: 'pollo', pechuga: 'pollo',
  ensalada: 'salad', mixed_salad: 'salad', green_salad: 'salad',
  arroz: 'rice', white_rice: 'rice', brown_rice: 'rice',
  beef: 'carne', red_meat: 'carne', carne_roja: 'carne',
  fish: 'pescado', seafood: 'pescado', salmon: 'pescado', atun: 'pescado',
  legumes: 'legumbres', beans: 'legumbres', lentils: 'legumbres',
  pan: 'bread', white_bread: 'bread', baguette: 'bread',
};

function normalizeCategory(raw) {
  const key = raw.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  return CATEGORY_MAP[key] || key;
}

// ── Bias mixto (absoluto + relativo) ───────────────────────
// Para meals pequeñas (<300 kcal) el error absoluto en kcal importa más.
// Para meals grandes (>600 kcal) el error relativo en % importa más.
// Promediar solo porcentajes mezcla señales de distinto peso incorrectamente.

function calcMixedBias(correction) {
  const base = correction.ai_calibrated;
  if (!base) return 0;
  const absErr = correction.user_final - base;
  const relErr = absErr / base;
  const mixWeight = Math.min(base / 500, 1); // 0 para meals pequeñas, 1 para grandes
  return (relErr * mixWeight) + (absErr / 500 * (1 - mixWeight));
}

// ── Helpers ────────────────────────────────────────────────

function calculateWeightedMean(values, weights = null) {
  if (!values.length) return 0;
  if (!weights) weights = new Array(values.length).fill(1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight;
}

function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const group = item[key] || 'other';
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
}

// ── Calcular perfil desde el historial de correcciones ─────

export function calculateCalibrationProfile(corrections) {
  if (!corrections || corrections.length === 0) {
    return { global_bias: 0, confidence: 0, data_points: 0,
             meal_factors: {}, food_factors: {}, time_factors: {} };
  }

  // Solo correcciones donde el usuario cambió el valor
  const actual = corrections.filter(c => !c.accepted_without_change);

  if (actual.length === 0) {
    return { global_bias: 0, confidence: 0.3, data_points: corrections.length,
             meal_factors: {}, food_factors: {}, time_factors: {} };
  }

  // Invertir para que index 0 = más antiguo, index n-1 = más reciente
  // Así Math.pow(1.1, i) da MAYOR peso a las correcciones recientes
  const chronological = [...actual].reverse();
  const weights = chronological.map((_, i) => Math.pow(1.1, i));

  // Bias mixto: combina error absoluto (relevante en meals pequeñas) y relativo
  // (relevante en meals grandes) — evita que meals de 200 kcal distorsionen
  // el promedio frente a meals de 800 kcal con el mismo error en kcal.
  const globalBias = calculateWeightedMean(
    chronological.map(c => calcMixedBias(c)),
    weights
  );

  // Factores por meal_type (mínimo 2 muestras)
  const mealFactors = {};
  for (const [meal, items] of Object.entries(groupBy(actual, 'meal_type'))) {
    if (items.length >= 2) {
      mealFactors[meal] = {
        bias:       calculateWeightedMean(items.map(c => calcMixedBias(c))),
        samples:    items.length,
        confidence: Math.min(items.length / 8, 1),
      };
    }
  }

  // Factores por categoría de comida — normalizadas para evitar duplicados
  // ("grilled_chicken" y "chicken" se tratan como la misma categoría "pollo")
  const foodFactors = {};
  const allCats = [...new Set(actual.flatMap(c => {
    try { return JSON.parse(c.food_categories || '[]').map(normalizeCategory); } catch { return []; }
  }))];
  for (const cat of allCats) {
    const catItems = actual.filter(c => {
      try {
        const cats = JSON.parse(c.food_categories || '[]').map(normalizeCategory);
        return cats.includes(cat);
      } catch { return false; }
    });
    if (catItems.length >= 2) {
      foodFactors[cat] = {
        bias:    calculateWeightedMean(catItems.map(c => calcMixedBias(c))),
        samples: catItems.length,
      };
    }
  }

  // Factores temporales: fin de semana vs semana
  const timeFactors = {};
  const weekendItems  = actual.filter(c => c.is_weekend);
  const weekdayItems  = actual.filter(c => !c.is_weekend);
  if (weekendItems.length >= 2 && weekdayItems.length >= 2) {
    const weekendBias = calculateWeightedMean(weekendItems.map(c => calcMixedBias(c)));
    const weekdayBias = calculateWeightedMean(weekdayItems.map(c => calcMixedBias(c)));
    if (Math.abs(weekendBias - weekdayBias) > 0.05) {
      timeFactors.weekend_extra = weekendBias - weekdayBias;
    }
  }

  // 5 muestras para activar, 20 para máxima confianza (más justificado que el 15 anterior)
  const confidence = actual.length < 5 ? 0 : Math.min((actual.length - 5) / 15, 1);

  return { global_bias: globalBias, confidence, data_points: corrections.length,
           meal_factors: mealFactors, food_factors: foodFactors, time_factors: timeFactors };
}

// ── Aplicar perfil a una estimación base ───────────────────

export function applyCalibration(baseEstimate, profile, context) {
  if (!profile || profile.confidence < 0.1) return baseEstimate;

  let factor = 1 + profile.global_bias;

  // Meal type: blend global + meal según confianza
  const mealFactor = profile.meal_factors?.[context.meal_type];
  if (mealFactor && mealFactor.confidence > 0.3) {
    factor += (mealFactor.bias - profile.global_bias) * mealFactor.confidence;
  }

  // Categorías de comida (peso moderado)
  if (context.food_categories?.length && profile.food_factors) {
    let adj = 0, count = 0;
    for (const cat of context.food_categories) {
      if (profile.food_factors[cat]) {
        adj += profile.food_factors[cat].bias - profile.global_bias;
        count++;
      }
    }
    if (count > 0) factor += (adj / count) * 0.6;
  }

  // Fin de semana
  if (context.is_weekend && profile.time_factors?.weekend_extra) {
    factor += profile.time_factors.weekend_extra * 0.5;
  }

  // Cap: nunca más de +80% ni menos de -30%
  factor = Math.max(0.7, Math.min(1.8, factor));

  return Math.round(baseEstimate * factor);
}

// ── Buscar comida similar en historial frecuente ───────────

export function findSimilarMeal(name, frequentMeals) {
  if (!name || !frequentMeals?.length) return null;
  const nameLower = name.toLowerCase();
  const words = nameLower.split(' ').filter(w => w.length > 3);
  for (const meal of frequentMeals) {
    const mealLower = meal.name.toLowerCase();
    const matches = words.filter(w => mealLower.includes(w));
    if (matches.length >= 2 || (words.length === 1 && matches.length === 1)) {
      return meal;
    }
  }
  return null;
}

// ── Actualizar lista de comidas frecuentes ─────────────────

export function updateFrequentMeals(meals, mealName, kcal) {
  if (!mealName) return meals;
  const existing = meals.find(m => m.name.toLowerCase() === mealName.toLowerCase());
  if (existing) {
    existing.avg_kcal = Math.round((existing.avg_kcal * existing.times + kcal) / (existing.times + 1));
    existing.times++;
    existing.last_seen = new Date().toISOString().split('T')[0];
  } else {
    meals.push({ name: mealName, avg_kcal: kcal, times: 1,
                 last_seen: new Date().toISOString().split('T')[0] });
  }
  return meals.sort((a, b) => b.times - a.times).slice(0, 20);
}
