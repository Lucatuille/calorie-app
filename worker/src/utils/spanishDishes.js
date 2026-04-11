// ============================================================
//  Spanish Dishes Database — matching + prompt injection
//  Feature flag: env.SPANISH_DB_ENABLED === 'true'
// ============================================================

/**
 * Normalize text for matching: lowercase, remove accents, strip filler words.
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(me|he|he comido|comi|tome|un|una|unos|unas|el|la|los|las|de|con|sin|y|al|a|en|mi|para)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match user input against the spanish_dishes table.
 * Returns { dish, score, confidence } or null.
 */
export async function matchDish(userInput, env) {
  if (!userInput || userInput.length < 3) return null;

  const input = normalize(userInput);
  let dishes;

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM spanish_dishes'
    ).all();
    dishes = results;
  } catch { return null; }

  if (!dishes?.length) return null;

  const scores = [];

  for (const dish of dishes) {
    const exclusions = JSON.parse(dish.tokens_exclusion || '[]');

    // If input contains an exclusion token, skip entirely
    if (exclusions.some(excl => input.includes(normalize(excl)))) continue;

    let score = 0;
    const dishNorm = normalize(dish.nombre);
    const aliases = JSON.parse(dish.aliases || '[]');
    const secondary = JSON.parse(dish.tokens_secundarios || '[]');

    // Level 1: Exact name match
    if (dishNorm === input) { score = 100; }

    // Level 2: Exact alias match
    else if (aliases.some(a => normalize(a) === input)) { score = 95; }

    // Level 3: All name tokens found in input
    else if (dishNorm.split(' ').every(t => t.length > 2 && input.includes(t))) { score = 85; }

    // Level 4: Primary token + at least one secondary
    else if (input.includes(normalize(dish.token_principal)) &&
             secondary.some(s => input.includes(normalize(s)))) { score = 75; }

    // Level 5: Primary token only (ambiguous)
    else if (input.includes(normalize(dish.token_principal))) { score = 50; }

    if (score > 0) scores.push({ dish, score });
  }

  scores.sort((a, b) => b.score - a.score);

  if (!scores.length) return null;

  const best = scores[0];

  if (best.score >= 85) return { dish: best.dish, confidence: 'high', score: best.score };
  if (best.score >= 75) return { dish: best.dish, confidence: 'medium', score: best.score };
  if (best.score >= 50) return { dish: best.dish, confidence: 'low', score: best.score };

  return null;
}

/**
 * Format matched dish data for injection into Claude's prompt.
 * Returns a string to append to the system or user message.
 */
export function formatDishContext(match) {
  if (!match) return '';

  const { dish, confidence } = match;

  // Parse porciones guide
  let porcionesText = '';
  try {
    const porciones = JSON.parse(dish.porciones_guia || '[]');
    if (porciones.length) {
      porcionesText = '\nGuía de porciones:\n' + porciones.map(p => `  - ${p.desc}: ${p.g}g = ${p.kcal} kcal`).join('\n');
    }
  } catch {}

  const refVisuales = dish.referencias_visuales
    ? `\nReferencias visuales: ${dish.referencias_visuales}` : '';

  if (confidence === 'high') {
    return `
DATOS OFICIALES VERIFICADOS — USAR COMO BASE OBLIGATORIA:
Fuente: ${dish.fuente_primaria}
Plato identificado: ${dish.nombre}

Valores por 100g: ${dish.kcal_per_100g} kcal | ${dish.proteina_per_100g}g prot | ${dish.carbos_per_100g}g carb | ${dish.grasa_per_100g}g grasa

Porción de referencia: ${dish.porcion_g}g (${dish.porcion_desc}) = ${dish.kcal_ref} kcal [${dish.kcal_min}-${dish.kcal_max}]
  Proteína: ${dish.proteina_g}g | Carbohidratos: ${dish.carbos_g}g | Grasa: ${dish.grasa_g}g
${porcionesText}${refVisuales}

Instrucción: Usa los valores por 100g para calcular la cantidad que estimas. La guía de porciones es tu ancla para textos ambiguos. Las referencias visuales son para estimación desde foto.
${dish.notas_claude || ''}`;
  }

  if (confidence === 'medium') {
    return `
POSIBLE COINCIDENCIA EN BASE DE DATOS ESPAÑOLA:
Plato probable: ${dish.nombre}
Valores por 100g: ${dish.kcal_per_100g} kcal | ${dish.proteina_per_100g}g prot | ${dish.carbos_per_100g}g carb | ${dish.grasa_per_100g}g grasa
Porción ref: ${dish.porcion_g}g = ${dish.kcal_ref} kcal [${dish.kcal_min}-${dish.kcal_max}]
${porcionesText}
Confianza: MEDIA — verifica por contexto antes de usar.
${dish.notas_claude || ''}`;
  }

  // Low confidence
  return `
POSIBLE REFERENCIA (verificar):
El texto menciona "${dish.token_principal}" — podría ser ${dish.nombre}.
Si es así: ${dish.porcion_g}g = ${dish.kcal_ref} kcal [${dish.kcal_min}-${dish.kcal_max}]
Por 100g: ${dish.kcal_per_100g} kcal
Indica en las notas si hay ambigüedad.`;
}

/**
 * Busca platos por rango calórico para Chef Caliro (sugerencias/plannings).
 * Con la tabla actual (~12 platos) sirve como ancla opcional — devuelve lo
 * que encaja y ya; si está vacía no bloquea nada (Chef se apoyará en
 * frequent_meals del usuario + conocimiento general de Claude).
 *
 * @param {object} env        — binding Cloudflare
 * @param {number} minKcal    — kcal mínimas del plato
 * @param {number} maxKcal    — kcal máximas del plato
 * @param {number} limit      — máximo de platos a devolver (default 10)
 * @param {string[]} excludeTerms — términos a excluir (alérgenos, disgustos) en nombre/notas
 * @returns {Promise<Array>} platos (posiblemente array vacío)
 */
export async function findDishesByCalorieRange(env, minKcal, maxKcal, limit = 10, excludeTerms = []) {
  if (!env?.DB) return [];
  const lo = Math.max(0, Math.floor(minKcal));
  const hi = Math.max(lo, Math.ceil(maxKcal));
  const lim = Math.max(1, Math.min(50, Math.floor(limit)));

  let dishes;
  try {
    const { results } = await env.DB.prepare(
      `SELECT nombre, categoria, kcal_ref, proteina_g, carbos_g, grasa_g,
              porcion_g, porcion_desc, notas_claude, confianza
         FROM spanish_dishes
        WHERE kcal_ref >= ? AND kcal_ref <= ?
        ORDER BY ABS(kcal_ref - ?) ASC
        LIMIT ?`
    ).bind(lo, hi, Math.round((lo + hi) / 2), lim).all();
    dishes = results || [];
  } catch {
    return [];
  }

  if (!dishes.length || !excludeTerms?.length) return dishes;

  // Filtro client-side de alérgenos/disgustos contra nombre + notas.
  // Normalizamos ambos lados (lowercase, sin tildes) para matching robusto.
  const exclNorm = excludeTerms
    .filter(Boolean)
    .map(t => normalize(String(t)));

  return dishes.filter(d => {
    const hay = `${normalize(d.nombre || '')} ${normalize(d.notas_claude || '')}`;
    return !exclNorm.some(term => term && hay.includes(term));
  });
}

/**
 * Format matched dish data for photo analysis validation.
 * Used AFTER Claude returns its estimate, to validate/correct.
 */
export function formatDishValidation(match) {
  if (!match || match.confidence === 'low') return '';

  const { dish } = match;

  let porcionesText = '';
  try {
    const porciones = JSON.parse(dish.porciones_guia || '[]');
    if (porciones.length) {
      porcionesText = '\nPorciones de referencia:\n' + porciones.map(p => `  - ${p.desc}: ${p.g}g = ${p.kcal} kcal`).join('\n');
    }
  } catch {}

  const refVisuales = dish.referencias_visuales
    ? `\nReferencias visuales para estimar tamaño: ${dish.referencias_visuales}` : '';

  return `
VALIDACIÓN CON BASE DE DATOS ESPAÑOLA:
El plato parece ser "${dish.nombre}".
Valores por 100g: ${dish.kcal_per_100g} kcal | ${dish.proteina_per_100g}g prot | ${dish.carbos_per_100g}g carb | ${dish.grasa_per_100g}g grasa
Referencia: ${dish.kcal_ref} kcal por ${dish.porcion_g}g [${dish.kcal_min}-${dish.kcal_max}]
${porcionesText}${refVisuales}
Instrucción: Usa las referencias visuales para estimar el tamaño en la foto. Calcula con valores por 100g. Si tu estimación difiere >20% del rango verificado, revisa.
${dish.notas_claude || ''}`;
}
