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

  if (confidence === 'high') {
    return `
DATOS OFICIALES VERIFICADOS — USAR COMO BASE OBLIGATORIA:
Fuente: ${dish.fuente_primaria}
Plato identificado: ${dish.nombre}
Porción de referencia: ${dish.porcion_g}g (${dish.porcion_desc})

Valores por porción de referencia:
  Calorías: ${dish.kcal_ref} kcal [rango verificado: ${dish.kcal_min}-${dish.kcal_max} kcal]
  Proteína: ${dish.proteina_g}g
  Carbohidratos: ${dish.carbos_g}g
  Grasa: ${dish.grasa_g}g

Instrucción: Estos valores son datos oficiales españoles verificados. Úsalos como base. Ajusta proporcionalmente si el usuario indica cantidad diferente a la porción de referencia.
${dish.notas_claude || ''}`;
  }

  if (confidence === 'medium') {
    return `
POSIBLE COINCIDENCIA EN BASE DE DATOS ESPAÑOLA:
Plato probable: ${dish.nombre} (${dish.porcion_g}g = ${dish.kcal_ref} kcal)
Confianza: MEDIA — verifica por contexto antes de usar.
${dish.notas_claude || ''}
Si el plato coincide, usa estos valores como base.`;
  }

  // Low confidence
  return `
POSIBLE REFERENCIA (verificar con el usuario):
El texto menciona "${dish.token_principal}" — podría ser ${dish.nombre}.
Si es así: ${dish.porcion_g}g = ${dish.kcal_ref} kcal [${dish.kcal_min}-${dish.kcal_max}]
Indica en las notas de tu respuesta si hay ambigüedad.`;
}

/**
 * Format matched dish data for photo analysis validation.
 * Used AFTER Claude returns its estimate, to validate/correct.
 */
export function formatDishValidation(match) {
  if (!match || match.confidence === 'low') return '';

  const { dish } = match;
  return `
VALIDACIÓN CON BASE DE DATOS ESPAÑOLA:
El plato parece ser "${dish.nombre}".
Referencia verificada: ${dish.kcal_ref} kcal por ${dish.porcion_g}g [${dish.kcal_min}-${dish.kcal_max}].
Si tu estimación difiere >20% de este rango, revisa tu cálculo.`;
}
