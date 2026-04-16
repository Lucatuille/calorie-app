// ============================================================
//  chef-week.js — Prompt builder para Plan semanal (Sonnet)
//
//  Genera un plan para los días que FALTAN hasta el domingo de
//  la semana en curso. Si hoy es miércoles → hoy (parcial) + jue,
//  vie, sáb, dom. Si es lunes → los 7 días.
//
//  Hoy respeta entries ya registradas (solo genera meals faltantes).
//  Días futuros: 4 comidas completas cada uno.
//
//  Variedad: ningún plato se repite >2 veces en la semana, proteína
//  principal varía entre días consecutivos. Se inyecta también lista
//  de platos recientes (entries + planes previos) a evitar.
// ============================================================

const SYSTEM_PROMPT_WEEK = `Eres el planificador semanal de Caliro. Generas un plan de comidas para los DÍAS QUE FALTAN hasta el final de la semana en curso (domingo incluido), basándote en los datos reales del usuario.

FORMATO DE RESPUESTA:
- Responde SOLO con JSON válido. Sin texto antes ni después. Sin bloques de código. Sin markdown.
- Schema exacto:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "day_name": "lunes" | "martes" | "miércoles" | "jueves" | "viernes" | "sábado" | "domingo",
      "meals": [
        {
          "type": "desayuno" | "comida" | "merienda" | "cena",
          "time": "HH:MM",
          "name": "nombre corto del plato en español",
          "kcal": número entero,
          "protein": número entero (gramos),
          "carbs": número entero (gramos),
          "fat": número entero (gramos),
          "portion_g": número entero (peso total del plato servido en gramos, ver regla 15),
          "ingredients": "ingrediente1 Xg · ingrediente2 Xg · ..."
        }
      ]
    }
  ]
}

REGLAS:
0. IDIOMA: todo el JSON (nombres de platos, ingredientes, day_name, type) debe estar en ESPAÑOL. Nunca uses inglés ("Turkey and Spinach Salad", "Chicken Bowl", "Pasta Primavera"). Usa "Ensalada de pavo y espinacas", "Bowl de pollo", "Pasta con verduras". Esto es una regla no negociable y aplica a TODAS las comidas de TODOS los días.
1. SOLO genera entradas en "days" para las fechas indicadas en "=== DÍAS A PLANIFICAR ===". Respeta el orden y las fechas exactas.
2. Para el día parcial (si existe — normalmente HOY), solo genera los tipos de comida que FALTAN por registrar, NO los ya registrados.
3. Para los días completos (días futuros), genera siempre las 4 comidas: desayuno, comida, merienda, cena.
4. El total calórico de CADA día completo debe acercarse al objetivo diario del usuario (±10%). Distribuye macros equilibradamente.
5. BALANCE FRECUENTES vs NUEVOS: aproximadamente 60-70% del plan semanal deben ser platos de COMIDAS FRECUENTES (los que ya cocina y compra). El 30-40% restante deben ser platos NUEVOS — variaciones interesantes o platos típicos de la cocina mediterránea/española que ampliarían su repertorio. En una semana completa de 28 comidas eso son ~17-20 frecuentes + ~8-11 nuevos. Esto evita la sensación de "todo es lo de siempre".
6. Las PREFERENCIAS DIETÉTICAS son REGLAS DURAS — cero violaciones. Si dice "vegetariano", nada de carne ni pescado. Si tiene alergia a "gluten", nada de trigo/pasta/pan normal.
7. VARIEDAD (crítico): ningún plato debe aparecer más de 2 veces en toda la semana planificada. La proteína principal debe ROTAR entre días consecutivos (alterna entre pollo, pescado, legumbre, huevo, ternera, cerdo, tofu...). Si se te da una lista de PLATOS RECIENTES (ya comidos o planificados días atrás), NO los uses en esta semana.
8. Los fines de semana (sábado y domingo) pueden ser algo más flexibles calóricamente (±15% del objetivo) y con platos ligeramente más elaborados. Entre semana (lunes a viernes): practicidad y repeticiones razonables de frecuentes.
9. Porciones realistas en gramos. No inventes datos nutricionales — razona desde los frecuentes del usuario o desde cocina mediterránea/española estándar.
10. Nombres de plato cortos y naturales en español. NO descripciones largas tipo "Filete de pechuga de pollo deshuesada al grill con...". Dí "Pechuga con arroz".
11. Si el usuario da CONTEXTO, respétalo ("semana ligera", "tengo batch-cooking del domingo", "viajo jueves y viernes"). El CONTEXTO gana sobre las reglas por defecto.
12. Los campos "ingredients" listan ingredientes principales con gramos estimados separados por " · ".
13. Cada "time" es una hora sugerida razonable para ese tipo de comida.
14. NUNCA añadas campos extra al JSON. NO incluyas "totals" — los calcula el servidor.
15. PORTION_G OBLIGATORIO: cada meal debe incluir "portion_g" = peso total en gramos del plato SERVIDO (no ingredientes crudos sumados, sino lo que el usuario se come). Típicos: desayuno 300-450g, comida 400-600g, merienda 150-300g, cena 350-550g. Se usa para prefill automático al registrar. Si dudas, estima conservador pero NUNCA omitas el campo.`;

/**
 * Construye el user message con datos reales para el plan semanal.
 *
 * @param {object} params
 * @param {object} params.user                 — row de users
 * @param {Array}  params.daysToPlan           — [{date, day_name, isPartial, skipMealTypes[]}]
 * @param {Array}  params.todayMeals           — meals ya registrados hoy (para el parcial)
 * @param {Array}  params.frequentMeals        — top 20 frequent_meals
 * @param {object|null} params.preferences     — dietary_preferences
 * @param {string} params.context              — texto libre del usuario
 * @param {Array}  params.recentEntries        — entries reales últimos 14 días [{date, name, calories}]
 * @param {string[]} params.recentPlannedDishes — nombres de platos de planes recientes
 */
export function buildWeekPlanMessage({
  user,
  daysToPlan,
  todayMeals,
  frequentMeals,
  preferences,
  context,
  recentEntries,
  recentPlannedDishes,
}) {
  // Perfil
  const profileBlock = `=== PERFIL ===
Objetivo diario: ${user.target_calories || '?'} kcal | Prot: ${user.target_protein || '?'}g | Carbs: ${user.target_carbs || '?'}g | Grasa: ${user.target_fat || '?'}g
Peso: ${user.weight || '?'}kg | Meta peso: ${user.goal_weight || 'no definida'}kg`;

  // Días a planificar
  const daysLines = daysToPlan.map(d => {
    if (d.isPartial) {
      const skip = d.skipMealTypes?.length > 0
        ? ` — YA registrado: ${d.skipMealTypes.join(', ')}. Generar SOLO los que faltan.`
        : ' — completo (nada registrado todavía).';
      return `  ${d.date} (${d.day_name}) — PARCIAL${skip}`;
    }
    return `  ${d.date} (${d.day_name}) — COMPLETO (4 comidas)`;
  }).join('\n');

  const daysBlock = `=== DÍAS A PLANIFICAR (en este orden exacto) ===
${daysLines}`;

  // Ya comido hoy (para el parcial)
  let todayBlock = '';
  if (todayMeals?.length > 0) {
    const lines = todayMeals.map(e =>
      `  [${e.meal_type || 'otro'}] ${e.name || 'sin nombre'}: ${e.calories} kcal`
    );
    todayBlock = `=== YA COMIDO HOY (no repetir estos meal_types en el día parcial) ===\n${lines.join('\n')}`;
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

  // Comidas frecuentes top 20
  let freqBlock = '=== COMIDAS FRECUENTES (priorizar estos platos) ===\n  Sin historial todavía';
  if (frequentMeals?.length > 0) {
    const lines = frequentMeals.slice(0, 20).map((m, i) =>
      `  ${i + 1}. ${m.name}: ${m.times || '?'}×, ~${Math.round(m.avg_kcal || 0)} kcal, ${Math.round(m.avg_protein || 0)}g prot, ${Math.round(m.avg_carbs || 0)}g carbs, ${Math.round(m.avg_fat || 0)}g grasa`
    );
    freqBlock = '=== COMIDAS FRECUENTES (priorizar — el usuario ya los cocina) ===\n' + lines.join('\n');
  }

  // Variedad — platos recientes a evitar
  let varietyBlock = '';
  const varietyParts = [];

  if (recentEntries?.length > 0) {
    const byDate = {};
    for (const e of recentEntries) {
      const d = e.date || 'sin fecha';
      if (!byDate[d]) byDate[d] = [];
      if (e.name) byDate[d].push(e.name);
    }
    const lines = Object.entries(byDate)
      .slice(0, 14)
      .map(([d, names]) => `  ${d}: ${names.slice(0, 5).join(', ')}`);
    if (lines.length > 0) {
      varietyParts.push('Comió recientemente (no repetir en exceso):\n' + lines.join('\n'));
    }
  }
  if (recentPlannedDishes?.length > 0) {
    varietyParts.push('Platos ya sugeridos en planes recientes (NO repetir):\n  ' + recentPlannedDishes.join(', '));
  }
  if (varietyParts.length > 0) {
    varietyBlock = '=== VARIEDAD — EVITAR REPETICIÓN ===\n' + varietyParts.join('\n\n');
  }

  // Contexto libre
  const contextBlock = context?.trim()
    ? `=== CONTEXTO DEL USUARIO (respetar estrictamente) ===\n  "${context.trim()}"`
    : '';

  const instruction = `Genera el plan semanal en JSON puro. Solo los días listados arriba, en el orden exacto. Para el día parcial, solo meal_types faltantes. Para días completos, 4 comidas.`;

  const parts = [
    profileBlock,
    daysBlock,
    todayBlock,
    prefsBlock,
    freqBlock,
    varietyBlock,
    contextBlock,
    instruction,
  ].filter(Boolean);

  return parts.join('\n\n');
}

/**
 * Parsea la respuesta de Claude, valida schema y recalcula totals por día.
 *
 * @param {string} raw
 * @returns {object} — { days: [{date, day_name, meals, totals}] }
 * @throws si JSON inválido o schema incorrecto
 */
export function parseWeekPlanResponse(raw) {
  let text = raw.trim();

  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const data = JSON.parse(text);

  if (!data.days || !Array.isArray(data.days) || data.days.length === 0) {
    throw new Error('Plan semanal vacío — no se generaron días');
  }

  // Validar y normalizar cada día
  for (const day of data.days) {
    if (!day.date || !day.day_name) {
      throw new Error('Día con datos incompletos (falta date o day_name)');
    }
    if (!Array.isArray(day.meals)) {
      throw new Error(`Día ${day.date}: meals no es array`);
    }

    for (const meal of day.meals) {
      if (!meal.name || typeof meal.kcal !== 'number') {
        throw new Error(`Día ${day.date}: comida con datos incompletos`);
      }
      meal.type = meal.type || 'otro';
      meal.time = meal.time || '';
      meal.protein = meal.protein || 0;
      meal.carbs = meal.carbs || 0;
      meal.fat = meal.fat || 0;
      meal.ingredients = meal.ingredients || '';
      // portion_g es obligatorio (regla 15). Estimación conservadora si falta.
      if (typeof meal.portion_g !== 'number' || meal.portion_g <= 0) {
        meal.portion_g = Math.round((meal.kcal || 0) * 1.5);
      }
    }

    // Recalcular totals por día (no confiar en el modelo)
    day.totals = {
      kcal: day.meals.reduce((s, m) => s + (m.kcal || 0), 0),
      protein: day.meals.reduce((s, m) => s + (m.protein || 0), 0),
      carbs: day.meals.reduce((s, m) => s + (m.carbs || 0), 0),
      fat: day.meals.reduce((s, m) => s + (m.fat || 0), 0),
    };
  }

  // Total semana
  data.week_totals = {
    kcal: data.days.reduce((s, d) => s + (d.totals?.kcal || 0), 0),
    protein: data.days.reduce((s, d) => s + (d.totals?.protein || 0), 0),
    carbs: data.days.reduce((s, d) => s + (d.totals?.carbs || 0), 0),
    fat: data.days.reduce((s, d) => s + (d.totals?.fat || 0), 0),
  };

  return data;
}

/**
 * Calcula los días pendientes de la semana en curso (lunes a domingo).
 * Si hoy es miércoles, devuelve [miércoles (parcial), jueves, viernes, sábado, domingo].
 * Si hoy es domingo, devuelve [domingo (parcial)].
 *
 * @param {Date} today
 * @param {string[]} mealTypesRegisteredToday — ["desayuno", "comida", ...]
 * @returns {Array<{date, day_name, isPartial, skipMealTypes}>}
 */
export function computeDaysToPlan(today, mealTypesRegisteredToday = []) {
  const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const todayDow = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Calcular cuántos días faltan hasta domingo (incluido).
  // domingo=0 → 1 día (solo hoy), lunes=1 → 7 días, sábado=6 → 2 días.
  const daysLeft = todayDow === 0 ? 1 : (7 - todayDow + 1);

  const result = [];
  for (let i = 0; i < daysLeft; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = d.toLocaleDateString('en-CA');
    const dayName = DAY_NAMES_ES[d.getDay()];
    const isFirst = i === 0;
    result.push({
      date: iso,
      day_name: dayName,
      isPartial: isFirst && mealTypesRegisteredToday.length > 0,
      skipMealTypes: isFirst ? mealTypesRegisteredToday : [],
    });
  }
  return result;
}

export { SYSTEM_PROMPT_WEEK };
