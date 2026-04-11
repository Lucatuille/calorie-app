// ============================================================
//  Funcion de proyeccion para el simulador "¿Y si...?"
//  Replica la matematica del backend (worker/src/routes/progress.js)
//  para poder recalcular en tiempo real al mover un slider, sin
//  llamadas API.
//
//  IMPORTANTE: si cambias la formula del backend en projectWeightScenario,
//  actualiza esta tambien para mantener consistencia.
// ============================================================

interface ProjectionBase {
  current_weight: number;
  weighted_avg_cal: number;        // kcal/dia que come en promedio (ventana 30d)
  tdee_effective: number;           // kcal/dia que su cuerpo realmente quema
  adherence_rate: number;           // 0-1, dias que registra/se mantiene en plan
}

/**
 * Proyecta el peso futuro con un ajuste calorico aplicado a la ingesta diaria.
 *
 * @param base       - Parametros base del usuario (del backend)
 * @param kcalAdjust - Ajuste a la ingesta: -400 a +400 kcal
 * @param days       - Dias a proyectar (30, 60, 90)
 * @returns          - Peso proyectado en kg, redondeado a 1 decimal
 */
/**
 * Proyecta el peso futuro con un ajuste calorico aplicado.
 * Si adherenceOverride se pasa, lo usa en vez de base.adherence_rate
 * (permite calcular escenarios optimista/conservador desde frontend).
 */
export function projectWithAdjustment(
  base: ProjectionBase,
  kcalAdjust: number,
  days: number,
  adherenceOverride?: number,
): number {
  const { current_weight, weighted_avg_cal, tdee_effective, adherence_rate } = base;
  if (!current_weight || current_weight <= 0) return current_weight || 0;

  const adh = adherenceOverride !== undefined ? adherenceOverride : adherence_rate;
  const newIntake = weighted_avg_cal + kcalAdjust;
  const dailyDeficit = tdee_effective - newIntake;

  let weight = current_weight;
  for (let day = 1; day <= days; day++) {
    const weightDelta = weight - current_weight;
    const adaptationKcal = -Math.sign(dailyDeficit) * Math.abs(weightDelta) * 10;
    const adaptedDeficit = dailyDeficit + adaptationKcal;
    const effectiveDeficit = adaptedDeficit * adh;
    const t = Math.min(1, day / 28);
    const tissueEnergyDensity = 5000 + (7700 - 5000) * t;
    weight -= effectiveDeficit / tissueEnergyDensity;
  }
  return Math.round(weight * 10) / 10;
}

/**
 * Calcula los dias estimados para alcanzar el goal_weight con el ajuste actual.
 * Devuelve null si no hay goal o si no se puede alcanzar (cap a 730 dias).
 */
export function daysToGoalWithAdjustment(
  base: ProjectionBase,
  kcalAdjust: number,
  goalWeight: number | null,
): number | null {
  if (!goalWeight || !base.current_weight) return null;
  const { current_weight } = base;
  if (current_weight === goalWeight) return 0;

  // Proyectamos a 30 dias y extrapolamos
  const w30 = projectWithAdjustment(base, kcalAdjust, 30);
  const change30 = w30 - current_weight;

  if (current_weight > goalWeight) {
    // Quiere perder
    if (change30 >= 0) return 730; // No baja, cap 2 anos
    return Math.min(730, Math.round((current_weight - goalWeight) * (30 / -change30)));
  } else {
    // Quiere ganar (bulking)
    if (change30 <= 0) return 730;
    return Math.min(730, Math.round((goalWeight - current_weight) * (30 / change30)));
  }
}
