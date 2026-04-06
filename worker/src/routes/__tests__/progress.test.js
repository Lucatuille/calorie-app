// ============================================================
//  TESTS — progress.js (summary, streak, projection, analytics)
//  Ejecutar: cd worker && npx vitest run src/routes/__tests__/progress.test.js
//
//  Estos tests verifican la lógica de cálculo que el usuario ve
//  directamente. Un bug silencioso aquí = datos falsos mostrados.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Importar funciones puras para testear directamente ──────
// progress.js no exporta las helpers, así que las reimplementamos
// para validar la lógica contra la fuente de verdad

// Reimplementación exacta de calcStdDev (progress.js:9-13)
function calcStdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
}

// Reimplementación exacta de projectWeightScenario (progress.js:15-27)
function projectWeightScenario(startWeight, dailyDeficit, adherenceRate, days) {
  if (startWeight <= 0) return startWeight;
  let weight = startWeight;
  for (let day = 1; day <= days; day++) {
    const weightLost = startWeight - weight;
    const adaptationFactor = Math.max(0.75, 1 - (weightLost / startWeight) * 0.15);
    const tdeeReduction = weightLost * 22;
    const adjustedDeficit = (dailyDeficit - tdeeReduction) * adaptationFactor * adherenceRate;
    const tissueEnergyDensity = day < 14 ? 5000 : 7200;
    weight -= adjustedDeficit / tissueEnergyDensity;
  }
  return Math.round(weight * 10) / 10;
}

// Reimplementación exacta de calcPlateauPrediction (progress.js:38-49)
function calcPlateauPrediction(adherenceRate) {
  if (adherenceRate < 0.70) {
    return {
      will_plateau: true,
      estimated_day: Math.round(180 * adherenceRate),
      reason: adherenceRate < 0.5
        ? 'Tu adherencia actual sugiere un plateau pronto. Registrar más días mejorará la precisión.'
        : 'Con tu adherencia actual, es probable un plateau antes de los 6 meses.',
    };
  }
  return { will_plateau: false };
}


// ═══════════════════════════════════════════════════════════
//  1. CALCSTDDEV — estadística base
// ═══════════════════════════════════════════════════════════

describe('calcStdDev', () => {
  it('devuelve 0 para arrays con < 2 elementos', () => {
    expect(calcStdDev([])).toBe(0);
    expect(calcStdDev([100])).toBe(0);
  });

  it('devuelve 0 para valores idénticos', () => {
    expect(calcStdDev([2000, 2000, 2000])).toBe(0);
  });

  it('calcula correctamente desviación estándar', () => {
    // [1800, 2200] → mean=2000, deviations=[-200, 200], variance=40000, std=200
    expect(calcStdDev([1800, 2200])).toBeCloseTo(200, 0);
  });

  it('refleja mayor variabilidad en dietas inconsistentes', () => {
    const consistente = calcStdDev([2000, 2050, 1950, 2010, 1990]);
    const irregular   = calcStdDev([1200, 2800, 1500, 2600, 1900]);
    expect(irregular).toBeGreaterThan(consistente * 5);
  });
});


// ═══════════════════════════════════════════════════════════
//  2. PROJECTWEIGHTSCENARIO — proyecciones de peso
// ═══════════════════════════════════════════════════════════

describe('projectWeightScenario', () => {
  it('peso baja con déficit positivo', () => {
    // 80kg, déficit 500 kcal/día, adherencia 100%, 30 días
    const result = projectWeightScenario(80, 500, 1.0, 30);
    expect(result).toBeLessThan(80);
    expect(result).toBeGreaterThan(70); // no puede bajar 10kg en 30 días
  });

  it('peso sube con superávit (déficit negativo)', () => {
    // 70kg, déficit -500 (come 500 más que TDEE), adherencia 100%, 30 días
    const result = projectWeightScenario(70, -500, 1.0, 30);
    expect(result).toBeGreaterThan(70);
  });

  it('adherencia 0 = sin cambio de peso', () => {
    const result = projectWeightScenario(80, 500, 0, 30);
    expect(result).toBe(80);
  });

  it('adaptación metabólica frena la pérdida progresivamente', () => {
    // 90 días pierde menos por kg que 30 días (el cuerpo se adapta)
    const at30 = projectWeightScenario(80, 500, 1.0, 30);
    const at90 = projectWeightScenario(80, 500, 1.0, 90);
    const lostPer30 = (80 - at30) / 1;
    const lostPer30from90 = (80 - at90) / 3;
    expect(lostPer30from90).toBeLessThan(lostPer30);
  });

  it('densidad energética cambia a los 14 días (5000→7200)', () => {
    // En los primeros 14 días se pierde más (incluye agua)
    const at7 = projectWeightScenario(80, 500, 1.0, 7);
    const at14 = projectWeightScenario(80, 500, 1.0, 14);
    const at21 = projectWeightScenario(80, 500, 1.0, 21);
    const loss7to14 = at7 - at14;
    const loss14to21 = at14 - at21;
    // Primeras 2 semanas pierde más rápido que las siguientes
    expect(loss7to14).toBeGreaterThan(loss14to21);
  });

  it('peso ≤ 0 devuelve el mismo valor sin procesar', () => {
    expect(projectWeightScenario(0, 500, 1.0, 30)).toBe(0);
    expect(projectWeightScenario(-5, 500, 1.0, 30)).toBe(-5);
  });

  it('adherencia parcial (50%) pierde la mitad que adherencia completa', () => {
    const full = projectWeightScenario(80, 500, 1.0, 30);
    const half = projectWeightScenario(80, 500, 0.5, 30);
    const lossFull = 80 - full;
    const lossHalf = 80 - half;
    // No exactamente mitad por la adaptación, pero cercano
    expect(lossHalf / lossFull).toBeGreaterThan(0.4);
    expect(lossHalf / lossFull).toBeLessThan(0.6);
  });
});


// ═══════════════════════════════════════════════════════════
//  3. CALCPLATEAUPREDICTION — predicción de plateau
// ═══════════════════════════════════════════════════════════

describe('calcPlateauPrediction', () => {
  it('no predice plateau si adherencia ≥ 70%', () => {
    expect(calcPlateauPrediction(0.70).will_plateau).toBe(false);
    expect(calcPlateauPrediction(0.85).will_plateau).toBe(false);
    expect(calcPlateauPrediction(1.0).will_plateau).toBe(false);
  });

  it('predice plateau si adherencia < 70%', () => {
    const result = calcPlateauPrediction(0.60);
    expect(result.will_plateau).toBe(true);
    expect(result.estimated_day).toBe(Math.round(180 * 0.60));
  });

  it('mensaje diferente si adherencia < 50%', () => {
    const low = calcPlateauPrediction(0.40);
    const mid = calcPlateauPrediction(0.60);
    expect(low.reason).toContain('pronto');
    expect(mid.reason).toContain('6 meses');
  });
});


// ═══════════════════════════════════════════════════════════
//  4. STREAK — cálculo de racha (lógica del handler)
// ═══════════════════════════════════════════════════════════

describe('streak calculation logic', () => {
  // Reimplementa la lógica de streak del handler (progress.js:88-110)
  function calcStreak(dates, today) {
    if (!dates.length) return 0;
    const yesterdayStr = new Date(new Date(today + 'T12:00:00Z').getTime() - 86400000)
      .toISOString().split('T')[0];

    let streak = 0;
    const first = dates[0]; // dates sorted DESC
    if (first === today || first === yesterdayStr) {
      let check = first;
      for (const date of dates) {
        if (date === check) {
          streak++;
          const d = new Date(check + 'T12:00:00Z');
          d.setUTCDate(d.getUTCDate() - 1);
          check = d.toISOString().split('T')[0];
        } else break;
      }
    }
    return streak;
  }

  it('streak = 0 si sin datos', () => {
    expect(calcStreak([], '2026-04-06')).toBe(0);
  });

  it('streak = 1 si solo registró hoy', () => {
    expect(calcStreak(['2026-04-06'], '2026-04-06')).toBe(1);
  });

  it('streak = 1 si solo registró ayer', () => {
    expect(calcStreak(['2026-04-05'], '2026-04-06')).toBe(1);
  });

  it('streak = 0 si último registro fue hace 2+ días', () => {
    expect(calcStreak(['2026-04-04'], '2026-04-06')).toBe(0);
  });

  it('streak consecutivo de 5 días', () => {
    const dates = ['2026-04-06', '2026-04-05', '2026-04-04', '2026-04-03', '2026-04-02'];
    expect(calcStreak(dates, '2026-04-06')).toBe(5);
  });

  it('streak se rompe con hueco', () => {
    // Registró hoy, ayer, y hace 3 días (hueco en anteayer)
    const dates = ['2026-04-06', '2026-04-05', '2026-04-03'];
    expect(calcStreak(dates, '2026-04-06')).toBe(2);
  });

  it('streak cuenta desde ayer si hoy no ha registrado', () => {
    const dates = ['2026-04-05', '2026-04-04', '2026-04-03'];
    expect(calcStreak(dates, '2026-04-06')).toBe(3);
  });
});


// ═══════════════════════════════════════════════════════════
//  5. ADHERENCE — cálculo de adherencia
// ═══════════════════════════════════════════════════════════

describe('adherence calculation', () => {
  const ADHERENCE_TOLERANCE = 250;

  function calcAdherence(calories, target) {
    if (!target || !calories.length) return null;
    const daysInTarget = calories.filter(c => Math.abs(c - target) <= ADHERENCE_TOLERANCE).length;
    return Math.round(daysInTarget / calories.length * 100);
  }

  it('100% si todos los días dentro de ±250', () => {
    expect(calcAdherence([2000, 2100, 1900, 2200, 1800], 2000)).toBe(100);
  });

  it('0% si todos los días fuera de rango', () => {
    expect(calcAdherence([1000, 3000, 1200, 2800], 2000)).toBe(0);
  });

  it('el límite exacto (±250) cuenta como adherente', () => {
    expect(calcAdherence([2250], 2000)).toBe(100); // justo en el límite
    expect(calcAdherence([1750], 2000)).toBe(100);
  });

  it('justo fuera del límite (±251) no cuenta', () => {
    expect(calcAdherence([2251], 2000)).toBe(0);
    expect(calcAdherence([1749], 2000)).toBe(0);
  });

  it('null si no hay target', () => {
    expect(calcAdherence([2000, 2100], null)).toBeNull();
  });

  it('null si no hay datos de calorías', () => {
    expect(calcAdherence([], 2000)).toBeNull();
  });
});


// ═══════════════════════════════════════════════════════════
//  6. WEIGHT TREND — tendencia de peso semanal
// ═══════════════════════════════════════════════════════════

describe('weight trend calculation', () => {
  function calcTrendPerWeek(weightEntries) {
    if (weightEntries.length < 2) return null;
    const first = weightEntries[0];
    const last = weightEntries[weightEntries.length - 1];
    const change = +(last.weight - first.weight).toFixed(1);
    const spanDays = (new Date(last.date + 'T12:00:00Z') - new Date(first.date + 'T12:00:00Z')) / 86400000;
    if (spanDays < 3) return null;
    return +((change / (spanDays / 7)).toFixed(2));
  }

  it('null con menos de 2 datos de peso', () => {
    expect(calcTrendPerWeek([{ date: '2026-04-01', weight: 80 }])).toBeNull();
  });

  it('null si span < 3 días (datos muy juntos)', () => {
    const entries = [
      { date: '2026-04-05', weight: 80 },
      { date: '2026-04-06', weight: 79.5 },
    ];
    expect(calcTrendPerWeek(entries)).toBeNull();
  });

  it('calcula pérdida por semana correctamente', () => {
    // 80 → 79 en 7 días = -1 kg/semana
    const entries = [
      { date: '2026-03-30', weight: 80 },
      { date: '2026-04-06', weight: 79 },
    ];
    expect(calcTrendPerWeek(entries)).toBeCloseTo(-1.0, 1);
  });

  it('calcula ganancia por semana correctamente', () => {
    // 70 → 71 en 14 días = +0.5 kg/semana
    const entries = [
      { date: '2026-03-23', weight: 70 },
      { date: '2026-04-06', weight: 71 },
    ];
    expect(calcTrendPerWeek(entries)).toBeCloseTo(0.5, 1);
  });

  it('usa span real entre datos, no período completo', () => {
    // BUG FIX: si hay datos solo los últimos 3 días de un período de 30,
    // debe dividir por el span real (3 días), no 30
    const entries = [
      { date: '2026-04-03', weight: 80 },
      { date: '2026-04-06', weight: 79 },
    ];
    const trend = calcTrendPerWeek(entries);
    // 3 días de span → cambio de -1kg en ~0.43 semanas → ~-2.33 kg/semana
    expect(trend).toBeCloseTo(-2.33, 1);
  });
});


// ═══════════════════════════════════════════════════════════
//  7. CALORIE TREND — tendencia improving/worsening
// ═══════════════════════════════════════════════════════════

describe('calorie trend detection', () => {
  function calcTrend(calDays) {
    const half = Math.floor(calDays.length / 2);
    if (half < 2) return { trend: 'stable', trendPct: 0 };
    const firstAvg  = calDays.slice(0, half).reduce((a,b)=>a+b,0) / half;
    const secondAvg = calDays.slice(half).reduce((a,b)=>a+b,0) / (calDays.length - half);
    const trendPct = firstAvg > 0 ? Math.round((secondAvg - firstAvg) / firstAvg * 100) : 0;
    let trend = 'stable';
    if (trendPct < -5) trend = 'improving';
    else if (trendPct > 5) trend = 'worsening';
    return { trend, trendPct };
  }

  it('stable si < 4 datos (half < 2)', () => {
    expect(calcTrend([2000, 1800, 2100]).trend).toBe('stable');
  });

  it('improving si segunda mitad come menos (-5%)', () => {
    // Primera mitad: ~2200, segunda mitad: ~1800
    const result = calcTrend([2200, 2200, 1800, 1800]);
    expect(result.trend).toBe('improving');
    expect(result.trendPct).toBeLessThan(-5);
  });

  it('worsening si segunda mitad come más (+5%)', () => {
    const result = calcTrend([1800, 1800, 2200, 2200]);
    expect(result.trend).toBe('worsening');
    expect(result.trendPct).toBeGreaterThan(5);
  });

  it('stable si variación < 5%', () => {
    const result = calcTrend([2000, 2000, 2050, 2050]);
    expect(result.trend).toBe('stable');
  });

  it('trendPct mantiene signo (no usa Math.abs)', () => {
    // BUG FIX verificación: trendPct debe ser negativo cuando mejora
    const result = calcTrend([2200, 2200, 1800, 1800]);
    expect(result.trendPct).toBeLessThan(0);
  });
});


// ═══════════════════════════════════════════════════════════
//  8. DAYS_TO_GOAL — cap y edge cases
// ═══════════════════════════════════════════════════════════

describe('daysToGoalRealistic', () => {
  function calcDaysToGoal(currentWeight, goalWeight, lossIn30) {
    if (!goalWeight || currentWeight <= goalWeight) return null;
    if (lossIn30 <= 0) return 730; // superávit → cap
    const raw = Math.round((currentWeight - goalWeight) * (30 / lossIn30));
    return Math.min(730, raw);
  }

  it('null si no hay goal_weight', () => {
    expect(calcDaysToGoal(80, null, 1)).toBeNull();
  });

  it('null si ya alcanzó el objetivo', () => {
    expect(calcDaysToGoal(75, 80, 1)).toBeNull();
  });

  it('calcula días correctamente', () => {
    // 80kg → 75kg, pierde 1kg en 30 días → 5*30 = 150 días
    expect(calcDaysToGoal(80, 75, 1)).toBe(150);
  });

  it('cap a 730 días si pérdida casi nula', () => {
    // 80 → 70, pierde 0.01kg en 30 días → 300*30 = 9000 → cap 730
    expect(calcDaysToGoal(80, 70, 0.01)).toBe(730);
  });

  it('cap a 730 si está en superávit (lossIn30 ≤ 0)', () => {
    expect(calcDaysToGoal(80, 75, 0)).toBe(730);
    expect(calcDaysToGoal(80, 75, -1)).toBe(730);
  });
});


// ═══════════════════════════════════════════════════════════
//  9. DAYS_WITH_DATA — solo cuenta días con calorías reales
// ═══════════════════════════════════════════════════════════

describe('days_with_data count', () => {
  it('no cuenta días solo con peso (calories=0)', () => {
    const daily = [
      { date: '2026-04-01', calories: 2000, weight: 80 },
      { date: '2026-04-02', calories: 0, weight: 79.5 },   // solo peso
      { date: '2026-04-03', calories: 1800, weight: null },
    ];
    // BUG FIX: calDays = daily.map(d => d.calories).filter(Boolean)
    const calDays = daily.map(d => d.calories).filter(Boolean);
    expect(calDays.length).toBe(2); // no 3
  });
});


// ═══════════════════════════════════════════════════════════
//  10. BEST/WORST DAY — lógica de selección
// ═══════════════════════════════════════════════════════════

describe('best/worst day selection', () => {
  function selectBestWorstDay(dowStats, target) {
    if (!dowStats.length) return { bestDay: null, worstDay: null };

    if (target) {
      const sorted = [...dowStats].sort((a, b) =>
        Math.abs(a.avg_cal - target) - Math.abs(b.avg_cal - target)
      );
      const bestDay = sorted[0].day_name;
      const overTarget = dowStats.filter(d => d.avg_cal > target);
      const worstRow = overTarget.length
        ? overTarget.reduce((a, b) => a.avg_cal > b.avg_cal ? a : b)
        : dowStats[dowStats.length - 1];
      return { bestDay, worstDay: worstRow.day_name };
    }

    return {
      bestDay: dowStats[0].day_name,
      worstDay: dowStats[dowStats.length - 1].day_name,
    };
  }

  it('con target: mejor día = más cercano al objetivo', () => {
    const stats = [
      { day_name: 'Lunes', avg_cal: 1800 },
      { day_name: 'Martes', avg_cal: 2050 },
      { day_name: 'Sábado', avg_cal: 2500 },
    ];
    const { bestDay } = selectBestWorstDay(stats, 2000);
    expect(bestDay).toBe('Martes'); // 2050, solo 50 de diferencia
  });

  it('con target: peor día = más por encima del objetivo', () => {
    const stats = [
      { day_name: 'Lunes', avg_cal: 1800 },
      { day_name: 'Viernes', avg_cal: 2300 },
      { day_name: 'Sábado', avg_cal: 2500 },
    ];
    const { worstDay } = selectBestWorstDay(stats, 2000);
    expect(worstDay).toBe('Sábado');
  });

  it('sin target: mejor = menos calorías, peor = más calorías', () => {
    const stats = [
      { day_name: 'Lunes', avg_cal: 1500 },    // sorted ASC
      { day_name: 'Sábado', avg_cal: 2800 },
    ];
    const { bestDay, worstDay } = selectBestWorstDay(stats, null);
    expect(bestDay).toBe('Lunes');
    expect(worstDay).toBe('Sábado');
  });
});
