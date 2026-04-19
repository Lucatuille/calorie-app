// ============================================================
//  mealTypeInfer — normalización e inferencia de meal_type.
//
//  El usuario puede registrar comidas sin meal_type explícito
//  (valor 'other' o null). Para que Chef Caliro no genere un
//  desayuno cuando ya hay una entry de desayuno sin tipo, inferimos
//  por la hora de created_at.
//
//  Ventanas (heurística pragmática ajustada al horario español):
//    <  13:00  → desayuno  (incluye desayunos tardíos / media mañana ES)
//    13 - 16   → comida
//    16 - 19   → merienda
//    >= 19     → cena
//
//  Decisión 2026-04-17: ventana desayuno ampliada de <12 a <13 para
//  cubrir el patrón cultural español (desayuno tardío a las 12:30 es
//  común, comida real arranca a las 14h). Antes 12:30 se clasificaba
//  como 'comida' y Chef generaba otro desayuno.
//
//  Decisión 2026-04-14: prioridad invertida — la HORA manda sobre el
//  meal_type explícito. Motivo: en la práctica el meal_type explícito
//  suele ser un default del form o una selección incorrecta. La hora
//  de created_at es factual y refleja mejor qué comida real hizo el
//  usuario. El explícito queda como fallback cuando no hay created_at.
// ============================================================

const EXPLICIT = {
  desayuno: 'desayuno', breakfast: 'desayuno',
  comida: 'comida',     lunch:     'comida',
  merienda: 'merienda', snack:     'merienda',
  cena: 'cena',         dinner:    'cena',
};

function inferFromHour(hour) {
  if (hour < 13) return 'desayuno';
  if (hour < 16) return 'comida';
  if (hour < 19) return 'merienda';
  return 'cena';
}

function inferFromCreatedAt(at) {
  if (at === undefined || at === null || at === '') return null;
  let d;
  if (typeof at === 'number') {
    d = new Date(at);
  } else {
    // SQLite datetime() devuelve 'YYYY-MM-DD HH:MM:SS' en UTC.
    const iso = String(at).includes('T') ? at : String(at).replace(' ', 'T') + 'Z';
    d = new Date(iso);
  }
  if (isNaN(d.getTime())) return null;
  try {
    const hourStr = d.toLocaleString('en-US', {
      timeZone: 'Europe/Madrid',
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(hourStr, 10);
    if (!Number.isNaN(hour)) return inferFromHour(hour);
  } catch {
    return inferFromHour(d.getUTCHours() + 2); // fallback aproximado CEST
  }
  return null;
}

/**
 * Devuelve el meal_type normalizado (en español) para una entry.
 *
 * Prioridad:
 *  1. Hora de created_at (zona Europa/Madrid, cubre DST).
 *  2. meal_type explícito si no hay hora utilizable.
 *  3. null si nada aplica.
 *
 * Razón de preferir la hora: el explícito suele ser default del form.
 * Una entry "2 Tostadas con pavo" registrada a las 11:56 Madrid debe
 * contar como desayuno aunque meal_type diga 'lunch'.
 *
 * @param {{ meal_type?: string, created_at?: string|number }} entry
 * @returns {'desayuno'|'comida'|'merienda'|'cena'|null}
 */
export function resolveMealType(entry) {
  const byHour = inferFromCreatedAt(entry.created_at);
  if (byHour) return byHour;

  const raw = (entry.meal_type || '').toLowerCase().trim();
  if (EXPLICIT[raw]) return EXPLICIT[raw];

  return null;
}

/**
 * Dadas las entries de hoy, devuelve el set de meal_types cubiertos
 * (para pasar a computeDaysToPlan como skipMealTypes).
 */
export function resolveMealTypesRegistered(entries) {
  const out = new Set();
  for (const e of entries || []) {
    const t = resolveMealType(e);
    if (t) out.add(t);
  }
  return [...out];
}

/**
 * Normaliza un nombre de plato para comparaciones tolerantes:
 * lowercase, sin tildes, espacios colapsados, trim. Empareja
 * "Tostadas con Tomate " con "tostadas con tomate".
 *
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function normalizeDishName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dadas las entries de hoy, devuelve el detalle de cada comida registrada:
 * type resuelto + nombre original + nombre normalizado.
 *
 * A diferencia de `resolveMealTypesRegistered`, NO deduplica: el cliente
 * necesita saber qué NOMBRES se registraron para marcar como "REGISTRADA"
 * solo los meals del plan cuyo nombre coincida. Dos entries del mismo tipo
 * pero distinto nombre devuelven 2 items (p. ej. user comió 2 snacks).
 *
 * Uso principal: el frontend de ChefPlanDay compara
 *   item.type === meal.type && item.normalized_name === normalize(meal.name)
 * para evitar el falso positivo "merienda marcada porque el user comió
 * otra cosa tarde".
 *
 * @param {Array<{meal_type?:string, name?:string, created_at?:string|number}>} entries
 * @returns {Array<{type:string, name:string, normalized_name:string}>}
 */
export function resolveMealItems(entries) {
  const out = [];
  for (const e of entries || []) {
    const t = resolveMealType(e);
    if (!t) continue;
    const rawName = (e.name || '').trim();
    if (!rawName) continue;
    out.push({
      type: t,
      name: rawName,
      normalized_name: normalizeDishName(rawName),
    });
  }
  return out;
}
