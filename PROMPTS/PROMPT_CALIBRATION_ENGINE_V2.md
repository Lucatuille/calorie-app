# 🧠 Calibration Engine v2 — Implementación completa

## REGLA ABSOLUTA
Este prompt es ADITIVO. No se elimina ni modifica ningún archivo existente
hasta la Fase 4 (migración final), que requiere confirmación explícita.
El engine v1 sigue funcionando durante toda la implementación.

Branch de trabajo:
```bash
git checkout main  # Este cambio va a main, no a ui-experiments
                   # Es backend puro, no toca UI hasta Fase 4
```

---

## CONTEXTO DEL SISTEMA ACTUAL

### Lo que existe y NO se toca:
- `worker/src/utils/calibration.js` — engine v1, sigue activo
- Tabla `user_calibration` — sigue siendo la fuente de verdad hasta Fase 4
- Tabla `ai_corrections` — se añaden columnas, nunca se borran datos
- Todos los endpoints existentes de calibración — sin cambios

### Parámetros estadísticos reales (calculados de D1):
```
mean_factor:         0.9937   → Claude casi no tiene sesgo global
variance_factor:     0.003770 → σ_pop = 0.0614
mean_abs_correction: 0.0161   → correcciones medias muy pequeñas
min_factor:          0.7143   → caso más extremo real
max_factor:          1.25     → caso más extremo real
total_corrections:   82       → pero mayoría son confirmaciones
```

---

## FASE 0 — LIMPIEZA DE DATOS (SQL PURO)

Ejecutar en D1 Console en este orden exacto. Verificar cada resultado antes de continuar.

### 0.1 — Añadir columnas a ai_corrections

```sql
-- Separación señal/ruido
ALTER TABLE ai_corrections
ADD COLUMN is_real_correction INTEGER DEFAULT 0;

-- Categorías normalizadas (se rellenan en Fase 1)
ALTER TABLE ai_corrections
ADD COLUMN normalized_categories TEXT DEFAULT '[]';

-- Factor aplicado en el momento de estimar
-- (permite auditar si la calibración ayudó)
ALTER TABLE ai_corrections
ADD COLUMN applied_factor REAL DEFAULT 1.0;

-- Versión del engine que generó la calibración
ALTER TABLE ai_corrections
ADD COLUMN calibration_version INTEGER DEFAULT 1;

-- Fuente de la señal de calibración
ALTER TABLE ai_corrections
ADD COLUMN signal_source TEXT DEFAULT 'explicit';
-- Valores: 'explicit' | 'cross_method' | 'verified_db' | 'implicit'
```

### 0.2 — Marcar correcciones reales

```sql
-- Umbral 4%: mayor que errores de redondeo (480→500 = 4.2%)
-- pero captura señal real. Basado en mean_abs_correction = 1.6%
-- la mayoría de "no correcciones" son <3%, las reales >4%.

UPDATE ai_corrections
SET is_real_correction = 1
WHERE accepted_without_change = 0
  AND ABS(correction_pct) >= 0.04
  AND ai_raw_estimate > 50
  AND user_final > 50
  AND ai_raw_estimate IS NOT NULL
  AND user_final IS NOT NULL;

-- Verificar resultado:
SELECT
  COUNT(*) as total,
  SUM(is_real_correction) as real_corrections,
  ROUND(100.0 * SUM(is_real_correction) / COUNT(*), 1) as pct_real,
  AVG(CASE WHEN is_real_correction = 1
      THEN CAST(user_final AS REAL) / ai_raw_estimate END) as mean_factor_real
FROM ai_corrections;
-- Guardar este output — son los parámetros reales del prior
```

### 0.3 — Añadir columnas a user_calibration

```sql
ALTER TABLE user_calibration
ADD COLUMN real_corrections INTEGER DEFAULT 0;

ALTER TABLE user_calibration
ADD COLUMN cir REAL DEFAULT NULL;
-- CIR: Calibration Improvement Rate
-- NULL = sin datos suficientes
-- >0   = calibración mejora estimaciones
-- <0   = calibración empeora (trigger self-healing)

ALTER TABLE user_calibration
ADD COLUMN engine_version INTEGER DEFAULT 1;

ALTER TABLE user_calibration
ADD COLUMN last_validated_at TEXT DEFAULT NULL;
```

### 0.4 — Tabla para alimentos verificados (hook para BEDCA futuro)

```sql
-- Tabla vacía por ahora. Se poblará con BEDCA en el futuro.
-- El engine ya sabe consultarla. Cuando lleguen los datos, funciona.
CREATE TABLE IF NOT EXISTS verified_foods (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL,  -- lowercase, sin acentos, para matching
  aliases         TEXT DEFAULT '[]',  -- JSON array
  source          TEXT NOT NULL,  -- 'bedca' | 'usda' | 'manual'
  calories_100g   REAL,
  protein_100g    REAL,
  carbs_100g      REAL,
  fat_100g        REAL,
  typical_serving_g INTEGER,
  verified_at     TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_verified_foods_name
ON verified_foods(name_normalized);

-- Tabla de discrepancias Claude vs verdad verificada
-- Se rellena automáticamente cuando hay match
CREATE TABLE IF NOT EXISTS ai_vs_verified (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  correction_id     INTEGER REFERENCES ai_corrections(id),
  verified_food_id  INTEGER REFERENCES verified_foods(id),
  claude_estimate   INTEGER,
  verified_calories INTEGER,
  discrepancy_pct   REAL,
  created_at        TEXT DEFAULT (datetime('now'))
);
```

---

## FASE 1 — MÓDULOS DEL ENGINE V2

Crear directorio `worker/src/calibration/` con estos archivos.
NO modificar nada fuera de este directorio todavía.

### `worker/src/calibration/prior.js`

```js
/**
 * Parámetros del prior de población.
 * Calculados de datos reales de D1 el 2026-03-24.
 * 
 * ACTUALIZAR trimestralmente ejecutando:
 * SELECT
 *   AVG(CAST(user_final AS REAL) / ai_raw_estimate) as mu,
 *   AVG((...variance...)) as variance
 * FROM ai_corrections
 * WHERE is_real_correction = 1;
 */
export const POPULATION_PRIOR = {
  // Sesgo medio poblacional — Claude es casi perfecto en media
  mu: 0.9937,

  // Dispersión entre usuarios — σ = sqrt(0.003770) = 0.0614
  sigma: 0.0614,

  // Ruido de medición: variabilidad del mismo usuario en el mismo plato.
  // No tenemos suficientes datos para calcularlo empíricamente todavía.
  // Valor conservador: si σ_pop = 0.061, σ_noise ≈ 2× σ_pop es razonable.
  // TODO: recalcular cuando haya ≥5 correcciones del mismo plato por usuario.
  sigma_noise: 0.12,

  // Guard rails basados en datos reales:
  // min_factor real = 0.714, max_factor real = 1.25
  // +5% de margen para casos extremos no vistos todavía
  min_factor: 0.68,
  max_factor: 1.32,

  // Mínimo de correcciones REALES para activar calibración.
  // Con menos de esto, devolver prior sin modificar.
  min_real_n: 3,

  // Metadatos para auditoría
  computed_from_n: 82,
  computed_at: '2026-03-24',
  version: 2,
};

/**
 * Umbrales de confianza.
 * Deliberadamente conservadores: la confianza debe ganarse.
 * 
 * La mayoría de usuarios vivirán en 'learning' semanas.
 * 'high' requiere 20+ correcciones reales Y CIR positivo sostenido.
 * Esto es correcto — una barra verde fácil no genera confianza real.
 */
export const CONFIDENCE_THRESHOLDS = {
  none:     { min_real_n: 0,  max_real_n: 2,  cir_required: null,  label: 'Sin datos' },
  starting: { min_real_n: 3,  max_real_n: 7,  cir_required: null,  label: 'Iniciando' },
  learning: { min_real_n: 8,  max_real_n: 14, cir_required: 0.0,   label: 'Aprendiendo' },
  good:     { min_real_n: 15, max_real_n: 24, cir_required: 0.05,  label: 'Buena precisión' },
  high:     { min_real_n: 25, max_real_n: Infinity, cir_required: 0.10, label: 'Alta precisión' },
};

export function getConfidenceLevel(realN, cir) {
  if (realN < 3) return 'none';
  if (realN < 8) return 'starting';

  // A partir de 'learning', también se requiere CIR positivo
  const hasCIR = cir !== null && cir >= 0.0;
  if (realN < 15) return hasCIR ? 'learning' : 'starting';

  const hasGoodCIR = cir !== null && cir >= 0.05;
  if (realN < 25) return hasGoodCIR ? 'good' : 'learning';

  const hasHighCIR = cir !== null && cir >= 0.10;
  return hasHighCIR ? 'high' : 'good';
}
```

---

### `worker/src/calibration/taxonomy.js`

```js
/**
 * Mapa de normalización de categorías.
 * 
 * Claude genera categorías en español, inglés, con mayúsculas,
 * con variantes. Este mapa las convierte a 12 categorías canónicas.
 * 
 * Añadir nuevas entradas cuando aparezcan categorías no mapeadas.
 * Las no mapeadas caen a 'main' (fallback seguro).
 */
const RAW_TO_CANONICAL = {
  // PROTEIN — carne, pescado, huevos
  'proteína': 'protein',
  'proteína animal': 'protein',
  'carne roja': 'protein',
  'carne': 'protein',
  'pollo': 'protein',
  'pork': 'protein',
  'fried_chicken': 'protein',
  'pescado': 'protein',
  'fish': 'protein',
  'huevos': 'protein',
  'eggs': 'protein',
  'seafood': 'protein',

  // CARBS — pasta, arroz, pan, cereales
  'carbohidratos': 'carbs',
  'hidratos de carbono': 'carbs',
  'pasta': 'carbs',
  'arroz y cereales': 'carbs',
  'rice_dish': 'carbs',
  'cereales': 'carbs',
  'pan': 'carbs',
  'bread': 'carbs',
  'potato_dish': 'carbs',
  'patatas': 'carbs',

  // RESTAURANT — comida fuera de casa
  'fast_food': 'restaurant',
  'takeaway': 'restaurant',
  'tapas': 'restaurant',
  'spanish_cuisine': 'restaurant',
  'sandwich': 'restaurant',
  'bocadillo': 'restaurant',
  'pizza': 'restaurant',

  // BREAKFAST — desayuno y merienda típicos
  'desayuno': 'breakfast',
  'breakfast': 'breakfast',
  'desayuno/merienda': 'breakfast',

  // DAIRY — lácteos
  'lácteos': 'dairy',
  'bebida láctea': 'dairy',
  'dairy': 'dairy',
  'yogur': 'dairy',
  'queso': 'dairy',
  'cheese': 'dairy',

  // PASTRY — dulces, repostería
  'dessert': 'pastry',
  'bakery': 'pastry',
  'pastry': 'pastry',
  'chocolate': 'pastry',
  'bollería': 'pastry',
  'dulces': 'pastry',

  // VEGETABLES — verduras, ensaladas
  'verduras': 'vegetables',
  'ensalada': 'vegetables',
  'vegetables': 'vegetables',
  'salad': 'vegetables',

  // FRUIT — fruta y snacks saludables
  'fruta': 'fruit',
  'fruit': 'fruit',
  'snack saludable': 'fruit',

  // PROCESSED — embutidos, procesados
  'embutido': 'processed',
  'processed': 'processed',
  'cured_meat': 'processed',
  'deli': 'processed',
  'charcuterie': 'processed',
  'productos cárnicos': 'processed',

  // FATS — aceites, salsas, grasas
  'grasas': 'fats',
  'grasas saludables': 'fats',
  'salsas': 'fats',
  'aceite': 'fats',

  // DRINKS — bebidas
  'bebidas': 'drinks',
  'bebida': 'drinks',
  'drinks': 'drinks',

  // MAIN — platos completos sin categoría más específica
  'plato principal': 'main',
  'main_course': 'main',
  'comida principal': 'main',
  'homemade': 'main',
  'high_carb': 'main',
  'mushroom_sauce': 'main',
};

/**
 * Normaliza un array de categorías raw a categorías canónicas.
 * Máximo 3 categorías por corrección (las más específicas primero).
 * Fallback a ['main'] si ninguna mapea.
 */
export function normalizeCategories(rawCategoriesJson) {
  try {
    const raw = JSON.parse(rawCategoriesJson || '[]');
    if (!Array.isArray(raw)) return ['main'];

    const normalized = raw
      .map(cat => RAW_TO_CANONICAL[cat?.toLowerCase?.()?.trim()])
      .filter(Boolean);

    const unique = [...new Set(normalized)].slice(0, 3);
    return unique.length > 0 ? unique : ['main'];
  } catch {
    return ['main'];
  }
}

/**
 * Para uso futuro con BEDCA:
 * Normaliza un nombre de alimento para matching sin acentos ni mayúsculas.
 */
export function normalizeFoodName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
```

---

### `worker/src/calibration/metrics.js`

```js
import { POPULATION_PRIOR, CONFIDENCE_THRESHOLDS, getConfidenceLevel } from './prior.js';

/**
 * Determina si una corrección es señal real o confirmación/ruido.
 * Umbral 4%: conservador pero captura señal real.
 */
export function isRealCorrection(c) {
  return c.accepted_without_change === 0
    && Math.abs(c.correction_pct ?? 0) >= 0.04
    && (c.ai_raw_estimate ?? 0) > 50
    && (c.user_final ?? 0) > 50;
}

/**
 * Peso de fiabilidad de una corrección según su tamaño.
 * 
 * Correcciones pequeñas = señal precisa (usuario ajustó con cuidado).
 * Correcciones enormes = posible error de entrada o plato muy diferente.
 */
export function correctionWeight(correction_pct) {
  const abs = Math.abs(correction_pct ?? 0);
  if (abs < 0.10) return 1.00;
  if (abs < 0.25) return 0.85;
  if (abs < 0.45) return 0.60;
  if (abs < 0.70) return 0.30;
  return 0.10;
}

/**
 * Calibration Improvement Rate (CIR).
 * La única métrica que importa: ¿está el engine mejorando las estimaciones?
 * 
 * CIR > 0:  el engine es mejor que Claude sin calibrar
 * CIR = 0:  el engine no hace nada
 * CIR < 0:  el engine empeora las estimaciones → trigger self-healing
 * 
 * Requiere ≥3 correcciones reales para ser significativo.
 */
export function calculateCIR(corrections) {
  const real = corrections.filter(isRealCorrection);
  if (real.length < 3) return null;

  const n = real.length;

  // Error medio de Claude sin calibrar
  const errorRaw = real.reduce((sum, c) =>
    sum + Math.abs(c.ai_raw_estimate - c.user_final), 0) / n;

  // Error medio con calibración aplicada
  // Si ai_calibrated no está disponible, usar ai_raw_estimate
  const errorCalibrated = real.reduce((sum, c) => {
    const calibrated = c.ai_calibrated ?? c.ai_raw_estimate;
    return sum + Math.abs(calibrated - c.user_final);
  }, 0) / n;

  if (errorRaw === 0) return null;
  return 1 - (errorCalibrated / errorRaw);
}

/**
 * Determina si el self-healing debe activarse.
 * Se activa si CIR < -5% (empeoramos más de un 5%).
 */
export function shouldActivateSelfHealing(cir) {
  return cir !== null && cir < -0.05;
}

/**
 * Construye el objeto de estado del perfil de calibración
 * para mostrar en el frontend.
 */
export function buildCalibrationProfile(corrections, userFactor, cir) {
  const total = corrections.length;
  const realN = corrections.filter(isRealCorrection).length;
  const confidence = getConfidenceLevel(realN, cir);
  const label = CONFIDENCE_THRESHOLDS[confidence]?.label ?? 'Sin datos';

  // Progreso hacia el siguiente nivel (0.0 → 1.0)
  // Se usa para la barra de progreso en UI
  const currentThreshold = CONFIDENCE_THRESHOLDS[confidence];
  const nextConfidence = {
    none: 'starting', starting: 'learning', learning: 'good',
    good: 'high', high: 'high'
  }[confidence];
  const nextThreshold = CONFIDENCE_THRESHOLDS[nextConfidence];

  let progress = 0;
  if (confidence !== 'high' && nextThreshold) {
    const range = nextThreshold.min_real_n - (currentThreshold.min_real_n ?? 0);
    const position = realN - (currentThreshold.min_real_n ?? 0);
    progress = Math.min(1.0, Math.max(0, position / range));
  } else if (confidence === 'high') {
    progress = 1.0;
  }

  return {
    total_corrections: total,
    real_corrections: realN,
    confidence,
    confidence_label: label,
    progress,       // 0.0–1.0 para la barra de UI
    cir,
    effective_factor: userFactor,
    is_improving: cir !== null && cir > 0,
  };
}
```

---

### `worker/src/calibration/bayesian.js`

```js
import { POPULATION_PRIOR } from './prior.js';
import { isRealCorrection, correctionWeight, shouldActivateSelfHealing } from './metrics.js';

/**
 * Posterior gaussiano conjugado.
 *
 * Modelo: el "factor de porción" personal β sigue una distribución normal.
 * Prior:  β ~ N(μ_0, σ_0²)  donde μ_0 = 0.9937, σ_0 = 0.0614
 * Datos:  y_j = user_final_j / ai_raw_estimate_j ~ N(β, σ_noise²)
 *
 * Posterior: β|y ~ N(μ_n, σ_n²) donde:
 *   precision_prior = 1/σ_0²
 *   precision_data  = Σw_j / σ_noise²
 *   μ_n = (precision_prior·μ_0 + precision_data·ȳ_w) / (precision_prior + precision_data)
 *   σ_n = 1/sqrt(precision_prior + precision_data)
 *
 * Con pocos datos: μ_n ≈ μ_0 (prior domina → conservador, fiable)
 * Con muchos datos: μ_n ≈ ȳ_w (datos dominan → personalizado)
 *
 * Esta función acepta un prior opcional para partial pooling por categoría.
 */
export function computeBayesianPosterior(corrections, customPrior = null) {
  const prior = customPrior ?? {
    mu: POPULATION_PRIOR.mu,
    sigma: POPULATION_PRIOR.sigma,
  };

  const real = corrections.filter(isRealCorrection);

  if (real.length < POPULATION_PRIOR.min_real_n) {
    return {
      mu: prior.mu,
      sigma: prior.sigma,
      real_n: 0,
      source: 'prior_only',
    };
  }

  // Calcular factores con sus pesos de fiabilidad
  const weighted = real.map(c => ({
    y: Math.max(
      POPULATION_PRIOR.min_factor,
      Math.min(POPULATION_PRIOR.max_factor,
        c.user_final / c.ai_raw_estimate
      )
    ),
    w: correctionWeight(c.correction_pct),
  }));

  const totalWeight = weighted.reduce((s, f) => s + f.w, 0);
  const weightedMean = weighted.reduce((s, f) => s + f.y * f.w, 0) / totalWeight;

  // Precisiones bayesianas
  const precisionPrior = 1 / (prior.sigma ** 2);
  const precisionData  = totalWeight / (POPULATION_PRIOR.sigma_noise ** 2);
  const precisionPost  = precisionPrior + precisionData;

  const muPost    = (precisionPrior * prior.mu + precisionData * weightedMean) / precisionPost;
  const sigmaPost = Math.sqrt(1 / precisionPost);

  // Aplicar guard rails
  const safeMu = Math.max(
    POPULATION_PRIOR.min_factor,
    Math.min(POPULATION_PRIOR.max_factor, muPost)
  );

  return {
    mu: safeMu,
    sigma: sigmaPost,
    real_n: real.length,
    source: real.length < 8 ? 'prior_dominant' : 'data_dominant',
  };
}

/**
 * Self-healing: si el engine está empeorando las estimaciones,
 * reducir el factor hacia el prior de forma gradual.
 * No notificar al usuario — corregir silenciosamente.
 */
export function applySelfHealing(currentMu, cir) {
  if (!shouldActivateSelfHealing(cir)) return currentMu;

  // Mover 30% hacia el prior en cada activación
  const healedMu = currentMu * 0.70 + POPULATION_PRIOR.mu * 0.30;
  return Math.max(
    POPULATION_PRIOR.min_factor,
    Math.min(POPULATION_PRIOR.max_factor, healedMu)
  );
}
```

---

### `worker/src/calibration/categories.js`

```js
import { computeBayesianPosterior } from './bayesian.js';
import { normalizeCategories } from './taxonomy.js';
import { isRealCorrection } from './metrics.js';

/**
 * Factor de categoría con partial pooling.
 *
 * Partial pooling: el prior de la categoría es el factor personal del usuario,
 * no el prior de la población. Esto significa que un usuario que come
 * consistentemente más de lo que Claude estima, probablemente también come
 * más en categorías sin datos previos.
 *
 * Si no hay suficientes datos de categoría, devuelve el factor personal.
 */
const MIN_CATEGORY_N = 4;

function categoryBlendWeight(n) {
  if (n < MIN_CATEGORY_N) return 0;
  if (n < 8)  return 0.25;
  if (n < 15) return 0.55;
  if (n < 25) return 0.75;
  return 0.90;  // Nunca 100% — el personal global siempre tiene peso
}

export function computeCategoryFactors(corrections, targetCategories, personalFactor) {
  const result = {};

  for (const cat of targetCategories) {
    // Filtrar correcciones de esta categoría
    const catCorrections = corrections.filter(c => {
      const normalized = (() => {
        try { return JSON.parse(c.normalized_categories || '[]'); }
        catch { return []; }
      })();
      return normalized.includes(cat);
    });

    const realN = catCorrections.filter(isRealCorrection).length;

    if (realN < MIN_CATEGORY_N) {
      result[cat] = { factor: personalFactor.mu, n: realN, source: 'personal_fallback' };
      continue;
    }

    // Prior de categoría = factor personal del usuario (partial pooling)
    const catPosterior = computeBayesianPosterior(catCorrections, {
      mu: personalFactor.mu,
      sigma: personalFactor.sigma * 1.5,  // prior más amplio en nivel categoría
    });

    const blend = categoryBlendWeight(realN);
    const blendedFactor = blend * catPosterior.mu + (1 - blend) * personalFactor.mu;

    result[cat] = {
      factor: blendedFactor,
      n: realN,
      source: 'category_calibrated',
    };
  }

  return result;
}
```

---

### `worker/src/calibration/verified.js`

```js
/**
 * Integración con bases de datos verificadas (BEDCA, USDA).
 *
 * ESTADO ACTUAL: tabla verified_foods vacía.
 * Este módulo está preparado para cuando se importen datos de BEDCA.
 * El engine ya lo consulta — cuando lleguen los datos, funciona sin cambios.
 */

import { normalizeFoodName } from './taxonomy.js';

/**
 * Busca un alimento identificado por Claude en la base verificada.
 * Retorna null si no hay match o si la tabla está vacía.
 */
export async function findVerifiedFood(foodName, env) {
  if (!foodName) return null;

  const normalized = normalizeFoodName(foodName);

  try {
    // Búsqueda exacta primero
    const exact = await env.DB.prepare(`
      SELECT * FROM verified_foods
      WHERE name_normalized = ?
      LIMIT 1
    `).bind(normalized).first();

    if (exact) return { food: exact, match_type: 'exact' };

    // Búsqueda parcial (el nombre de Claude puede ser más largo)
    const partial = await env.DB.prepare(`
      SELECT * FROM verified_foods
      WHERE name_normalized LIKE ?
        OR ? LIKE '%' || name_normalized || '%'
      LIMIT 1
    `).bind(`%${normalized}%`, normalized).first();

    if (partial) return { food: partial, match_type: 'partial' };

    return null;
  } catch {
    // La tabla puede no existir todavía — fallo silencioso
    return null;
  }
}

/**
 * Registra una discrepancia entre Claude y la base verificada.
 * Acumula datos para calibrar el prior de platos específicos.
 */
export async function recordVerifiedDiscrepancy(correctionId, verifiedFood, claudeEstimate, env) {
  if (!verifiedFood) return;

  const verifiedCalories = verifiedFood.calories_100g
    ? Math.round(verifiedFood.calories_100g * (verifiedFood.typical_serving_g ?? 100) / 100)
    : null;

  if (!verifiedCalories || verifiedCalories === 0) return;

  const discrepancy = (claudeEstimate - verifiedCalories) / verifiedCalories;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO ai_vs_verified
      (correction_id, verified_food_id, claude_estimate, verified_calories, discrepancy_pct)
    VALUES (?, ?, ?, ?, ?)
  `).bind(correctionId, verifiedFood.id, claudeEstimate, verifiedCalories, discrepancy).run();
}
```

---

### `worker/src/calibration/engine.js` — El orquestador

```js
import { POPULATION_PRIOR } from './prior.js';
import { computeBayesianPosterior, applySelfHealing } from './bayesian.js';
import { computeCategoryFactors } from './categories.js';
import { normalizeCategories } from './taxonomy.js';
import { calculateCIR, buildCalibrationProfile } from './metrics.js';
import { findVerifiedFood, recordVerifiedDiscrepancy } from './verified.js';

/**
 * Función principal del engine v2.
 *
 * Recibe la estimación raw de Claude y devuelve:
 * - calibrated: la estimación ajustada
 * - ci_low / ci_high: intervalo de confianza 95%
 * - factor: el factor aplicado (para logging)
 * - confidence: nivel de confianza
 * - profile: datos para la UI del motor personal
 *
 * El engine NO modifica la BD — solo lee y calcula.
 * La escritura (recalibración) se hace en recalibration.js
 */
export async function applyCalibrationV2(rawEstimate, userId, rawCategories, env) {
  // Cargar correcciones del usuario
  const correctionsResult = await env.DB.prepare(`
    SELECT * FROM ai_corrections
    WHERE user_id = ?
    ORDER BY created_at ASC
  `).bind(userId).all();

  const corrections = correctionsResult.results ?? [];

  // Normalizar categorías del plato actual
  const normalizedCats = normalizeCategories(rawCategories);

  // Capa 1: Factor personal global (Bayesian)
  const cir = calculateCIR(corrections);
  let personal = computeBayesianPosterior(corrections);

  // Self-healing si el engine está empeorando
  if (personal.real_n >= POPULATION_PRIOR.min_real_n) {
    personal.mu = applySelfHealing(personal.mu, cir);
  }

  // Capa 2: Factor por categoría normalizada
  const categoryFactors = computeCategoryFactors(corrections, normalizedCats, personal);

  // Factor final: media de los factores de categorías relevantes
  const relevantFactors = normalizedCats
    .map(cat => categoryFactors[cat]?.factor)
    .filter(f => f != null);

  const finalFactor = relevantFactors.length > 0
    ? relevantFactors.reduce((a, b) => a + b, 0) / relevantFactors.length
    : personal.mu;

  // Guard rails absolutos
  const safeFactor = Math.max(
    POPULATION_PRIOR.min_factor,
    Math.min(POPULATION_PRIOR.max_factor, finalFactor)
  );

  // Intervalo de confianza 95% (z=1.96)
  const ciWidth = personal.sigma * 1.96;

  // Construir perfil para UI
  const profile = buildCalibrationProfile(corrections, safeFactor, cir);

  return {
    calibrated: Math.round(rawEstimate * safeFactor),
    factor: safeFactor,
    ci_low:  Math.round(rawEstimate * Math.max(0.40, safeFactor - ciWidth)),
    ci_high: Math.round(rawEstimate * Math.min(2.50, safeFactor + ciWidth)),
    confidence: profile.confidence,
    profile,
    engine_version: 2,
  };
}

/**
 * Punto de entrada principal del engine.
 * 
 * Intenta v2 primero. Si falla (error inesperado),
 * devuelve la estimación raw sin calibrar.
 * NUNCA debe romper el flujo principal.
 */
export async function calibrate(rawEstimate, userId, rawCategories, env) {
  try {
    return await applyCalibrationV2(rawEstimate, userId, rawCategories, env);
  } catch (error) {
    console.error('[CalibrationV2] Error, falling back to raw:', error);
    return {
      calibrated: rawEstimate,
      factor: 1.0,
      ci_low: Math.round(rawEstimate * 0.75),
      ci_high: Math.round(rawEstimate * 1.25),
      confidence: 'none',
      profile: null,
      engine_version: 0,  // 0 = fallback, sin calibración
    };
  }
}
```

---

### `worker/src/calibration/recalibration.js`

```js
import { computeBayesianPosterior, applySelfHealing } from './bayesian.js';
import { normalizeCategories } from './taxonomy.js';
import { calculateCIR, getConfidenceLevel } from './metrics.js';
import { POPULATION_PRIOR } from './prior.js';

/**
 * Actualiza el perfil de calibración del usuario en user_calibration.
 *
 * Se llama SOLO cuando hay señal suficiente para recalibrar:
 * - Han llegado 3+ correcciones reales nuevas desde la última vez
 * - O han pasado más de 7 días con al menos 1 corrección real nueva
 *
 * NO se llama en cada request. La recalibración es un proceso batch.
 */
export async function recalibrateUser(userId, env) {
  const corrections = await env.DB.prepare(`
    SELECT * FROM ai_corrections
    WHERE user_id = ?
    ORDER BY created_at ASC
  `).bind(userId).all();

  const all = corrections.results ?? [];
  const cir = calculateCIR(all);

  const posterior = computeBayesianPosterior(all);
  const healedMu = applySelfHealing(posterior.mu, cir);
  const confidence = getConfidenceLevel(posterior.real_n, cir);

  // Normalizar todas las categorías para mantener normalized_categories actualizado
  for (const c of all) {
    if (!c.normalized_categories || c.normalized_categories === '[]') {
      const normalized = normalizeCategories(c.food_categories);
      await env.DB.prepare(`
        UPDATE ai_corrections
        SET normalized_categories = ?
        WHERE id = ?
      `).bind(JSON.stringify(normalized), c.id).run();
    }
  }

  await env.DB.prepare(`
    INSERT INTO user_calibration
      (user_id, global_bias, confidence, data_points,
       real_corrections, cir, engine_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 2, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      global_bias = excluded.global_bias,
      confidence = excluded.confidence,
      data_points = excluded.data_points,
      real_corrections = excluded.real_corrections,
      cir = excluded.cir,
      engine_version = excluded.engine_version,
      updated_at = excluded.updated_at
  `).bind(
    userId,
    healedMu,
    confidence,
    all.length,
    posterior.real_n,
    cir,
  ).run();

  return { factor: healedMu, confidence, real_n: posterior.real_n, cir };
}

/**
 * Determina si hay suficiente señal nueva para recalibrar.
 * Leer de user_calibration para comparar con estado actual.
 */
export async function shouldRecalibrate(userId, env) {
  const current = await env.DB.prepare(`
    SELECT updated_at, real_corrections FROM user_calibration
    WHERE user_id = ?
  `).bind(userId).first();

  const newCorrections = await env.DB.prepare(`
    SELECT COUNT(*) as n FROM ai_corrections
    WHERE user_id = ?
      AND is_real_correction = 1
      AND created_at > COALESCE(?, '1970-01-01')
  `).bind(userId, current?.updated_at ?? null).first();

  const newN = newCorrections?.n ?? 0;
  const hoursSince = current?.updated_at
    ? (Date.now() - new Date(current.updated_at)) / 3600000
    : Infinity;

  // Recalibrar si: primera vez, 3+ correcciones reales nuevas,
  // o 7 días con al menos 1 corrección nueva
  return !current || newN >= 3 || (hoursSince > 168 && newN >= 1);
}
```

---

## FASE 2 — INTEGRACIÓN EN EL WORKER (shadow mode)

### En `worker/src/index.js` o el archivo de routing principal:

```js
import { calibrate } from './calibration/engine.js';
import { shouldRecalibrate, recalibrateUser } from './calibration/recalibration.js';

// En el endpoint de análisis de foto (/api/entries/analyze-photo)
// y texto (/api/entries/analyze-text):

// DESPUÉS de obtener la estimación raw de Claude:
const rawEstimate = claudeResponse.calories;

// V2: calcular en paralelo sin reemplazar todavía
const v2Result = await calibrate(rawEstimate, user.id, claudeCategories, env);

// Por ahora: seguir usando el engine v1 para la respuesta al usuario
// PERO guardar el resultado v2 para comparación y logging

// Guardar para auditoría (NO enviar al usuario todavía)
// Añadir a la corrección cuando se guarde:
// applied_factor_v2 = v2Result.factor
// calibrated_v2 = v2Result.calibrated

// Trigger de recalibración en background (no bloquear la respuesta)
env.ctx?.waitUntil(
  shouldRecalibrate(user.id, env).then(should => {
    if (should) return recalibrateUser(user.id, env);
  })
);
```

**En este punto el engine v2 corre en shadow mode:**
- Calcula su resultado
- Lo guarda para comparación
- NO modifica lo que ve el usuario
- El engine v1 sigue siendo la fuente de verdad

---

## FASE 3 — VALIDACIÓN (antes de activar v2)

Ejecutar esta query después de 1-2 semanas de shadow mode:

```sql
-- Comparar error v1 vs v2 sobre correcciones reales recientes
SELECT
  AVG(ABS(c.ai_calibrated - c.user_final)) as error_v1,
  -- Necesitaría columna ai_calibrated_v2 para comparar
  COUNT(*) as n,
  AVG(ABS(c.correction_pct)) as mean_real_correction
FROM ai_corrections c
WHERE c.is_real_correction = 1
  AND c.created_at > datetime('now', '-14 days');
```

Si error_v2 < error_v1 consistentemente → activar Fase 4.
Si no → revisar parámetros antes de activar.

---

## FASE 4 — ACTIVACIÓN (solo cuando Fase 3 confirme mejora)

Cambiar en `worker/src/index.js`:

```js
// Antes (v1):
const calibrated = applyExistingCalibration(rawEstimate, userProfile);

// Después (v2):
const v2Result = await calibrate(rawEstimate, user.id, claudeCategories, env);
const calibrated = v2Result.calibrated;

// Guardar factor aplicado para auditoría futura
// en applied_factor de ai_corrections
```

---

## FASE 5 — ACTUALIZACIÓN UI (después de Fase 4)

### Cambios en `Profile.jsx` — sección "Tu motor personal":

```jsx
// Los datos a mostrar vienen del endpoint GET /api/calibration/profile
// que devuelve el objeto `profile` del buildCalibrationProfile()

const CalibrationCard = ({ profile }) => {
  if (!profile) return null;

  return (
    <div style={{ background: '#111', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ background: '#16a34a', color: '#fff', fontSize: 9,
          fontWeight: 600, padding: '2px 8px', borderRadius: 100 }}>Pro</span>
        <span style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic',
          fontSize: 16, color: '#fff' }}>Tu motor personal</span>
      </div>

      {/* Barra de progreso — deliberadamente lenta */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
          <span>{profile.real_corrections} correcciones útiles</span>
          <span>{profile.confidence_label}</span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.1)',
          borderRadius: 100, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${profile.progress * 100}%`,
            background: profile.is_improving ? '#16a34a' : '#888',
            borderRadius: 100,
            transition: 'width 0.8s ease',
          }} />
        </div>
      </div>

      {/* CIR — solo mostrar si hay datos */}
      {profile.cir !== null && (
        <p style={{ fontSize: 11, color: profile.is_improving
          ? '#a8d5b5' : 'rgba(255,255,255,0.4)', margin: '8px 0' }}>
          {profile.is_improving
            ? `+${Math.round(profile.cir * 100)}% más preciso que sin calibrar`
            : 'Aún aprendiendo tus hábitos'}
        </p>
      )}

      {/* Comidas más registradas */}
      {/* ... sin cambios respecto al diseño actual ... */}
    </div>
  );
};
```

### Cambios en la UI de estimación (AddEntry):

```jsx
// Cuando el engine devuelve ci_low y ci_high con confianza > 'none':
{result.confidence !== 'none' && result.ci_low !== result.ci_high && (
  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0' }}>
    entre {result.ci_low} y {result.ci_high} kcal
  </p>
)}
```

---

## RESUMEN DE ARCHIVOS CREADOS

```
worker/src/calibration/
  ├── prior.js           ← Parámetros estadísticos reales
  ├── taxonomy.js        ← Normalización de categorías
  ├── metrics.js         ← isRealCorrection, CIR, buildCalibrationProfile
  ├── bayesian.js        ← Posterior gaussiano conjugado + self-healing
  ├── categories.js      ← Partial pooling por categoría
  ├── verified.js        ← Hook para BEDCA (tabla vacía, lista para datos)
  ├── engine.js          ← Orquestador principal con fallback
  └── recalibration.js   ← Recalibración batch inteligente
```

## ARCHIVOS NO TOCADOS

```
worker/src/utils/calibration.js  ← engine v1, sigue intacto hasta Fase 4
worker/src/index.js              ← solo añadir shadow mode en Fase 2
Toda la BD existente             ← solo añadimos columnas, nunca borramos
Todo el frontend                 ← sin cambios hasta Fase 5
```

## AL FINALIZAR FASE 1

```bash
git add worker/src/calibration/
git commit -m "feat: calibration engine v2 — bayesian, partial pooling, verified foods hook"
git push origin main
```

Verificar que no hay errores de importación.
El engine v1 sigue siendo la fuente de verdad.
No cambiar nada más hasta ejecutar las queries SQL de Fase 0.
