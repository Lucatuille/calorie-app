// ============================================================
//  mealTypeInfer — normalización e inferencia de meal_type.
//
//  El usuario puede registrar comidas sin meal_type explícito
//  (valor 'other' o null). Para que Chef Caliro no genere un
//  desayuno cuando ya hay una entry de desayuno sin tipo, inferimos
//  por la hora de created_at.
//
//  Ventanas (heurística pragmática ajustada al horario español):
//    <  12:00  → desayuno  (incluye desayunos tardíos típicos en ES)
//    12 - 16   → comida
//    16 - 19   → merienda
//    >= 19     → cena
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
  if (hour < 12) return 'desayuno';
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
