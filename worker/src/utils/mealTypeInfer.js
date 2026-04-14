// ============================================================
//  mealTypeInfer — normalización e inferencia de meal_type.
//
//  El usuario puede registrar comidas sin meal_type explícito
//  (valor 'other' o null). Para que Chef Caliro no genere un
//  desayuno cuando ya hay una entry de desayuno sin tipo, inferimos
//  por la hora de created_at.
//
//  Ventanas (heurística pragmática, es suficientemente buena):
//    <  11:00  → desayuno
//    11 - 16   → comida
//    16 - 19   → merienda
//    >= 19     → cena
// ============================================================

const EXPLICIT = {
  desayuno: 'desayuno', breakfast: 'desayuno',
  comida: 'comida',     lunch:     'comida',
  merienda: 'merienda', snack:     'merienda',
  cena: 'cena',         dinner:    'cena',
};

function inferFromHour(hour) {
  if (hour < 11) return 'desayuno';
  if (hour < 16) return 'comida';
  if (hour < 19) return 'merienda';
  return 'cena';
}

/**
 * Devuelve el meal_type normalizado (en español) para una entry.
 * Si `meal_type` es explícito (desayuno/breakfast/comida/...), se usa.
 * Si no, se infiere por la hora local de `created_at` (ISO string).
 * Si no hay hora, devuelve null.
 *
 * @param {{ meal_type?: string, created_at?: string|number }} entry
 * @returns {'desayuno'|'comida'|'merienda'|'cena'|null}
 */
export function resolveMealType(entry) {
  const raw = (entry.meal_type || '').toLowerCase().trim();
  if (EXPLICIT[raw]) return EXPLICIT[raw];

  // 'other' o null → inferir por hora (zona Europa/Madrid, cubre DST)
  const at = entry.created_at;
  if (at !== undefined && at !== null && at !== '') {
    let d;
    if (typeof at === 'number') {
      d = new Date(at);
    } else {
      // SQLite datetime() devuelve 'YYYY-MM-DD HH:MM:SS' en UTC.
      const iso = String(at).includes('T') ? at : String(at).replace(' ', 'T') + 'Z';
      d = new Date(iso);
    }
    if (!isNaN(d.getTime())) {
      // Hora en zona local del usuario (España, mercado principal).
      // Futuro: aceptar tz como parámetro si se internacionaliza.
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
    }
  }

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
