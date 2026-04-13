// ============================================================
//  chef-day.js — Prompt builder para Plan del día (Sonnet)
//
//  Construye el system prompt + user message con datos reales
//  del usuario. El resultado se pasa a Claude Sonnet que
//  devuelve JSON estructurado con 4 comidas (o las que falten).
// ============================================================

const SYSTEM_PROMPT = `Eres el planificador de comidas de Caliro. Generas un plan de comidas para el RESTO del día del usuario, basándote en sus datos reales.

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
      "ingredients": "ingrediente1 Xg · ingrediente2 Xg · ..."
    }
  ],
  "totals": { "kcal": número, "protein": número, "carbs": número, "fat": número }
}

REGLAS:
1. Solo genera comidas para los tipos que el usuario AÚN NO ha registrado hoy.
2. El total del plan debe acercarse al presupuesto RESTANTE (±10% de las kcal restantes).
3. Distribuye proteínas de forma equilibrada entre las comidas generadas.
4. PRIORIZA platos de la lista de COMIDAS FRECUENTES — son platos que el usuario ya cocina y compra. Usa variaciones si aplica (mismo plato con diferente acompañamiento).
5. Las PREFERENCIAS DIETÉTICAS son REGLAS DURAS que no puedes violar nunca. Si dice "vegetariano", cero carne/pescado. Si tiene alergia a "gluten", cero trigo/pasta/pan normal.
6. Porciones realistas en gramos. No inventes datos nutricionales — razona desde los frecuentes del usuario o desde cocina mediterránea/española estándar.
7. Nombres de plato cortos y naturales en español ("Pechuga con arroz", no "Filete de pechuga de pollo deshuesada al grill con guarnición de arroz basmati").
8. El campo "ingredients" lista los ingredientes principales con gramos estimados, separados por " · ".
9. El campo "time" es una hora sugerida razonable para ese tipo de comida.
10. Si el usuario da CONTEXTO, respétalo:
    - "solo cena" → genera SOLO 1 meal tipo cena
    - "tengo pollo" → prioriza platos con pollo
    - "algo rápido" → platos de preparación < 15 min
    - "estoy en restaurante" → sugiere opciones típicas de restaurante
    - Si el contexto contradice lo que normalmente generarías, el CONTEXTO gana.
11. Si al usuario le faltan POCAS kcal (< 200), genera solo un snack ligero, no una comida completa.
12. Los totals deben ser la SUMA real de los meals generados — no inventes un total diferente.`;

/**
 * Construye el user message con datos reales del usuario.
 *
 * @param {object} params
 * @param {object} params.user       — row de users (target_calories, weight, etc.)
 * @param {Array}  params.todayMeals — entries de hoy [{meal_type, name, calories, protein, carbs, fat}]
 * @param {object} params.remaining  — {kcal, protein, carbs, fat} restantes
 * @param {Array}  params.frequentMeals — top N frequent meals [{name, avg_kcal, times, avg_protein, avg_carbs, avg_fat}]
 * @param {object|null} params.preferences — {diet, allergies[], dislikes} o null
 * @param {string} params.context    — texto libre del usuario (puede estar vacío)
 * @param {string} params.dayOfWeek  — "lunes", "martes", etc.
 * @param {number} params.hourNow    — hora actual (0-23)
 * @param {Array}  params.mealTypesRegistered — tipos ya registrados hoy ["desayuno", "comida"]
 */
export function buildDayPlanMessage({
  user,
  todayMeals,
  remaining,
  frequentMeals,
  preferences,
  context,
  dayOfWeek,
  hourNow,
  mealTypesRegistered,
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

  // Presupuesto restante
  const budgetBlock = `=== PRESUPUESTO RESTANTE ===
Calorías libres: ${Math.round(remaining.kcal)} kcal
Proteína por cubrir: ${Math.round(remaining.protein)}g
Carbos por cubrir: ${Math.round(remaining.carbs)}g
Grasa por cubrir: ${Math.round(remaining.fat)}g`;

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
