// ============================================================
//  CALIBRATION UTILS — Motor de auto-calibración personal
// ============================================================

import { CALIBRATION_DECAY, CALIBRATION_MIN_POINTS, CALIBRATION_CAP_LOW, CALIBRATION_CAP_HIGH } from '../constants.js';

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

  // Correcciones donde el usuario cambió el valor (señal fuerte)
  const actual = corrections.filter(c => !c.accepted_without_change);

  // Todas las correcciones cronológicas — las aceptadas sin cambio aportan bias=0
  // (el usuario confirmó que la IA acertó, eso también es señal útil)
  // corrections llega DESC (más reciente primero); reverse = ASC (más antiguo primero)
  const chronological = [...corrections].reverse();

  // Pesos por antigüedad basados en fecha real — vida media ~23 días
  // Más reciente = peso mayor; una corrección de hace 23 días pesa la mitad que hoy
  const now = Date.now();
  const weights = chronological.map(c => {
    // SQLite devuelve "2026-03-20 14:30:00" — reemplazar espacio por T para ISO válido
    const ts = Date.parse((c.created_at || '').replace(' ', 'T'));
    const daysSince = isNaN(ts) ? 0 : Math.max(0, (now - ts) / 86400000);
    return Math.pow(CALIBRATION_DECAY, daysSince); // vida media ~23 días
  });

  let globalBias = calculateWeightedMean(
    chronological.map(c => c.accepted_without_change ? 0 : calcMixedBias(c)),
    weights
  );

  // Si hay una racha de N correcciones recientes aceptadas sin cambio, la IA está acertando
  // → reducir activamente el bias hacia 0 (cada 5 aceptaciones consecutivas lo divide a la mitad)
  let recentAcceptedRun = 0;
  for (const c of corrections) { // DESC: empieza por la más reciente
    if (c.accepted_without_change) recentAcceptedRun++;
    else break;
  }
  if (recentAcceptedRun >= 5) {
    const halvings = Math.floor(recentAcceptedRun / 5);
    globalBias = globalBias * Math.pow(0.5, halvings);
  }

  // Factores por meal_type (mínimo 3 muestras, con time decay)
  const mealFactors = {};
  for (const [meal, items] of Object.entries(groupBy(actual, 'meal_type'))) {
    if (items.length >= CALIBRATION_MIN_POINTS) {
      const itemWeights = items.map(c => {
        const ts = Date.parse((c.created_at || '').replace(' ', 'T'));
        const daysSince = isNaN(ts) ? 0 : Math.max(0, (now - ts) / 86400000);
        return Math.pow(CALIBRATION_DECAY, daysSince);
      });
      mealFactors[meal] = {
        bias:       calculateWeightedMean(items.map(c => calcMixedBias(c)), itemWeights),
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
    if (catItems.length >= CALIBRATION_MIN_POINTS) {
      const catWeights = catItems.map(c => {
        const ts = Date.parse((c.created_at || '').replace(' ', 'T'));
        const daysSince = isNaN(ts) ? 0 : Math.max(0, (now - ts) / 86400000);
        return Math.pow(CALIBRATION_DECAY, daysSince);
      });
      foodFactors[cat] = {
        bias:       calculateWeightedMean(catItems.map(c => calcMixedBias(c)), catWeights),
        samples:    catItems.length,
        confidence: Math.min(catItems.length / 8, 1),
      };
    }
  }

  // Factores temporales: fin de semana vs semana
  const timeFactors = {};
  const weekendItems  = actual.filter(c => c.is_weekend);
  const weekdayItems  = actual.filter(c => !c.is_weekend);
  if (weekendItems.length >= CALIBRATION_MIN_POINTS && weekdayItems.length >= CALIBRATION_MIN_POINTS) {
    const weekendBias = calculateWeightedMean(weekendItems.map(c => calcMixedBias(c)));
    const weekdayBias = calculateWeightedMean(weekdayItems.map(c => calcMixedBias(c)));
    if (Math.abs(weekendBias - weekdayBias) > 0.05) {
      timeFactors.weekend_extra = weekendBias - weekdayBias;
    }
  }

  // Señal efectiva: correcciones cambiadas cuentan 1, aceptadas sin cambio cuentan 0.3
  // (confirmar que la IA acertó también es información útil)
  const acceptedCount = corrections.length - actual.length;
  const effectiveSignal = actual.length + acceptedCount * 0.3;
  // Mínimo 2 para activar, 12 para máxima confianza
  const confidence = effectiveSignal < 2 ? 0 : Math.min(effectiveSignal / 12, 1);

  return { global_bias: globalBias, confidence, data_points: corrections.length,
           meal_factors: mealFactors, food_factors: foodFactors, time_factors: timeFactors };
}

// ── Aplicar perfil a una estimación base ───────────────────

export function applyCalibration(baseEstimate, profile, context) {
  if (!profile || profile.confidence < 0.05) return baseEstimate;

  let factor = 1 + profile.global_bias;

  // Meal type: blend global + meal según confianza
  const mealFactor = profile.meal_factors?.[context.meal_type];
  if (mealFactor && mealFactor.confidence > 0.3) {
    factor += (mealFactor.bias - profile.global_bias) * mealFactor.confidence;
  }

  // Categorías de comida (peso moderado, escalado por confidence)
  if (context.food_categories?.length && profile.food_factors) {
    let adj = 0, confSum = 0, count = 0;
    for (const cat of context.food_categories) {
      const ff = profile.food_factors[cat];
      if (ff) {
        const conf = ff.confidence || Math.min(ff.samples / 8, 1);
        adj += (ff.bias - profile.global_bias) * conf;
        confSum += conf;
        count++;
      }
    }
    if (count > 0) factor += (adj / confSum) * 0.6;
  }

  // Fin de semana
  if (context.is_weekend && profile.time_factors?.weekend_extra) {
    factor += profile.time_factors.weekend_extra * 0.5;
  }

  // Cap: nunca más de +40% ni menos de -25%
  factor = Math.max(CALIBRATION_CAP_LOW, Math.min(CALIBRATION_CAP_HIGH, factor));

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

// ── Matching difuso entre nombres de comida ────────────────
// "Pollo asado con patatas" y "Pollo asado al horno" → misma comida

function isSameMeal(name1, name2) {
  const words1 = name1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words2 = name2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const matches = words1.filter(w => words2.includes(w));
  return matches.length >= 2 || (words1.length === 1 && matches.length === 1);
}

// ── Actualizar lista de comidas frecuentes ─────────────────

export function updateFrequentMeals(meals, mealName, kcal) {
  if (!mealName) return meals;
  const today = new Date().toISOString().split('T')[0];

  // Buscar coincidencia exacta primero, luego difusa
  const existing =
    meals.find(m => m.name.toLowerCase() === mealName.toLowerCase()) ||
    meals.find(m => isSameMeal(m.name, mealName));

  if (existing) {
    // Media ponderada acumulada
    existing.avg_kcal = Math.round(
      (existing.avg_kcal * existing.times + kcal) / (existing.times + 1)
    );
    existing.times++;
    existing.last_seen = today;
    // Mantener el nombre más corto/limpio entre los dos
    if (mealName.length < existing.name.length) existing.name = mealName;
  } else {
    meals.push({ name: mealName, avg_kcal: kcal, times: 1, last_seen: today });
  }

  return meals.sort((a, b) => b.times - a.times).slice(0, 20);
}
