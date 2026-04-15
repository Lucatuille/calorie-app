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
 * Params opcionales para modelar escenarios de incertidumbre (Mifflin 1990,
 * Hall 2011, Müller 2015):
 *  - adherenceOverride: reemplaza la adherencia base (0-1).
 *  - tdeeMultiplier: factor aplicado al TDEE. Rango cientifico ±6% refleja
 *    la CV poblacional tipica del metodo Mifflin-St Jeor + PAL.
 *  - adaptationFactor: multiplicador del coeficiente de adaptacion metabolica
 *    (base 10 kcal/dia/kg). Usar 1.5 para escenario adverso (Hall 2011
 *    describe drops de 10-15% de TDEE en deficit prolongado).
 *
 * IMPORTANTE: mantener paridad con backend projectWeightScenario en
 *   worker/src/routes/progress.js (se usa en 1ª pintada antes del slider).
 *
 * @returns Peso proyectado en kg, redondeado a 1 decimal.
 */
export function projectWithAdjustment(
  base: ProjectionBase,
  kcalAdjust: number,
  days: number,
  adherenceOverride?: number,
  tdeeMultiplier: number = 1.0,
  adaptationFactor: number = 1.0,
): number {
  const { current_weight, weighted_avg_cal, tdee_effective, adherence_rate } = base;
  if (!current_weight || current_weight <= 0) return current_weight || 0;

  const adh = adherenceOverride !== undefined ? adherenceOverride : adherence_rate;
  const effectiveTdee = tdee_effective * tdeeMultiplier;
  const newIntake = weighted_avg_cal + kcalAdjust;
  const dailyDeficit = effectiveTdee - newIntake;

  let weight = current_weight;
  for (let day = 1; day <= days; day++) {
    const weightDelta = weight - current_weight;
    // Adaptación metabólica (Hall 2011): 10 kcal/día/kg de cambio.
    // adaptationFactor × 1.5 simula adaptación agresiva en escenario adverso.
    const adaptationKcal = -Math.sign(dailyDeficit) * Math.abs(weightDelta) * 10 * adaptationFactor;
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
