// ============================================================
//  fillDateGaps — rellena los días sin entries para que el
//  historial tenga continuidad temporal visible.
//
//  Entrada:  groups = [[date, entries[]], ...] ordenados DESC por fecha
//  Salida:   mismo formato pero con pares [date, []] insertados para
//            cada día sin registros entre `today` y el día más antiguo
//            presente, hasta un máximo de `maxFillDays` hacia atrás.
//
//  Razones de diseño (decisión 2026-04-15):
//  - Cap de 7 días (horizonte semanal humano natural). Registrar
//    comidas de hace >7 días es raro porque ya se olvida.
//  - Mostrar 60 días vacíos en lugar de 7 genera culpa visible y
//    satura visualmente sin aportar utilidad real.
//  - El tope del rango es el mínimo entre (oldest_entry, today-maxFill).
//    Si la entry más antigua es de hace 3 días, rellenamos 3 días.
//    Si es de hace 30 días, solo rellenamos los últimos 7 y las más
//    antiguas se mantienen tal cual sin expandir huecos.
//  - Parametrizable: cambiar maxFillDays sin tocar la lógica.
// ============================================================

const MAX_FILL_DAYS = 7;

export type Group<T> = [string, T[]];

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Devuelve la fecha N días antes de una fecha ISO dada.
 * N puede ser negativo (=días en el pasado) o positivo.
 */
export function shiftISODate(iso: string, deltaDays: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().split('T')[0];
}

/**
 * Rellena huecos de días en la lista de grupos.
 *
 * @param groups  Array ordenado DESC por fecha (primer item = más reciente)
 * @param maxFillDays  Límite del rango de relleno (default 60)
 * @param nowISO  Fecha "hoy" en ISO — parametrizable para tests deterministas
 */
export function fillDateGaps<T>(
  groups: Group<T>[],
  maxFillDays: number = MAX_FILL_DAYS,
  nowISO: string = todayISO(),
): Group<T>[] {
  if (!groups || groups.length === 0) return groups;

  // Día más antiguo ya presente (último del array DESC).
  const oldestPresent = groups[groups.length - 1][0];

  // Límite del relleno: no más de maxFillDays hacia atrás.
  const fillFloor = shiftISODate(nowISO, -(maxFillDays - 1));

  // El suelo efectivo del rango a rellenar:
  //   - Si el entry más antiguo es dentro del rango, rellenar hasta ahí.
  //   - Si es más antiguo que el floor, rellenar solo hasta el floor.
  const rangeFloor = oldestPresent < fillFloor ? fillFloor : oldestPresent;

  // Map para lookup O(1)
  const byDate = new Map<string, T[]>();
  for (const [d, items] of groups) byDate.set(d, items);

  const result: Group<T>[] = [];

  // 1. Expandir desde nowISO hasta rangeFloor, insertando huecos.
  //    Si nowISO tiene entries, se incluye. Si no, se marca como vacío.
  let cursor = nowISO;
  while (cursor >= rangeFloor) {
    result.push([cursor, byDate.get(cursor) || []]);
    cursor = shiftISODate(cursor, -1);
  }

  // 2. Añadir los grupos más antiguos que quedaron fuera del rango expandido
  //    (esos NO se expanden con huecos — se muestran tal cual).
  for (const [date, items] of groups) {
    if (date < rangeFloor) result.push([date, items]);
  }

  return result;
}
