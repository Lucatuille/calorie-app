# 🎯 Motor de Auto-Calibración Personal — IA que aprende de cada usuario

## Contexto
LucaEats ya tiene análisis de fotos con IA funcionando. Vamos a añadir un sistema de aprendizaje personal que mejora la precisión de las estimaciones con cada corrección del usuario. El sistema es completamente invisible — el usuario solo nota que la app cada vez le conoce mejor.

---

## 1. BASE DE DATOS — Dos tablas nuevas

**Avisar para ejecutar en D1 Console:**

```sql
-- Log inmutable de cada corrección
CREATE TABLE ai_corrections (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id            INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  ai_raw_estimate     INTEGER NOT NULL,      -- lo que estimó la IA sin calibrar
  ai_calibrated       INTEGER NOT NULL,      -- lo que se mostró al usuario (calibrado)
  user_final          INTEGER NOT NULL,      -- lo que guardó el usuario
  correction_pct      REAL NOT NULL,         -- (user_final - ai_calibrated) / ai_calibrated
  food_categories     TEXT,                  -- JSON array: ["pasta","italian","homemade"]
  meal_type           TEXT,                  -- breakfast/lunch/dinner/snack
  has_context         INTEGER DEFAULT 0,     -- ¿escribió contexto adicional?
  is_weekend          INTEGER DEFAULT 0,     -- 1 si es sábado o domingo
  day_of_week         INTEGER,               -- 0=lunes ... 6=domingo
  hour_of_day         INTEGER,               -- hora local del registro
  accepted_without_change INTEGER DEFAULT 0, -- 1 si guardó sin modificar
  created_at          TEXT DEFAULT (datetime('now'))
);

-- Perfil de calibración calculado por usuario
CREATE TABLE user_calibration (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  global_bias     REAL DEFAULT 0,      -- factor de corrección global
  confidence      REAL DEFAULT 0,      -- fiabilidad del perfil (0-1)
  data_points     INTEGER DEFAULT 0,   -- total de correcciones registradas
  meal_factors    TEXT DEFAULT '{}',   -- JSON: factores por meal_type
  food_factors    TEXT DEFAULT '{}',   -- JSON: factores por categoría de comida
  time_factors    TEXT DEFAULT '{}',   -- JSON: factores por contexto temporal
  frequent_meals  TEXT DEFAULT '[]',   -- JSON: comidas frecuentes con kcal real
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_corrections_user ON ai_corrections(user_id, created_at);
```

---

## 2. WORKER — Lógica de calibración

Crear `worker/src/utils/calibration.js`:

### Función principal — calcular perfil desde correcciones:

```js
export function calculateCalibrationProfile(corrections) {
  if (!corrections || corrections.length === 0) {
    return { global_bias: 0, confidence: 0, data_points: 0,
             meal_factors: {}, food_factors: {}, time_factors: {} };
  }

  // Solo usar correcciones donde el usuario cambió el valor
  // (accepted_without_change = 0)
  const actualCorrections = corrections.filter(c => !c.accepted_without_change);
  
  if (actualCorrections.length === 0) {
    return { global_bias: 0, confidence: 0.3, data_points: corrections.length,
             meal_factors: {}, food_factors: {}, time_factors: {} };
  }

  // Bias global — media ponderada dando más peso a correcciones recientes
  const weightedBias = calculateWeightedMean(
    actualCorrections.map(c => c.correction_pct),
    actualCorrections.map((_, i) => Math.pow(1.1, i)) // más peso a las recientes
  );

  // Factores por meal_type (solo si hay 2+ muestras)
  const mealFactors = {};
  const mealGroups = groupBy(actualCorrections, 'meal_type');
  for (const [meal, items] of Object.entries(mealGroups)) {
    if (items.length >= 2) {
      mealFactors[meal] = {
        bias: calculateWeightedMean(items.map(c => c.correction_pct)),
        samples: items.length,
        confidence: Math.min(items.length / 8, 1) // max confidence con 8 muestras
      };
    }
  }

  // Factores por categoría de comida (solo si hay 2+ muestras)
  const foodFactors = {};
  const allFoodCategories = actualCorrections.flatMap(c => {
    try { return JSON.parse(c.food_categories || '[]'); } catch { return []; }
  });
  const uniqueCategories = [...new Set(allFoodCategories)];
  
  for (const category of uniqueCategories) {
    const categoryCorrections = actualCorrections.filter(c => {
      try {
        const cats = JSON.parse(c.food_categories || '[]');
        return cats.includes(category);
      } catch { return false; }
    });
    if (categoryCorrections.length >= 2) {
      foodFactors[category] = {
        bias: calculateWeightedMean(categoryCorrections.map(c => c.correction_pct)),
        samples: categoryCorrections.length
      };
    }
  }

  // Factores temporales
  const weekendCorrections = actualCorrections.filter(c => c.is_weekend);
  const weekdayCorrections = actualCorrections.filter(c => !c.is_weekend);
  const timeFactors = {};
  
  if (weekendCorrections.length >= 2 && weekdayCorrections.length >= 2) {
    const weekendBias = calculateWeightedMean(weekendCorrections.map(c => c.correction_pct));
    const weekdayBias = calculateWeightedMean(weekdayCorrections.map(c => c.correction_pct));
    if (Math.abs(weekendBias - weekdayBias) > 0.05) { // solo si hay diferencia real
      timeFactors.weekend_extra = weekendBias - weekdayBias;
    }
  }

  // Confianza global basada en número de correcciones
  const confidence = Math.min(actualCorrections.length / 15, 1);

  return {
    global_bias: weightedBias,
    confidence,
    data_points: corrections.length,
    meal_factors: mealFactors,
    food_factors: foodFactors,
    time_factors: timeFactors
  };
}

// Aplicar perfil de calibración a una estimación base
export function applyCalibration(baseEstimate, profile, context) {
  if (!profile || profile.confidence < 0.1) return baseEstimate;

  let factor = 1 + profile.global_bias;

  // Aplicar factor de meal_type si existe y tiene confianza
  const mealFactor = profile.meal_factors?.[context.meal_type];
  if (mealFactor && mealFactor.confidence > 0.3) {
    // Blend entre global y meal_type según confianza
    const blendWeight = mealFactor.confidence;
    const mealAdjustment = mealFactor.bias - profile.global_bias;
    factor += mealAdjustment * blendWeight;
  }

  // Aplicar factores de categoría de comida
  if (context.food_categories && profile.food_factors) {
    let categoryAdjustment = 0;
    let categoryCount = 0;
    for (const cat of context.food_categories) {
      if (profile.food_factors[cat]) {
        categoryAdjustment += profile.food_factors[cat].bias - profile.global_bias;
        categoryCount++;
      }
    }
    if (categoryCount > 0) {
      factor += (categoryAdjustment / categoryCount) * 0.6; // peso moderado
    }
  }

  // Aplicar factor de fin de semana
  if (context.is_weekend && profile.time_factors?.weekend_extra) {
    factor += profile.time_factors.weekend_extra * 0.5;
  }

  // Cap: nunca aplicar factor mayor de +80% ni menor de -30%
  factor = Math.max(0.7, Math.min(1.8, factor));

  return Math.round(baseEstimate * factor);
}

function calculateWeightedMean(values, weights = null) {
  if (!weights) weights = new Array(values.length).fill(1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
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
```

---

## 3. WORKER — Actualizar endpoint de análisis de foto

En el endpoint existente `/api/entries/analyze-photo`:

### Antes de llamar a Claude Vision:
```js
// 1. Cargar perfil de calibración del usuario
const calibrationRow = await env.DB.prepare(
  'SELECT * FROM user_calibration WHERE user_id = ?'
).bind(userId).first();

const calibrationProfile = calibrationRow ? {
  global_bias: calibrationRow.global_bias,
  confidence: calibrationRow.confidence,
  data_points: calibrationRow.data_points,
  meal_factors: JSON.parse(calibrationRow.meal_factors || '{}'),
  food_factors: JSON.parse(calibrationRow.food_factors || '{}'),
  time_factors: JSON.parse(calibrationRow.time_factors || '{}'),
  frequent_meals: JSON.parse(calibrationRow.frequent_meals || '[]'),
} : null;
```

### Después de recibir respuesta de Claude:
```js
const aiRawEstimate = claudeResult.calories;
const foodCategories = claudeResult.categories || []; // Claude debe devolver esto

// Buscar comida frecuente similar
const frequentMeals = calibrationProfile?.frequent_meals || [];
const similarMeal = findSimilarMeal(claudeResult.name, frequentMeals);

// Aplicar calibración
const isWeekend = [0, 6].includes(new Date().getDay());
const calibratedEstimate = applyCalibration(aiRawEstimate, calibrationProfile, {
  meal_type: mealType,
  food_categories: foodCategories,
  is_weekend: isWeekend
});

// Devolver al frontend con metadata de calibración
return {
  ...claudeResult,
  calories: calibratedEstimate,
  ai_raw: aiRawEstimate,
  calibration_applied: calibrationProfile?.confidence > 0.1,
  calibration_confidence: calibrationProfile?.confidence || 0,
  calibration_data_points: calibrationProfile?.data_points || 0,
  similar_meal: similarMeal, // null si no hay match
}

function findSimilarMeal(name, frequentMeals) {
  if (!name || !frequentMeals.length) return null;
  const nameLower = name.toLowerCase();
  for (const meal of frequentMeals) {
    const mealLower = meal.name.toLowerCase();
    // Match simple por palabras clave
    const words = nameLower.split(' ').filter(w => w.length > 3);
    const matches = words.filter(w => mealLower.includes(w));
    if (matches.length >= 2 || (words.length === 1 && matches.length === 1)) {
      return meal; // { name, avg_kcal, times, last_seen }
    }
  }
  return null;
}
```

### Actualizar el prompt a Claude para que devuelva categorías:
Añadir al prompt existente:
```
Añade también un campo "categories" con array de categorías del plato.
Ejemplos: ["pasta", "italian", "homemade"], ["grilled_chicken", "protein", "light"],
["salad", "vegetables", "dressing_likely"]
Máximo 4 categorías, en inglés, en snake_case.
```

---

## 4. WORKER — Nuevo endpoint para guardar corrección

### POST /api/entries/ai-correction

```js
// Body: { entry_id, ai_raw, ai_calibrated, user_final, 
//         food_categories, meal_type, has_context, accepted_without_change }

const correctionPct = (userFinal - aiCalibrated) / aiCalibrated;
const now = new Date();
const isWeekend = [0, 6].includes(now.getDay());

// 1. Guardar corrección
await env.DB.prepare(`
  INSERT INTO ai_corrections 
  (user_id, entry_id, ai_raw_estimate, ai_calibrated, user_final,
   correction_pct, food_categories, meal_type, has_context,
   is_weekend, day_of_week, hour_of_day, accepted_without_change)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  userId, entryId, aiRaw, aiCalibrated, userFinal,
  correctionPct, JSON.stringify(foodCategories), mealType,
  hasContext ? 1 : 0, isWeekend ? 1 : 0,
  now.getDay(), now.getHours(), acceptedWithoutChange ? 1 : 0
).run();

// 2. Recalcular perfil de calibración
const corrections = await env.DB.prepare(
  'SELECT * FROM ai_corrections WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
).bind(userId).all();

const newProfile = calculateCalibrationProfile(corrections.results);

// 3. Actualizar comidas frecuentes
const frequentMeals = await updateFrequentMeals(userId, mealName, userFinal, env);

// 4. Guardar perfil actualizado
await env.DB.prepare(`
  INSERT OR REPLACE INTO user_calibration 
  (user_id, global_bias, confidence, data_points, 
   meal_factors, food_factors, time_factors, frequent_meals, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`).bind(
  userId, newProfile.global_bias, newProfile.confidence, newProfile.data_points,
  JSON.stringify(newProfile.meal_factors), JSON.stringify(newProfile.food_factors),
  JSON.stringify(newProfile.time_factors), JSON.stringify(frequentMeals)
).run();

return { success: true, profile_updated: true };

async function updateFrequentMeals(userId, mealName, kcal, env) {
  const calibration = await env.DB.prepare(
    'SELECT frequent_meals FROM user_calibration WHERE user_id = ?'
  ).bind(userId).first();
  
  let meals = [];
  try { meals = JSON.parse(calibration?.frequent_meals || '[]'); } catch {}
  
  const existing = meals.find(m => m.name.toLowerCase() === mealName?.toLowerCase());
  if (existing) {
    existing.avg_kcal = Math.round((existing.avg_kcal * existing.times + kcal) / (existing.times + 1));
    existing.times++;
    existing.last_seen = new Date().toISOString().split('T')[0];
  } else if (mealName) {
    meals.push({ name: mealName, avg_kcal: kcal, times: 1,
                 last_seen: new Date().toISOString().split('T')[0] });
  }
  
  // Mantener solo top 20 más frecuentes
  return meals.sort((a, b) => b.times - a.times).slice(0, 20);
}
```

### GET /api/entries/calibration-profile

Devuelve el perfil de calibración del usuario para mostrarlo en el perfil:
```js
const profile = await env.DB.prepare(
  'SELECT * FROM user_calibration WHERE user_id = ?'
).bind(userId).first();

return {
  global_bias: profile?.global_bias || 0,
  confidence: profile?.confidence || 0,
  data_points: profile?.data_points || 0,
  meal_factors: JSON.parse(profile?.meal_factors || '{}'),
  food_factors: JSON.parse(profile?.food_factors || '{}'),
  frequent_meals: JSON.parse(profile?.frequent_meals || '[]'),
}
```

Registrar ambas rutas en `worker/src/index.js`.

---

## 5. FRONTEND — Actualizar flujo de análisis de foto

### En `AddEntryForm.jsx` — después del análisis:

El resultado de la IA ahora incluye metadatos de calibración. Mostrar de forma no invasiva:

```jsx
// Si hay calibración aplicada con confianza media-alta:
{result.calibration_applied && result.calibration_confidence > 0.3 && (
  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
    🎯 Ajustado a tus hábitos · {result.calibration_data_points} correcciones
  </p>
)}

// Si hay comida similar detectada:
{result.similar_meal && (
  <div style={{ 
    padding: '8px 12px', 
    background: 'var(--surface)', 
    borderRadius: '8px',
    marginTop: '8px'
  }}>
    <p style={{ fontSize: '0.8rem', margin: 0 }}>
      💡 Parece similar a <strong>{result.similar_meal.name}</strong> 
      &nbsp;({result.similar_meal.avg_kcal} kcal · {result.similar_meal.times}x registrada)
    </p>
    <button 
      onClick={() => setCalories(result.similar_meal.avg_kcal)}
      style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'none', 
               border: 'none', cursor: 'pointer', padding: '4px 0' }}
    >
      Usar este valor →
    </button>
  </div>
)}
```

### Guardar corrección automáticamente al salvar entrada:

En la función `handleSave` del formulario, después de guardar la entrada con éxito, si el formulario vino de un análisis de foto:

```js
// Guardar corrección silenciosamente (no bloquear el UX)
if (fromPhotoAnalysis) {
  api.saveAiCorrection({
    entry_id: savedEntry.id,
    ai_raw: photoAnalysisResult.ai_raw,
    ai_calibrated: photoAnalysisResult.calories, // lo que se mostró calibrado
    user_final: calories, // lo que guardó finalmente
    food_categories: photoAnalysisResult.categories || [],
    meal_type: selectedMealType,
    has_context: contextText?.trim().length > 0,
    accepted_without_change: calories === photoAnalysisResult.calories
  }, token).catch(() => {}); // silencioso — no mostrar error si falla
}
```

**IMPORTANTE:** Esta llamada es fire-and-forget. No esperar la respuesta, no mostrar loading, no mostrar error. El usuario no sabe que está pasando — simplemente la app aprende.

---

## 6. FRONTEND — Pantalla de calibración en Perfil

En `Profile.jsx`, añadir una nueva sección al final (antes del footer legal):

```jsx
// Fetch del perfil de calibración al cargar
const [calibration, setCalibration] = useState(null);

// Mostrar solo si hay datos suficientes (data_points >= 3)
{calibration && calibration.data_points >= 3 && (
  <section>
    <h3>📊 Tu motor personal</h3>
    
    <div style={{ /* card style */ }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Correcciones registradas</span>
        <strong>{calibration.data_points}</strong>
      </div>
      
      {/* Barra de precisión */}
      <div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Precisión del modelo
        </span>
        <div style={{ /* progress bar */ }}>
          <div style={{ width: `${calibration.confidence * 100}%`, 
                        background: 'var(--accent)' }} />
        </div>
        <span style={{ fontSize: '0.75rem' }}>
          {calibration.confidence < 0.3 ? 'Aprendiendo...' :
           calibration.confidence < 0.6 ? 'Mejorando' :
           calibration.confidence < 0.8 ? 'Buena precisión' : 'Alta precisión'}
        </span>
      </div>

      {/* Bias global */}
      {Math.abs(calibration.global_bias) > 0.05 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {calibration.global_bias > 0 
            ? `La IA tiende a subestimarte un ${Math.round(calibration.global_bias * 100)}%`
            : `La IA tiende a sobreestimarte un ${Math.round(Math.abs(calibration.global_bias) * 100)}%`
          }
        </p>
      )}

      {/* Factores por categoría (top 3) */}
      {Object.keys(calibration.food_factors).length > 0 && (
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Por tipo de comida:
          </p>
          {Object.entries(calibration.food_factors)
            .sort((a, b) => Math.abs(b[1].bias) - Math.abs(a[1].bias))
            .slice(0, 3)
            .map(([cat, data]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between',
                                      fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ textTransform: 'capitalize' }}>
                  {cat.replace('_', ' ')}
                </span>
                <span style={{ color: data.bias > 0 ? 'var(--accent-2)' : 'var(--accent)' }}>
                  {data.bias > 0 ? '+' : ''}{Math.round(data.bias * 100)}%
                </span>
              </div>
            ))
          }
        </div>
      )}

      {/* Comidas frecuentes (top 3) */}
      {calibration.frequent_meals?.length > 0 && (
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Tus comidas más registradas:
          </p>
          {calibration.frequent_meals.slice(0, 3).map(meal => (
            <div key={meal.name} style={{ display: 'flex', justifyContent: 'space-between',
                                          fontSize: '0.8rem', marginBottom: '4px' }}>
              <span>{meal.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {meal.avg_kcal} kcal · {meal.times}x
              </span>
            </div>
          ))}
        </div>
      )}

      <button 
        onClick={handleResetCalibration}
        style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', 
                 background: 'none', border: 'none', cursor: 'pointer',
                 marginTop: '8px', textDecoration: 'underline' }}
      >
        Resetear calibración
      </button>
    </div>
  </section>
)}
```

### Reset de calibración — endpoint en Worker:
```
DELETE /api/entries/calibration-profile
→ Borra user_calibration y ai_corrections del usuario
→ Confirmar con dialog inline antes de ejecutar
```

---

## 7. API.JS — Nuevos métodos

```js
saveAiCorrection: (body, token) =>
  request('POST', '/api/entries/ai-correction', body, token),

getCalibrationProfile: (token) =>
  request('GET', '/api/entries/calibration-profile', null, token),

resetCalibration: (token) =>
  request('DELETE', '/api/entries/calibration-profile', null, token),
```

---

## 8. ORDEN DE IMPLEMENTACIÓN

1. SQL en D1 — avisarme para ejecutar las dos tablas nuevas
2. Crear `worker/src/utils/calibration.js`
3. Actualizar endpoint `/api/entries/analyze-photo` para cargar y aplicar calibración
4. Actualizar prompt de Claude para que devuelva `categories`
5. Crear endpoint `POST /api/entries/ai-correction`
6. Crear endpoint `GET /api/entries/calibration-profile`
7. Crear endpoint `DELETE /api/entries/calibration-profile`
8. Registrar nuevas rutas en `index.js`
9. Desplegar Worker: `cd worker && npm run deploy`
10. Actualizar `AddEntryForm.jsx` — mostrar calibración aplicada + similar_meal
11. Añadir llamada fire-and-forget a `saveAiCorrection` al guardar
12. Actualizar `api.js` con nuevos métodos
13. Añadir sección de calibración en `Profile.jsx`

---

## 9. AL FINALIZAR

- Verificar con una foto real: el campo `calibration_applied` debe ser `false` la primera vez
- Hacer 3 correcciones y verificar que `user_calibration` se actualiza en D1
- En la 4a foto, `calibration_applied` debe ser `true` y el valor debe diferir del raw
- Verificar que la sección de perfil aparece solo con 3+ correcciones
- `git add . && git commit -m "feat: motor de auto-calibración personal de IA" && git push`
- Marcar en ROADMAP.md
