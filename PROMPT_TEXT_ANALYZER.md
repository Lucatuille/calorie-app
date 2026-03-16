# ✏️ Descripción por texto libre con IA — Tercer método de registro

## Contexto
Añadir un tercer método de registro de comidas en `Calculator.jsx`, junto a "📸 Foto" y "▦ Escanear". El usuario describe en lenguaje natural lo que ha comido y la IA estima calorías y macros. Integrado completamente con el sistema de auto-calibración personal ya implementado. Es el método más barato de los tres ($0.0008 por consulta vs $0.005 de foto).

---

## 1. UI — Nuevo botón en Calculator.jsx

### Layout actualizado de los tres botones:
```
Añadir comida

[📸 Foto con IA]  [▦ Escanear]  [✏️ Describir]

[Desayuno] [Comida] [Cena] [Snack] [Otro]
```

En móvil los tres botones en grid de 3 columnas iguales:
```css
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 8px;
```

Cada botón igual de ancho, mismo estilo que los existentes. Texto corto:
- "📸 Foto"
- "▦ Escanear"  
- "✏️ Describir"

---

## 2. EL FLUJO COMPLETO

### Al pulsar "Describir":
Abre un bottom sheet (mismo patrón que escáner y suplementos).

### El bottom sheet de descripción:

```
─────── (handle bar) ───────

  Describir comida               [✕]

  ┌─────────────────────────────────────┐
  │                                     │
  │  ¿Qué has comido?                  │
  │                                     │
  │  [textarea grande, 4 líneas]        │
  │  placeholder: "Ej: 150g de pechuga  │
  │  a la plancha con ensalada, un      │
  │  yogur griego y una pieza de fruta" │
  │                                     │
  └─────────────────────────────────────┘

  💡 Consejos para mejor precisión:
  · Indica la cantidad si la sabes (150g, 1 taza...)
  · Menciona el método de cocción (plancha, frito, hervido)
  · Especifica si es casero o de restaurante

  [ ✨ Analizar con IA ]   ← botón verde prominente

  ── O prueba estos ejemplos ──
  ["🍳 Huevos revueltos"] ["🍝 Pasta"] ["🥗 Ensalada"] ["🍗 Pollo"]
```

### Los chips de ejemplos:
Al pulsar un chip, pre-rellena el textarea con un ejemplo completo:
- "🍳 Huevos revueltos" → "2 huevos revueltos con un poco de mantequilla"
- "🍝 Pasta" → "Un plato de pasta con tomate, unos 200g"
- "🥗 Ensalada" → "Ensalada mixta con lechuga, tomate, atún y aceite de oliva"
- "🍗 Pollo" → "Pechuga de pollo a la plancha, unos 150g"

Esto reduce la fricción para usuarios nuevos que no saben cómo describir.

---

## 3. WORKER — Nuevo endpoint

### POST /api/entries/analyze-text

```js
export async function analyzeText(request, env) {
  const { text, meal_type, date } = await request.json();
  const userId = request.userId;

  if (!text?.trim()) {
    return new Response(JSON.stringify({ error: 'Texto vacío' }), { status: 400 });
  }

  if (text.length > 500) {
    return new Response(JSON.stringify({ error: 'Texto demasiado largo' }), { status: 400 });
  }

  // Cargar perfil de calibración del usuario (mismo sistema que las fotos)
  const calibrationRow = await env.DB.prepare(
    'SELECT * FROM user_calibration WHERE user_id = ?'
  ).bind(userId).first();

  const calibrationProfile = calibrationRow ? {
    global_bias: calibrationRow.global_bias,
    confidence: calibrationRow.confidence,
    data_points: calibrationRow.data_points,
    meal_factors: JSON.parse(calibrationRow.meal_factors || '{}'),
    food_factors: JSON.parse(calibrationRow.food_factors || '{}'),
    frequent_meals: JSON.parse(calibrationRow.frequent_meals || '[]'),
  } : null;

  // Buscar comidas similares en historial (mismo sistema que fotos)
  const frequentMeals = calibrationProfile?.frequent_meals || [];
  const similarMeal = findSimilarMealFromText(text, frequentMeals);

  // Construir prompt con contexto de calibración
  const calibrationContext = calibrationProfile?.confidence > 0.2
    ? `\n\nIMPORTANTE - Contexto de calibración del usuario:
       Este usuario tiende a comer un ${Math.round(Math.abs(calibrationProfile.global_bias) * 100)}% 
       ${calibrationProfile.global_bias > 0 ? 'más' : 'menos'} de lo que estiman los modelos genéricos.
       Ten esto en cuenta y ajusta tus estimaciones en consecuencia.`
    : '';

  const prompt = `Eres un nutricionista experto. El usuario describe lo que ha comido en lenguaje natural.
Analiza la descripción y estima los valores nutricionales con precisión.

Descripción del usuario: "${text}"
${calibrationContext}

Reglas de estimación:
- Si se indica cantidad específica (gramos, unidades), úsala exactamente
- Si no hay cantidad, asume una ración normal española (no americana)
- Para "casero": estimar con moderación en aceites y grasas
- Para "restaurante": añadir 25-35% extra por aceites y porciones generosas
- Para "ración pequeña/grande": ajustar ±20-30%
- Si hay múltiples alimentos, analiza cada uno por separado y suma
- NO seas conservador — los estudios muestran que las personas subestiman consistentemente

Si la descripción es ambigua, elige la interpretación más razonable y menciona el supuesto en "notes".

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown:
{
  "name": "nombre descriptivo del conjunto de alimentos",
  "items": [
    {
      "name": "nombre del alimento",
      "quantity": "cantidad estimada",
      "calories": número entero,
      "protein": decimal,
      "carbs": decimal,
      "fat": decimal
    }
  ],
  "total": {
    "calories": número entero,
    "protein": decimal,
    "carbs": decimal,
    "fat": decimal
  },
  "categories": ["categoria1", "categoria2"],
  "confidence": "high|medium|low",
  "notes": "observaciones breves si las hay"
}`;

  // Llamada a Claude (mismo modelo que fotos — Haiku, barato)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'Error de IA' }), { status: 500 });
  }

  const aiData = await response.json();
  const rawText = aiData.content[0]?.text || '';

  let result;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    result = JSON.parse(clean);
  } catch {
    return new Response(JSON.stringify({ error: 'Error procesando respuesta' }), { status: 500 });
  }

  // Aplicar calibración personal al total
  const isWeekend = [0, 6].includes(new Date().getDay());
  const calibratedCalories = applyCalibration(
    result.total.calories,
    calibrationProfile,
    {
      meal_type,
      food_categories: result.categories || [],
      is_weekend: isWeekend
    }
  );

  // Aplicar el mismo ratio de calibración a los macros
  const calibrationRatio = calibratedCalories / result.total.calories;

  return new Response(JSON.stringify({
    ...result,
    total: {
      calories: calibratedCalories,
      protein:  Math.round(result.total.protein  * calibrationRatio * 10) / 10,
      carbs:    Math.round(result.total.carbs    * calibrationRatio * 10) / 10,
      fat:      Math.round(result.total.fat      * calibrationRatio * 10) / 10,
    },
    ai_raw_calories: result.total.calories,
    calibration_applied: calibrationProfile?.confidence > 0.2,
    calibration_confidence: calibrationProfile?.confidence || 0,
    similar_meal: similarMeal,
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Buscar similitud en historial desde texto (más flexible que con nombre de foto)
function findSimilarMealFromText(text, frequentMeals) {
  if (!frequentMeals.length) return null;
  const textLower = text.toLowerCase();
  
  for (const meal of frequentMeals) {
    const mealWords = meal.name.toLowerCase().split(' ').filter(w => w.length > 3);
    const matches = mealWords.filter(w => textLower.includes(w));
    if (matches.length >= 2) return meal;
  }
  return null;
}
```

Importar `applyCalibration` desde `worker/src/utils/calibration.js` (ya existe).
Registrar ruta en `worker/src/index.js`:
```js
router.post('/api/entries/analyze-text', requireAuth, analyzeText)
```

---

## 4. FRONTEND — Componente TextAnalyzer

Crear `client/src/components/TextAnalyzer.jsx`:

### Estados:
```jsx
const [text, setText] = useState('');
const [status, setStatus] = useState('idle'); // idle | loading | result | error
const [result, setResult] = useState(null);
const [charCount, setCharCount] = useState(0);
```

### La pantalla de resultado:

```
✨ Análisis completado

Pollo a la plancha + ensalada + yogur

Desglose:
────────────────────────────────────────
Pechuga de pollo (150g)      165 kcal
Ensalada mixta con aceite     85 kcal
Yogur griego (125g)          134 kcal
────────────────────────────────────────
Total                        384 kcal   ✏️

Proteína  42g
Carbos    18g
Grasa     12g

[Si calibración activa]:
🎯 Ajustado a tus hábitos · 8 correcciones

[Si hay comida similar]:
💡 Similar a "pollo con ensalada"
   que registraste (380 kcal confirmadas)
   [ Usar ese valor ]

Confianza: ● Media
"Asumí ración normal de ensalada sin cantidad especificada"

─────────────────────────────────────
[ ✓ Guardar ]     [ ✏️ Ajustar ]
```

### El botón "Ajustar":
Abre un mini form inline (no cierra el resultado) con:
- Input de calorías editable
- Los macros se recalculan proporcionalmente

### Al guardar:
Igual que con las fotos — guardar la corrección silenciosamente para la calibración:

```js
const handleSave = async () => {
  // 1. Guardar la entrada
  const entry = await api.saveEntry({
    name: result.name,
    calories: finalCalories,
    protein: finalProtein,
    carbs: finalCarbs,
    fat: finalFat,
    meal_type: selectedMealType,
    date: new Date().toLocaleDateString('en-CA')
  }, token);

  // 2. Guardar corrección para calibración (fire and forget)
  if (result.ai_raw_calories) {
    api.saveAiCorrection({
      entry_id: entry.id,
      ai_raw: result.ai_raw_calories,
      ai_calibrated: result.total.calories,
      user_final: finalCalories,
      food_categories: result.categories || [],
      meal_type: selectedMealType,
      has_context: true, // el texto siempre es contexto
      accepted_without_change: finalCalories === result.total.calories,
      source: 'text' // nuevo campo para distinguir de foto
    }, token).catch(() => {});
  }

  // 3. Pre-rellenar formulario y cerrar
  onResult({
    name: result.name,
    calories: finalCalories,
    protein: finalProtein,
    carbs: finalCarbs,
    fat: finalFat,
  });
  onClose();
};
```

---

## 5. SISTEMA DE LÍMITES — Integrar con access_level

El texto libre cuenta dentro del mismo límite diario de IA que las fotos:

```js
// En el Worker, antes de procesar analyze-text:
// Verificar límite diario combinado (foto + texto)

const todayUsage = await env.DB.prepare(`
  SELECT COALESCE(SUM(count), 0) as total
  FROM ai_usage_log
  WHERE user_id = ? AND date = ?
`).bind(userId, today).first();

const limits = { 0: 0, 1: 999, 2: 3, 3: 999 }; // por access_level
const userLimit = limits[user.access_level] ?? 3;

if (todayUsage.total >= userLimit) {
  return new Response(JSON.stringify({
    error: 'limit_reached',
    message: 'Has alcanzado tu límite diario de análisis con IA',
    reset_at: 'mañana a las 00:00'
  }), { status: 429 });
}

// Incrementar contador (foto y texto usan el mismo)
await env.DB.prepare(`
  INSERT INTO ai_usage_log (user_id, date, count)
  VALUES (?, ?, 1)
  ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
`).bind(userId, today).run();
```

En el frontend, el mismo mensaje de "límite alcanzado" que para las fotos.

---

## 6. AÑADIR 'source' A ai_corrections

Actualizar la tabla `ai_corrections` para distinguir entre foto y texto:

```sql
-- Ejecutar en D1 Console:
ALTER TABLE ai_corrections ADD COLUMN source TEXT DEFAULT 'photo';
-- Valores: 'photo', 'text', 'barcode'
```

Esto permite en el futuro analizar si el usuario corrige más en fotos o en texto — útil para mejorar el sistema de calibración.

---

## 7. API.JS — Nuevo método

```js
analyzeText: (body, token) =>
  request('POST', '/api/entries/analyze-text', body, token),
```

---

## 8. DETALLES DE DISEÑO

- El textarea: border-radius igual que los inputs del formulario, resize vertical only, font DM Sans
- Contador de caracteres: `${charCount}/500` alineado a la derecha, en color secundario, se pone naranja al llegar a 400
- El botón "Analizar" deshabilitado si el textarea está vacío o tiene menos de 3 caracteres
- Loading state: spinner verde + texto "Analizando..." (no skeleton — es rápido ~1-2s)
- Los chips de ejemplos: mismo estilo que los meal type buttons pero más pequeños
- El desglose de items: tabla limpia con línea separadora, nombre a la izquierda, kcal a la derecha
- En modo oscuro: todas las variables CSS, nada hardcoded
- El indicador de confianza: punto de color (verde=high, amarillo=medium, gris=low) + texto

---

## 9. ORDEN DE IMPLEMENTACIÓN

1. SQL en D1 — `ALTER TABLE ai_corrections ADD COLUMN source TEXT DEFAULT 'photo'`
2. Crear endpoint `POST /api/entries/analyze-text` en Worker
3. Registrar ruta en `worker/src/index.js`
4. Desplegar Worker: `cd worker && npm run deploy`
5. Crear `client/src/components/TextAnalyzer.jsx`
6. Actualizar `Calculator.jsx` — añadir botón "Describir" + integrar TextAnalyzer
7. Actualizar `api.js` con `analyzeText`
8. Verificar que el límite diario de IA cuenta foto + texto conjuntamente

---

## 10. AL FINALIZAR

Verificar estos casos específicos:
- "150g de pechuga a la plancha" → debe dar ~165 kcal (preciso)
- "un plato de pasta carbonara" → debe dar ~700-800 kcal (no 400)
- "menú del día completo de restaurante" → debe dar ~900-1100 kcal
- "2 huevos revueltos" → debe dar ~180-220 kcal
- Si el usuario tiene calibración activa → los números deben diferir de los raw
- El límite de 3/día debe contar foto + texto + barcode combinados

`git add . && git commit -m "feat: descripción por texto libre con IA y calibración" && git push`
Marcar en ROADMAP.md como completado.
