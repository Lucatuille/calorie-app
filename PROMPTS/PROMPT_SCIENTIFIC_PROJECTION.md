# 🔬 Rework Científico — Modelo de Proyección de Peso

## Contexto
Reemplazar completamente el modelo de proyección de peso actual en `worker/src/routes/progress.js` y en el componente `AdvancedAnalytics.jsx` por un modelo científicamente fundamentado que incorpore variabilidad calórica real, adherencia imperfecta y adaptación metabólica.

## Base científica del nuevo modelo

El modelo actual usa la regla simplista de 7.700 kcal = 1 kg, que sobreestima sistemáticamente la pérdida de peso. La literatura científica reciente (Hall et al., 2011; Thomas et al., 2014; Hall & Chow, 2014) demuestra que:

1. **La adherencia real promedio es ~64%** — las personas no siguen su dieta perfectamente todos los días
2. **La adaptación metabólica** reduce el TDEE ~46 kcal/día adicionales más allá de lo predicho por la pérdida de masa
3. **El principal causante del plateau (~6 meses)** es la falta intermitente de adherencia, no la adaptación metabólica
4. **La variabilidad aumenta con el tiempo** — las proyecciones a 90 días son mucho menos precisas que a 30 días
5. **El peso fluctúa ±1-2 kg diariamente** por retención de agua, glucógeno e ingesta de sodio — esto no es grasa

---

## 1. NUEVO MODELO DE PROYECCIÓN — Backend

Implementar en `worker/src/routes/progress.js` la función `calculateScientificProjection(data)`:

### Paso 1 — TDEE dinámico con Mifflin-St Jeor
```js
function calculateTDEE(weight, height, age, gender, activityLevel = 1.55) {
  // Mifflin-St Jeor (más preciso que Harris-Benedict)
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  // activity levels: 1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 active
  return bmr * activityLevel;
}
```

### Paso 2 — Déficit real con variabilidad calórica
No usar la media simple. Calcular:
```js
// Media ponderada — dar más peso a los últimos 14 días (más representativos)
const recentWeight = 0.7; // 70% últimos 14 días
const olderWeight = 0.3;  // 30% días anteriores

// Coeficiente de variación calórica (cuánto varían las calorías día a día)
const calorieStdDev = calcStdDev(dailyCalories);
const calorieVariability = calorieStdDev / calorieMean; // CV
```

### Paso 3 — Factor de adherencia real
Basado en los datos del usuario, no en un 100% teórico:
```js
// Días registrados / días totales del período
const registeredDays = daysWithData;
const totalDays = periodDays;
const adherenceRate = registeredDays / totalDays;

// Los días sin registrar no son necesariamente días perfectos
// Asumir que días sin registrar tienen calorías = TDEE (sin déficit)
// Esto es conservador pero científicamente más honesto
const effectiveDeficit = dailyDeficit * adherenceRate;
```

### Paso 4 — Adaptación metabólica progresiva
```js
// El metabolismo se adapta a la baja conforme se pierde peso
// Basado en Hall et al. 2011: el TDEE cae ~46 kcal/día adicionales 
// por cada 10% de peso corporal perdido
function metabolicAdaptation(currentWeight, startWeight) {
  const weightLossPct = (startWeight - currentWeight) / startWeight;
  const adaptationFactor = 1 - (weightLossPct * 0.15); // reducción ~15% del déficit
  return adaptationFactor;
}
```

### Paso 5 — Modelo dinámico de proyección por fases

**NO proyectar en línea recta.** La pérdida de peso sigue una curva que se aplana:

```js
function projectWeight(startWeight, dailyDeficit, adherenceRate, days) {
  let weight = startWeight;
  const projectedWeights = [];
  
  for (let day = 1; day <= days; day++) {
    // El déficit efectivo decrece con el tiempo por 3 factores:
    // 1. Adaptación metabólica (el cuerpo quema menos)
    // 2. El peso menor requiere menos calorías → el mismo déficit inicial se reduce
    // 3. Adherencia no perfecta
    
    const weightLost = startWeight - weight;
    const adaptationFactor = Math.max(0.75, 1 - (weightLost / startWeight) * 0.15);
    
    // TDEE se reduce proporcionalmente al peso perdido
    const tdeeReduction = weightLost * 22; // ~22 kcal/día menos por kg perdido
    const adjustedDeficit = (dailyDeficit - tdeeReduction) * adaptationFactor * adherenceRate;
    
    // Convertir déficit a pérdida de peso
    // NO usar 7700 estático — la composición del tejido perdido cambia
    // Al inicio se pierde más agua y glucógeno (menor densidad energética)
    // Con el tiempo se pierde más grasa pura (mayor densidad: ~9000 kcal/kg)
    const tissueEnergyDensity = day < 14 
      ? 5000  // primeras 2 semanas: mucha agua y glucógeno
      : 7200; // después: principalmente grasa (menos que 7700 por proteína perdida)
    
    const dailyWeightLoss = Math.max(0, adjustedDeficit) / tissueEnergyDensity;
    weight -= dailyWeightLoss;
    
    if (day === 30 || day === 60 || day === 90) {
      projectedWeights.push({ day, weight: Math.round(weight * 10) / 10 });
    }
  }
  
  return projectedWeights;
}
```

### Paso 6 — Bandas de incertidumbre (confidence intervals)

La proyección no es un número, es un rango que se ensancha con el tiempo:

```js
function calculateUncertaintyBands(projectedWeight, day, calorieVariability, adherenceRate) {
  // La incertidumbre crece con el tiempo y con la variabilidad del usuario
  const timeUncertainty = Math.sqrt(day) * 0.08; // ±0.08 kg por día^0.5
  const adherenceUncertainty = (1 - adherenceRate) * 2; // peor adherencia = más incertidumbre
  const calorieUncertainty = calorieVariability * 1.5;
  
  const totalUncertainty = timeUncertainty + adherenceUncertainty + calorieUncertainty;
  
  return {
    optimistic: projectedWeight - totalUncertainty * 0.5,  // escenario favorable
    realistic: projectedWeight,                             // escenario base
    conservative: projectedWeight + totalUncertainty,      // escenario más lento
  };
}
```

### Paso 7 — Detectar y comunicar el plateau

```js
// Basado en Thomas et al. 2014: plateaus ocurren por adherencia imperfecta
// Si la adherencia < 70%, predecir plateau antes de los 6 meses
function predictPlateau(adherenceRate, dailyDeficit, startWeight) {
  if (adherenceRate < 0.70) {
    const estimatedPlateauDays = Math.round(180 * adherenceRate); 
    return {
      willPlateau: true,
      estimatedDay: estimatedPlateauDays,
      reason: adherenceRate < 0.5 
        ? 'Tu adherencia actual sugiere un plateau pronto. Registrar más días mejorará la precisión.'
        : 'Con tu adherencia actual, es probable un plateau antes de los 6 meses.'
    };
  }
  return { willPlateau: false };
}
```

### Respuesta del endpoint `/api/progress/advanced`

Añadir al objeto de respuesta:
```json
{
  "projection": {
    "model": "dynamic-adaptive-v2",
    "daily_deficit_effective": 220,
    "daily_deficit_theoretical": 380,
    "adherence_rate": 0.64,
    "calorie_variability_cv": 0.18,
    "metabolic_adaptation_factor": 0.93,

    "scenarios": {
      "optimistic":   { "30d": 76.1, "60d": 75.0, "90d": 74.1 },
      "realistic":    { "30d": 76.6, "60d": 75.8, "90d": 75.2 },
      "conservative": { "30d": 77.1, "60d": 76.8, "90d": 76.5 }
    },

    "plateau_prediction": {
      "will_plateau": true,
      "estimated_day": 120,
      "reason": "Con 64% de adherencia, es probable un plateau antes de los 6 meses."
    },

    "weekly_rate_realistic": -0.18,
    "days_to_goal_realistic": 145,
    "confidence": "medium",
    "data_quality_score": 0.72
  }
}
```

---

## 2. REWORK DEL COMPONENTE — Frontend

### Cambios en `AdvancedAnalytics.jsx` — Sección de proyección

**Mostrar los 3 escenarios, no uno solo:**

```
┌────────────────────────────────────────────┐
│  PROYECCIÓN DE PESO                        │
│  Modelo dinámico con adaptación metabólica │
│                                            │
│  Peso actual    Tasa realista              │
│   77.1 kg       -0.18 kg/sem              │
│                                            │
│  [Gráfico con 3 líneas / área sombreada]  │
│   ── Optimista  -- Realista  ·· Conserv.  │
│                                            │
│  En 30 días      En 60 días    En 90 días │
│  Opt:  76.1      75.0          74.1       │
│  Real: 76.6      75.8          75.2  ←    │
│  Cons: 77.1      76.8          76.5       │
│                                            │
│  ⚠️ Plateau probable ~día 120             │
│  "Registrar más días mejorará precisión"  │
│                                            │
│  ℹ️ Basado en adherencia real (64%) y     │
│     adaptación metabólica progresiva      │
└────────────────────────────────────────────┘
```

**El gráfico (Recharts ComposedChart):**
- Línea sólida verde oscuro: peso histórico real
- Área sombreada entre escenario optimista y conservador (verde muy claro, opacidad 0.15)
- Línea punteada verde medio: escenario realista
- Línea punteada naranja vertical: día estimado del plateau (si aplica)
- Eje X: fechas reales
- Eje Y: kg con dominio dinámico

**Tarjetas de escenarios (3 columnas):**
- 🟢 Optimista — con pequeño texto "si mantienes adherencia perfecta"
- 🎯 Realista — destacada con borde verde — "basado en tus hábitos actuales"
- 🔵 Conservador — "si la adherencia baja un 20%"

**Explicación científica colapsable:**
Añadir un botón "¿Cómo se calcula?" que expande una sección con:
- *"Este modelo tiene en cuenta que el metabolismo se adapta a la baja (~15% de reducción del déficit por cada 10% de peso perdido)"*
- *"La proyección realista asume tu adherencia actual del X% — los días sin registrar se consideran días sin déficit"*
- *"La incertidumbre aumenta con el tiempo — las bandas se ensanchan porque pequeñas variaciones se acumulan"*

**Indicador de calidad de datos:**
```
Calidad del modelo: ████████░░ 72%
Mejora registrando peso y calorías más días
```

**Si hay plateau predicho:**
Mostrar un banner amarillo:
```
⚠️ Plateau probable hacia el día 120
La ciencia muestra que la falta de adherencia intermitente
(no el metabolismo) es la principal causa. Mantener el 
registro constante puede prevenir o retrasar el plateau.
```

---

## 3. NUEVA SECCIÓN — Análisis de variabilidad calórica

Añadir una sección nueva en el bottom sheet ANTES de la proyección:

**"Tu patrón calórico"**
- Coeficiente de variación (CV) de calorías: % de variabilidad día a día
  - CV < 15%: 🟢 "Muy consistente — facilitará la proyección"
  - CV 15-30%: 🟡 "Variabilidad normal"
  - CV > 30%: 🔴 "Alta variabilidad — dificulta proyectar"
- Mini histograma de distribución de calorías diarias (Recharts BarChart simple)
- Días por debajo del objetivo / en objetivo / por encima

---

## 4. TEXTOS Y DISCLAIMERS

En toda la sección de proyección, mostrar siempre al pie:

*"Las proyecciones son estimaciones orientativas basadas en tus datos actuales. El peso corporal fluctúa ±1-2 kg diariamente por agua y glucógeno — esto no refleja cambios reales en grasa. Consulta con un profesional de la salud para objetivos médicos."*

---

## 5. ORDEN DE IMPLEMENTACIÓN

1. Actualizar `calculateScientificProjection()` en el Worker con el nuevo modelo
2. Actualizar la respuesta de `/api/progress/advanced` con los nuevos campos
3. Desplegar Worker: `cd worker && npm run deploy`
4. Actualizar `AdvancedAnalytics.jsx`:
   - Nueva sección de variabilidad calórica
   - Gráfico con 3 escenarios y área de incertidumbre
   - Tarjetas de escenarios optimista/realista/conservador
   - Banner de plateau si aplica
   - Sección explicativa colapsable
   - Disclaimer científico al pie

---

## 6. AL FINALIZAR

- Verificar con datos reales: si déficit medio es 400 kcal/día y adherencia 64%, la proyección realista a 90 días debe ser significativamente menor que la que daría el modelo simple (que sería -4.7 kg vs el nuevo modelo que debería dar ~-2.5 a -3 kg por la adaptación y adherencia)
- `git add . && git commit -m "feat: modelo de proyección científico con variabilidad y adaptación metabólica" && git push`
- Marcar en ROADMAP.md como completado
