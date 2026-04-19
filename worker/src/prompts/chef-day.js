// ============================================================
//  chef-day.js — Prompt builder para Plan del día (Sonnet)
//
//  Construye el system prompt + user message con datos reales
//  del usuario. El resultado se pasa a Claude Sonnet que
//  devuelve JSON estructurado con 4 comidas (o las que falten).
// ============================================================

import { NUTRITION_RULES_BLOCK } from './nutritionRules.js';

const SYSTEM_PROMPT = `Eres el planificador de comidas de Caliro. Generas un plan de comidas para el RESTO del día del usuario, basándote en sus datos reales.

${NUTRITION_RULES_BLOCK}


FORMATO DE RESPUESTA:
- Responde SOLO con JSON válido. Sin texto antes ni después. Sin bloques de código. Sin markdown.
- Schema exacto:
{
  "meals": [
    {
      "type": "desayuno" | "comida" | "merienda" | "cena",
      "time": "HH:MM",
      "name": "nombre corto del plato en español",
      "kcal": número entero,
      "protein": número entero (gramos),
      "carbs": número entero (gramos),
      "fat": número entero (gramos),
      "portion_g": número entero (peso total del plato servido en gramos, ver regla 14),
      "ingredients": "ingrediente1 Xg · ingrediente2 Xg · ..."
    }
  ],
  "totals": { "kcal": número, "protein": número, "carbs": número, "fat": número }
}

REGLAS:
0. IDIOMA: todo el JSON (nombres de platos, ingredientes, tipos de comida) debe estar en ESPAÑOL. Nunca uses inglés ("Turkey", "Chicken", "Spinach Salad", "Quinoa Bowl"). Usa "pavo", "pollo", "ensalada de espinacas", "bowl de quinoa". Esto es una regla no negociable.
1. Solo genera comidas para los tipos que el usuario AÚN NO ha registrado hoy.
2. El total del plan debe acercarse al presupuesto RESTANTE (±10% de las kcal restantes).
3. PROTEÍNA — PISO NUTRICIONAL NO NEGOCIABLE: la suma de proteína del plan debe cubrir AL MENOS el 85% de la proteína pendiente indicada en PRESUPUESTO. La proteína es un piso (1.6–2.2 g/kg/día); no la sacrifiques por alcanzar kcal con carbos o grasa. Si hace falta, prioriza fuentes densas (pechuga, pescado blanco, claras, atún, legumbres con cereal, tofu, yogur griego, queso fresco batido).
4. DISTRIBUCIÓN POR COMIDA: en un plan completo (4 comidas), ninguna comida individual debe representar más del 45% ni menos del 10% de las kcal totales del plan. Reparte razonablemente: desayuno 20-30%, comida 30-40%, merienda 10-20%, cena 25-35% (orientativo). En planes parciales (2-3 comidas generadas) la regla se relaja pero EVITA extremos (una sola comida que absorba >60% del presupuesto).
5. BALANCE FRECUENTES vs NUEVOS: aproximadamente 60-70% del plan deben ser platos de la lista de COMIDAS FRECUENTES (el usuario ya los cocina y compra). El 30-40% restante deben ser platos NUEVOS — variaciones interesantes o platos típicos de la cocina mediterránea/española que el usuario no come habitualmente. Esto evita que el plan sea repetitivo. En un plan de 4 comidas, eso es 2-3 frecuentes + 1-2 nuevos.
6. Las PREFERENCIAS DIETÉTICAS son REGLAS DURAS que no puedes violar nunca. Si dice "vegetariano", cero carne/pescado. Si tiene alergia a "gluten", cero trigo/pasta/pan normal.
7. Porciones realistas en gramos. No inventes datos nutricionales — razona desde los frecuentes del usuario o desde cocina mediterránea/española estándar.
8. Nombres de plato cortos y naturales en español ("Pechuga con arroz", no "Filete de pechuga de pollo deshuesada al grill con guarnición de arroz basmati").
9. El campo "ingredients" lista los ingredientes principales con gramos o mililitros estimados, separados por " · " (ej: "150g pollo · 80g arroz · 30ml aceite · 1 diente ajo"). Usa g para sólidos y ml para líquidos.
10. El campo "time" es una hora sugerida razonable para ese tipo de comida.
11. Si el usuario da CONTEXTO, respétalo:
    - "solo cena" → genera SOLO 1 meal tipo cena
    - "tengo pollo" → prioriza platos con pollo
    - "algo rápido" → platos de preparación < 15 min
    - "estoy en restaurante" → sugiere opciones típicas de restaurante
    - Si el contexto contradice lo que normalmente generarías, el CONTEXTO gana.
12. Si al usuario le faltan POCAS kcal (< 200), genera solo un snack ligero, no una comida completa.
13. Los totals deben ser la SUMA real de los meals generados — no inventes un total diferente.
14. VARIEDAD: si se te da una lista de PLATOS RECIENTES (comidos o planificados en últimos días), NO los repitas hoy. Busca alternativas equivalentes en macros. Si no tienes alternativa en los frecuentes del usuario, usa conocimiento general de cocina mediterránea/española. La proteína principal de hoy debe variar respecto a lo comido o planificado ayer y antesdeayer (alterna entre pollo, pescado, legumbre, huevo, ternera, tofu, etc.).
15. PORTION_G OBLIGATORIO: cada meal debe incluir "portion_g" = peso total en gramos del plato SERVIDO (no ingredientes crudos sumados, sino lo que el usuario se come en el plato). Típicos: desayuno 300-450g, comida 400-600g, merienda 150-300g, cena 350-550g. Se usa para prefill automático de peso cuando el usuario registra. Si dudas, estima conservador pero NUNCA omitas el campo.
16. USUARIO YA EXCEDIDO: si el bloque PRESUPUESTO indica que el usuario YA SE HA PASADO del objetivo diario, y todavía le falta algún meal_type por registrar, genera UNA sola opción lo más ligera posible (≤200 kcal, snack tipo fruta o yogur natural). Si no falta ningún meal_type (ya tiene todas sus comidas), responde con "meals": [] y "totals": {"kcal":0,"protein":0,"carbs":0,"fat":0}. No inventes comidas extra — sería contraproducente.`;

/**
 * Construye el user message con datos reales del usuario.
 *
 * @param {object} params
 * @param {object} params.user       — row de users (target_calories, weight, etc.)
 * @param {Array}  params.todayMeals — entries de hoy [{meal_type, name, calories, protein, carbs, fat}]
 * @param {object} params.remaining  — {kcal, protein, carbs, fat} restantes (pueden ser negativos si el usuario se pasó)
 * @param {boolean} [params.isOverBudget] — true si remaining.kcal <= 0
 * @param {Array}  params.frequentMeals — top N frequent meals [{name, avg_kcal, times, avg_protein, avg_carbs, avg_fat}]
 * @param {object|null} params.preferences — {diet, allergies[], dislikes} o null
 * @param {string} params.context    — texto libre del usuario (puede estar vacío)
 * @param {string} params.dayOfWeek  — "lunes", "martes", etc.
 * @param {number} params.hourNow    — hora actual (0-23)
 * @param {Array}  params.mealTypesRegistered — tipos ya registrados hoy ["desayuno", "comida"]
 * @param {Array}  params.recentEntries — entries reales de los últimos N días [{date, meal_type, name, calories}]
 * @param {string[]} params.recentPlannedDishes — nombres de platos ya planificados en los N planes anteriores
 */
export function buildDayPlanMessage({
  user,
  todayMeals,
  remaining,
  isOverBudget = false,
  frequentMeals,
  preferences,
  context,
  dayOfWeek,
  hourNow,
  mealTypesRegistered,
  recentEntries = [],
  recentPlannedDishes = [],
}) {
  // Perfil
  const profileBlock = `=== PERFIL ===
Objetivo diario: ${user.target_calories || '?'} kcal | Prot: ${user.target_protein || '?'}g | Carbs: ${user.target_carbs || '?'}g | Grasa: ${user.target_fat || '?'}g
Peso: ${user.weight || '?'}kg | Meta peso: ${user.goal_weight || 'no definida'}kg`;

  // Hoy — qué ya ha comido
  const todayBlock = todayMeals.length > 0
    ? `=== YA COMIDO HOY (${dayOfWeek}, ${hourNow}:00h) ===\n` +
      todayMeals.map(e =>
        `  [${e.meal_type || 'otro'}] ${e.name || 'sin nombre'}: ${e.calories} kcal, ${e.protein || 0}g prot, ${e.carbs || 0}g carbs, ${e.fat || 0}g grasa`
      ).join('\n')
    : `=== HOY (${dayOfWeek}, ${hourNow}:00h) ===\n  Sin registros todavía`;

  // Presupuesto restante. Si el usuario se pasó (remaining.kcal <= 0) se lo
  // decimos explícitamente para que no invente comidas extra.
  const budgetBlock = isOverBudget
    ? `=== PRESUPUESTO — USUARIO YA EXCEDIDO ===
El usuario YA SE HA PASADO de su objetivo diario en ${Math.abs(Math.round(remaining.kcal))} kcal.
Aplica la regla 16: si falta algún meal_type por registrar, sugiere UNA sola opción ligera (≤200 kcal). Si ya tiene todas sus comidas registradas, responde con "meals": [].`
    : `=== PRESUPUESTO RESTANTE ===
Calorías libres: ${Math.round(remaining.kcal)} kcal
Proteína por cubrir: ${Math.round(Math.max(0, remaining.protein))}g (PISO — regla 3)
Carbos por cubrir: ${Math.round(Math.max(0, remaining.carbs))}g
Grasa por cubrir: ${Math.round(Math.max(0, remaining.fat))}g`;

  // Tipos de comida que ya tiene → el modelo solo genera los que faltan
  const registeredTypes = mealTypesRegistered.length > 0
    ? `=== COMIDAS YA REGISTRADAS (no generar estos tipos) ===\n  ${mealTypesRegistered.join(', ')}`
    : '=== Ninguna comida registrada todavía — generar plan completo ===';

  // Hora actual → sugiere qué comidas tienen sentido
  let timeHint = '';
  if (hourNow >= 16) {
    timeHint = 'Es tarde en el día — probablemente solo faltan merienda y/o cena.';
  } else if (hourNow >= 13) {
    timeHint = 'Es mediodía/tarde — probablemente faltan comida, merienda y cena.';
  } else if (hourNow >= 10) {
    timeHint = 'Es media mañana — probablemente faltan comida, merienda y cena.';
  }

  // Preferencias dietéticas
  let prefsBlock = '=== PREFERENCIAS DIETÉTICAS ===\n  Sin restricciones especiales';
  if (preferences) {
    const lines = [];
    const dietLabels = {
      omnivore: 'Omnívoro (sin restricciones)',
      vegetarian: 'Vegetariano (sin carne ni pescado; huevos y lácteos OK)',
      vegan: 'Vegano (sin productos animales)',
      pescatarian: 'Pescetariano (sin carne; pescado, huevos y lácteos OK)',
    };
    lines.push(`  Dieta: ${dietLabels[preferences.diet] || preferences.diet || 'omnívoro'}`);
    if (preferences.allergies?.length) {
      lines.push(`  ALERGIAS (NUNCA incluir): ${preferences.allergies.join(', ')}`);
    }
    if (preferences.dislikes?.trim()) {
      lines.push(`  Disgustos (evitar): ${preferences.dislikes}`);
    }
    prefsBlock = '=== PREFERENCIAS DIETÉTICAS (REGLAS DURAS) ===\n' + lines.join('\n');
  }

  // Comidas frecuentes
  let freqBlock = '=== COMIDAS FRECUENTES (priorizar estos platos) ===\n  Sin historial todavía';
  if (frequentMeals?.length > 0) {
    const lines = frequentMeals.slice(0, 15).map((m, i) =>
      `  ${i + 1}. ${m.name}: ${m.times || '?'}×, ~${Math.round(m.avg_kcal || 0)} kcal, ${Math.round(m.avg_protein || 0)}g prot, ${Math.round(m.avg_carbs || 0)}g carbs, ${Math.round(m.avg_fat || 0)}g grasa`
    );
    freqBlock = '=== COMIDAS FRECUENTES (priorizar estos platos — el usuario ya los cocina) ===\n' + lines.join('\n');
  }

  // Variedad — platos recientes (comidos + planificados)
  let varietyBlock = '';
  const recentEatenLines = [];
  if (recentEntries?.length > 0) {
    // Agrupar por fecha
    const byDate = {};
    for (const e of recentEntries) {
      const d = e.date || 'sin fecha';
      if (!byDate[d]) byDate[d] = [];
      if (e.name) byDate[d].push(e.name);
    }
    for (const [d, names] of Object.entries(byDate)) {
      if (names.length > 0) recentEatenLines.push(`  ${d}: ${names.join(', ')}`);
    }
  }
  const varietyParts = [];
  if (recentEatenLines.length > 0) {
    varietyParts.push('Platos reales comidos los últimos días:\n' + recentEatenLines.join('\n'));
  }
  if (recentPlannedDishes?.length > 0) {
    varietyParts.push('Platos ya sugeridos en planes recientes (NO repetir):\n  ' + recentPlannedDishes.join(', '));
  }
  if (varietyParts.length > 0) {
    varietyBlock = '=== VARIEDAD — EVITAR REPETICIÓN ===\n' + varietyParts.join('\n\n');
  }

  // Contexto libre del usuario
  const contextBlock = context?.trim()
    ? `=== CONTEXTO DEL USUARIO (respetar estrictamente) ===\n  "${context.trim()}"`
    : '';

  // Instrucción final
  const instruction = `Genera un plan de comidas para el RESTO del día de hoy. Solo los tipos que faltan. JSON puro, sin texto adicional.`;

  // Ensamblar
  const parts = [
    profileBlock,
    todayBlock,
    budgetBlock,
    registeredTypes,
    timeHint ? `Nota: ${timeHint}` : '',
    prefsBlock,
    freqBlock,
    varietyBlock,
    contextBlock,
    instruction,
  ].filter(Boolean);

  return parts.join('\n\n');
}

/**
 * Parsea la respuesta de Claude, con cleanup de markdown wrapping.
 * @param {string} raw — texto crudo del response de Claude
 * @returns {object} — { meals, totals } parseado
 * @throws si el JSON es inválido o el schema no matchea
 */
export function parseDayPlanResponse(raw) {
  let text = raw.trim();

  // Strip markdown code blocks si los hay
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const data = JSON.parse(text);

  // Validar schema mínimo
  if (!data.meals || !Array.isArray(data.meals) || data.meals.length === 0) {
    throw new Error('Plan vacío — no se generaron comidas');
  }

  for (const meal of data.meals) {
    if (!meal.name || typeof meal.kcal !== 'number') {
      throw new Error('Comida con datos incompletos');
    }
    // Defaults para campos opcionales
    meal.type = meal.type || 'otro';
    meal.time = meal.time || '';
    meal.protein = meal.protein || 0;
    meal.carbs = meal.carbs || 0;
    meal.fat = meal.fat || 0;
    meal.ingredients = meal.ingredients || '';
    // portion_g: si Sonnet lo omite lo dejamos en 0 (schema estable).
    // Antes estimábamos `kcal * 1.5` pero un croissant 400kcal ≠ 600g y
    // una ensalada 400kcal ≠ 600g — el guess engañaba al prefill de
    // Calculator. Mejor campo vacío que peso plausiblemente incorrecto.
    if (typeof meal.portion_g !== 'number' || meal.portion_g <= 0) {
      meal.portion_g = 0;
    }
  }

  // Recalcular totals por seguridad (no confiar en el total del modelo)
  data.totals = {
    kcal: data.meals.reduce((s, m) => s + (m.kcal || 0), 0),
    protein: data.meals.reduce((s, m) => s + (m.protein || 0), 0),
    carbs: data.meals.reduce((s, m) => s + (m.carbs || 0), 0),
    fat: data.meals.reduce((s, m) => s + (m.fat || 0), 0),
  };

  return data;
}

export { SYSTEM_PROMPT };
