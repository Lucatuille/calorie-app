// ============================================================
//  PROGRESS ROUTES — /api/progress
// ============================================================

import { jsonResponse, errorResponse, authenticate, requireProAccess, proAccessDenied } from '../utils.js';
import { ADHERENCE_TOLERANCE } from '../constants.js';

// ── Scientific projection helpers ──────────────────────────────
function calcStdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
}

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

function calcUncertaintyBands(proj, day, cv, adherenceRate) {
  const total = Math.sqrt(day) * 0.08 + (1 - adherenceRate) * 2 + cv * 1.5;
  return {
    optimistic:   Math.round((proj - total * 0.5) * 10) / 10,
    realistic:    proj,
    conservative: Math.round((proj + total) * 10) / 10,
  };
}

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

export async function handleProgress(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  // GET /api/progress/summary
  if (path === '/api/progress/summary' && request.method === 'GET') {
    const profile = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first();

    // Aggregate multiple meals into daily totals (last 30 days)
    const { results: entries } = await env.DB.prepare(
      `SELECT date,
         SUM(calories) AS calories, SUM(protein) AS protein,
         SUM(carbs) AS carbs, SUM(fat) AS fat, MAX(weight) AS weight
       FROM entries WHERE user_id = ?
       AND date >= date('now', '-30 days')
       GROUP BY date ORDER BY date ASC`
    ).bind(user.userId).all();

    // Merge weight from weight_logs into daily entries
    try {
      const { results: weightRows } = await env.DB.prepare(
        'SELECT date, weight_kg FROM weight_logs WHERE user_id = ? AND date >= date(\'now\', \'-30 days\')'
      ).bind(user.userId).all();
      const weightMap = Object.fromEntries(weightRows.map(r => [r.date, r.weight_kg]));
      for (const e of entries) {
        if (!e.weight && weightMap[e.date]) e.weight = weightMap[e.date];
      }
      // Add weight-only days (days with weight but no food entries)
      for (const [date, wkg] of Object.entries(weightMap)) {
        if (!entries.find(e => e.date === date)) {
          entries.push({ date, calories: 0, protein: 0, carbs: 0, fat: 0, weight: wkg });
        }
      }
      entries.sort((a, b) => a.date.localeCompare(b.date));
    } catch { /* weight_logs table might not exist yet */ }

    // Streak: distinct dates (one per day even with multiple meals)
    const { results: streakRows } = await env.DB.prepare(
      `SELECT DISTINCT date FROM entries WHERE user_id = ?
       AND date >= date('now', '-90 days') ORDER BY date DESC`
    ).bind(user.userId).all();

    // Streak
    let streak = 0;
    const todayStr     = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (streakRows.length > 0) {
      const first = streakRows[0].date;
      if (first === todayStr || first === yesterdayStr) {
        let check = first;
        for (const row of streakRows) {
          if (row.date === check) {
            streak++;
            const d = new Date(check + 'T12:00:00Z');
            d.setUTCDate(d.getUTCDate() - 1);
            check = d.toISOString().split('T')[0];
          } else { break; }
        }
      }
    }

    if (!entries.length) {
      return jsonResponse({ entries: [], summary: { streak, totalDaysLogged: 0 } });
    }

    const calories = entries.map(e => e.calories).filter(Boolean);
    const weights  = entries.map(e => e.weight).filter(Boolean);

    const avgCalories    = Math.round(calories.reduce((a,b) => a+b, 0) / calories.length);
    const targetCalories = profile?.target_calories || null;

    const weightTrend = weights.length >= 2
      ? +(weights[weights.length-1] - weights[0]).toFixed(1) : null;

    const adherence = targetCalories
      ? Math.round((calories.filter(c => Math.abs(c - targetCalories) <= ADHERENCE_TOLERANCE).length / calories.length) * 100)
      : null;

    // Weekly comparison
    // Ventana móvil exacta: últimos 7 días (sin incluir el límite de hace 7 días)
    const weekAgoStr     = new Date(Date.now() - 6  * 86400000).toISOString().split('T')[0]; // >hoy-7 = >=hoy-6
    const twoWeeksAgoStr = new Date(Date.now() - 13 * 86400000).toISOString().split('T')[0];
    const thisWeek = entries.filter(e => e.date >= weekAgoStr);
    const lastWeek = entries.filter(e => e.date >= twoWeeksAgoStr && e.date < weekAgoStr);

    const avgThisWeek = thisWeek.length
      ? Math.round(thisWeek.reduce((a,b) => a + b.calories, 0) / thisWeek.length) : null;
    const avgLastWeek = lastWeek.length
      ? Math.round(lastWeek.reduce((a,b) => a + b.calories, 0) / lastWeek.length) : null;

    const last7 = entries.slice(-7);
    const avgLast7 = last7.length
      ? Math.round(last7.reduce((a,b) => a + b.calories, 0) / last7.length) : null;

    return jsonResponse({
      entries,
      summary: {
        avgCalories, avgLast7, avgThisWeek, avgLastWeek,
        targetCalories, adherence, weightTrend, streak,
        totalDaysLogged: entries.length,
        currentWeight: weights[weights.length - 1] || null,
      }
    });
  }

  // GET /api/progress/chart — aggregate meals per day
  if (path === '/api/progress/chart' && request.method === 'GET') {
    const url     = new URL(request.url);
    const rawDays = parseInt(url.searchParams.get('days') || '30');
    const days    = [7, 30, 90].includes(rawDays) ? rawDays : 30; // whitelist — evita inyección SQL
    const { results } = await env.DB.prepare(
      `SELECT date,
         SUM(calories) AS calories, MAX(weight) AS weight,
         SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
       FROM entries WHERE user_id = ?
       AND date > date('now', '-${days} days')
       GROUP BY date ORDER BY date ASC`
    ).bind(user.userId).all();

    // Merge weight from weight_logs
    try {
      const { results: wRows } = await env.DB.prepare(
        `SELECT date, weight_kg FROM weight_logs WHERE user_id = ? AND date > date('now', '-${days} days')`
      ).bind(user.userId).all();
      const wMap = Object.fromEntries(wRows.map(r => [r.date, r.weight_kg]));
      for (const e of results) {
        if (!e.weight && wMap[e.date]) e.weight = wMap[e.date];
      }
      for (const [date, wkg] of Object.entries(wMap)) {
        if (!results.find(e => e.date === date)) {
          results.push({ date, calories: 0, protein: 0, carbs: 0, fat: 0, weight: wkg });
        }
      }
      results.sort((a, b) => a.date.localeCompare(b.date));
    } catch {}

    return jsonResponse(results);
  }

  // GET /api/progress/advanced — requiere Pro (verificación desde BD)
  if (path === '/api/progress/advanced' && request.method === 'GET') {
    const proUser = await requireProAccess(request, env);
    if (!proUser || proUser === 'waitlist') return proAccessDenied(proUser);
    const url    = new URL(request.url);
    const period = url.searchParams.get('period') || 'month';
    const days   = period === 'week' ? 7 : period === '90days' ? 90 : 30;

    const profile = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first();

    // Daily totals for the period — exclude today (partial day skews averages)
    const { results: daily } = await env.DB.prepare(
      `SELECT date,
         SUM(calories) AS calories, SUM(protein) AS protein,
         SUM(carbs) AS carbs, SUM(fat) AS fat, MAX(weight) AS weight
       FROM entries WHERE user_id = ?
       AND date >= date('now', '-${days} days') AND date < date('now')
       GROUP BY date ORDER BY date ASC`
    ).bind(user.userId).all();

    // Merge weight from weight_logs
    try {
      const { results: wRows } = await env.DB.prepare(
        `SELECT date, weight_kg FROM weight_logs WHERE user_id = ? AND date >= date('now', '-${days} days') AND date < date('now')`
      ).bind(user.userId).all();
      const wMap = Object.fromEntries(wRows.map(r => [r.date, r.weight_kg]));
      for (const e of daily) {
        if (!e.weight && wMap[e.date]) e.weight = wMap[e.date];
      }
      for (const [date, wkg] of Object.entries(wMap)) {
        if (!daily.find(e => e.date === date)) {
          daily.push({ date, calories: 0, protein: 0, carbs: 0, fat: 0, weight: wkg });
        }
      }
      daily.sort((a, b) => a.date.localeCompare(b.date));
    } catch {}

    if (!daily.length) {
      return jsonResponse({ period, days_with_data: 0, total_days: days });
    }

    // Meal type breakdown
    const { results: mealRows } = await env.DB.prepare(
      `SELECT meal_type, SUM(calories) AS total_cal
       FROM entries WHERE user_id = ?
       AND date >= date('now', '-${days} days') AND date < date('now')
       GROUP BY meal_type`
    ).bind(user.userId).all();

    // Top 5 most logged foods
    const { results: topFoods } = await env.DB.prepare(
      `SELECT name, COUNT(*) as times, ROUND(AVG(calories)) as avg_cal
       FROM entries WHERE user_id = ? AND name IS NOT NULL AND name != ''
       AND date >= date('now', '-${days} days') AND date < date('now')
       GROUP BY LOWER(name) ORDER BY times DESC LIMIT 5`
    ).bind(user.userId).all();

    // Best/worst day of week by average calories
    const { results: dowStats } = await env.DB.prepare(
      `SELECT
         CASE strftime('%w', date)
           WHEN '0' THEN 'Domingo' WHEN '1' THEN 'Lunes' WHEN '2' THEN 'Martes'
           WHEN '3' THEN 'Miércoles' WHEN '4' THEN 'Jueves'
           WHEN '5' THEN 'Viernes' WHEN '6' THEN 'Sábado'
         END as day_name,
         AVG(daily_cal) as avg_cal, COUNT(*) as n
       FROM (
         SELECT date, SUM(calories) as daily_cal
         FROM entries WHERE user_id = ?
         AND date >= date('now', '-${days} days') AND date < date('now')
         GROUP BY date
       )
       GROUP BY strftime('%w', date) ORDER BY avg_cal ASC`
    ).bind(user.userId).all();

    // ── Calorie stats ──────────────────────────────────────────
    const calDays = daily.map(d => d.calories).filter(Boolean);
    const target  = profile?.target_calories || null;
    const avg     = calDays.length ? Math.round(calDays.reduce((a,b)=>a+b,0)/calDays.length) : null;
    const minCal  = calDays.length ? Math.min(...calDays) : null;
    const maxCal  = calDays.length ? Math.max(...calDays) : null;

    const daysInTarget = target ? calDays.filter(c => Math.abs(c-target) <= ADHERENCE_TOLERANCE).length : 0;
    const daysOver     = target ? calDays.filter(c => c > target + ADHERENCE_TOLERANCE).length : 0;
    const daysUnder    = target ? calDays.filter(c => c < target - ADHERENCE_TOLERANCE).length : 0;
    const adherencePct = (target && calDays.length)
      ? Math.round(daysInTarget / calDays.length * 100) : null;

    // Calorie trend: first half vs second half
    const half = Math.floor(calDays.length / 2);
    let trend = 'stable', trendPct = 0;
    if (half >= 2) {
      const firstAvg  = calDays.slice(0, half).reduce((a,b)=>a+b,0) / half;
      const secondAvg = calDays.slice(half).reduce((a,b)=>a+b,0) / (calDays.length - half);
      trendPct = firstAvg > 0 ? Math.round((secondAvg - firstAvg) / firstAvg * 100) : 0;
      if      (trendPct < -5) trend = 'improving';
      else if (trendPct >  5) trend = 'worsening';
    }

    // Best day = closest to target (if target set); otherwise fewest calories
    // Worst day = furthest over target (if target set); otherwise most calories
    let bestDay, worstDay, worstDayAvg;
    if (target && dowStats.length) {
      const sorted = [...dowStats].sort((a, b) =>
        Math.abs(a.avg_cal - target) - Math.abs(b.avg_cal - target)
      );
      bestDay = sorted[0].day_name;
      const overTarget = dowStats.filter(d => d.avg_cal > target);
      const worstRow = overTarget.length
        ? overTarget.reduce((a, b) => a.avg_cal > b.avg_cal ? a : b)
        : dowStats[dowStats.length - 1];
      worstDay    = worstRow.day_name;
      worstDayAvg = Math.round(worstRow.avg_cal);
    } else {
      bestDay     = dowStats.length ? dowStats[0].day_name : null;
      worstDay    = dowStats.length ? dowStats[dowStats.length - 1].day_name : null;
      worstDayAvg = dowStats.length ? Math.round(dowStats[dowStats.length - 1].avg_cal) : null;
    }

    // ── Meal distribution ──────────────────────────────────────
    const totalMealCal = mealRows.reduce((a,m) => a + m.total_cal, 0);
    const mealPct = {};
    for (const m of mealRows) {
      mealPct[m.meal_type] = totalMealCal ? Math.round(m.total_cal / totalMealCal * 100) : 0;
    }
    const mostCalMeal = mealRows.sort((a,b) => b.total_cal - a.total_cal)[0]?.meal_type || null;

    // ── Weight stats ───────────────────────────────────────────
    const weightEntries = daily.filter(d => d.weight != null);
    const weightVals    = weightEntries.map(d => d.weight);
    const currentWeight = weightVals.length ? weightVals[weightVals.length - 1] : null;
    const startWeight   = weightVals.length ? weightVals[0] : null;
    const weightChange  = (currentWeight != null && startWeight != null)
      ? +((currentWeight - startWeight).toFixed(1)) : null;
    // Use actual span between first and last weight entry, not total period
    const weightSpanDays = weightEntries.length >= 2
      ? (new Date(weightEntries[weightEntries.length-1].date + 'T12:00:00Z') - new Date(weightEntries[0].date + 'T12:00:00Z')) / 86400000
      : 0;

    // ── Peso ajustado (Hacker's Diet EMA) + media movil 7d ─────
    // Suaviza el ruido diario de agua/sal/comida para mostrar tendencia real
    // Formula: EMA_i = alpha * raw_i + (1 - alpha) * EMA_{i-1}, alpha=0.1
    const ALPHA = 0.1;
    let emaPrev = weightVals.length ? weightVals[0] : null;
    const smoothedSeries = weightEntries.map((d, i) => {
      if (i === 0) return { date: d.date, smoothed: +d.weight.toFixed(2) };
      emaPrev = ALPHA * d.weight + (1 - ALPHA) * emaPrev;
      return { date: d.date, smoothed: +emaPrev.toFixed(2) };
    });
    // Inyectar peso ajustado en daily para que el frontend pueda dibujarlo
    const smoothedMap = Object.fromEntries(smoothedSeries.map(s => [s.date, s.smoothed]));
    for (const d of daily) {
      d.weight_smoothed = smoothedMap[d.date] || null;
    }
    const smoothedCurrent = smoothedSeries.length ? smoothedSeries[smoothedSeries.length - 1].smoothed : null;
    const smoothedStart   = smoothedSeries.length ? smoothedSeries[0].smoothed : null;
    const smoothedChange  = (smoothedCurrent != null && smoothedStart != null)
      ? +((smoothedCurrent - smoothedStart).toFixed(2)) : null;

    // Trend per week basado en peso ajustado (mas fiable que crudo)
    const trendPerWeek = (smoothedChange != null && weightSpanDays >= 3)
      ? +((smoothedChange / (weightSpanDays / 7)).toFixed(2))
      : (weightChange != null && weightSpanDays >= 3
        ? +((weightChange / (weightSpanDays / 7)).toFixed(2)) : null);

    // ── Scientific projection (dynamic adaptive model) ─────────
    // Calorie variability (coefficient of variation)
    const calorieStdDev       = calcStdDev(calDays);
    const calorieVariabilityCV = (avg && avg > 0) ? calorieStdDev / avg : 0;

    // Weighted avg calories: 70% last 14 days, 30% older
    let weightedAvgCal = avg;
    if (calDays.length > 14) {
      const last14 = calDays.slice(-14);
      const older  = calDays.slice(0, -14);
      weightedAvgCal = (last14.reduce((a,b)=>a+b,0)/last14.length) * 0.7
                     + (older.reduce((a,b)=>a+b,0)/older.length)   * 0.3;
    }

    // Dynamic TDEE: prefer wizard-calculated value, then Mifflin-St Jeor, then target_calories
    let tdee = null;
    let tdeeSource = 'wizard';
    if (profile?.tdee) {
      tdee = profile.tdee;
      tdeeSource = 'wizard';
    } else if (profile?.weight && profile?.height && profile?.age) {
      const bmr = profile.gender === 'female'
        ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161
        : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
      tdee = bmr * 1.55;
      tdeeSource = 'estimated';
    }
    if (!tdee && target) { tdee = target; tdeeSource = 'target'; }

    // ── TDEE efectivo: calibrar con la realidad del peso ────────
    // Si tenemos >=14 días con peso registrado, calculamos el TDEE real que
    // explicaría el cambio de peso observado. Esto corrige sobreestimaciones
    // del TDEE teórico (que puede ignorar adaptación metabólica, subregistro
    // calórico, errores de báscula, etc.)
    //
    // Fórmula: TDEE_efectivo = avg_cal - (kg_change × 7700 / span_days)
    //   Si el peso sube con "déficit teórico", el TDEE real era menor.
    //   Si el peso baja más de lo esperado, el TDEE real era mayor.
    //
    // Usamos el cambio smoothed (no el raw) porque elimina ruido de agua/sal.
    let tdeeEffective = tdee;
    let tdeeCalibrated = false;
    if (smoothedChange != null && weightSpanDays >= 14 && weightedAvgCal && tdee) {
      const realDailyDelta = (smoothedChange * 7700) / weightSpanDays;
      // TDEE que explicaría el cambio observado (comiendo weightedAvgCal)
      const inferredTdee = weightedAvgCal - realDailyDelta;
      // Blend: 70% inferido (más real), 30% teórico (estabilidad con pocos datos)
      // Pero capped para no dar valores absurdos si hay datos raros
      const blended = inferredTdee * 0.7 + tdee * 0.3;
      // Cap: no más de ±30% del teórico para evitar outliers
      tdeeEffective = Math.max(tdee * 0.7, Math.min(tdee * 1.3, blended));
      tdeeCalibrated = true;
    }

    // Adherence rate: registered days / total period days
    const adherenceRate    = calDays.length / days;
    const dailyDeficitTheo = (tdeeEffective && weightedAvgCal) ? tdeeEffective - weightedAvgCal : null;
    const dailyDeficitEff  = dailyDeficitTheo ? dailyDeficitTheo * adherenceRate : null;

    // Metabolic adaptation factor based on weight lost so far
    const metabolicAdaptFactor = (startWeight && currentWeight && startWeight > 0)
      ? Math.max(0.75, 1 - ((startWeight - currentWeight) / startWeight) * 0.15)
      : 1.0;

    // Project 3 scenarios + uncertainty bands
    let scenarios = null, plateauPrediction = { will_plateau: false };
    let weeklyRateRealistic = null, daysToGoalRealistic = null;
    let goalWeight = null;
    try { goalWeight = profile?.goal_weight || null; } catch {}

    if (currentWeight !== null && dailyDeficitTheo !== null) {
      const r30 = projectWeightScenario(currentWeight, dailyDeficitTheo, adherenceRate, 30);
      const r60 = projectWeightScenario(currentWeight, dailyDeficitTheo, adherenceRate, 60);
      const r90 = projectWeightScenario(currentWeight, dailyDeficitTheo, adherenceRate, 90);
      const b30 = calcUncertaintyBands(r30, 30, calorieVariabilityCV, adherenceRate);
      const b60 = calcUncertaintyBands(r60, 60, calorieVariabilityCV, adherenceRate);
      const b90 = calcUncertaintyBands(r90, 90, calorieVariabilityCV, adherenceRate);

      scenarios = {
        optimistic:   { '30d': b30.optimistic,   '60d': b60.optimistic,   '90d': b90.optimistic   },
        realistic:    { '30d': b30.realistic,     '60d': b60.realistic,     '90d': b90.realistic     },
        conservative: { '30d': b30.conservative, '60d': b60.conservative, '90d': b90.conservative },
      };

      plateauPrediction   = calcPlateauPrediction(adherenceRate);
      weeklyRateRealistic = +((r30 - currentWeight) / (30 / 7)).toFixed(2);

      const lossIn30 = currentWeight - r30;
      if (goalWeight && lossIn30 > 0 && currentWeight > goalWeight) {
        daysToGoalRealistic = Math.min(730, Math.round((currentWeight - goalWeight) * (30 / lossIn30)));
      } else if (goalWeight && lossIn30 <= 0 && currentWeight > goalWeight) {
        daysToGoalRealistic = 730; // surplus or no progress — cap at 2 years
      }
    }

    // Confidence + data quality score
    const wPoints = weightVals.length;
    const dPoints = calDays.length;
    const confidence = (wPoints > 14 && dPoints > 20) ? 'high'
      : (wPoints >= 7 || dPoints >= 10) ? 'medium' : 'low';
    const dataQualityScore = +Math.min(1,
      (calDays.length / days) * 0.5 + (weightVals.length / days) * 0.5
    ).toFixed(2);

    // ── Streak in period ───────────────────────────────────────
    const dates = daily.map(d => d.date);
    let longestStreak = 0, curStreak = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) { curStreak = 1; }
      else {
        const prev = new Date(dates[i-1] + 'T12:00:00Z');
        const curr = new Date(dates[i]   + 'T12:00:00Z');
        if ((curr - prev) / 86400000 === 1) curStreak++;
        else curStreak = 1;
      }
      longestStreak = Math.max(longestStreak, curStreak);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let currentStreak = 0;
    if (dates.length > 0) {
      const last = dates[dates.length - 1];
      if (last === todayStr || last === yesterStr) {
        let check = last;
        for (let i = dates.length - 1; i >= 0; i--) {
          if (dates[i] === check) {
            currentStreak++;
            const d = new Date(check + 'T12:00:00Z');
            d.setUTCDate(d.getUTCDate() - 1);
            check = d.toISOString().split('T')[0];
          } else break;
        }
      }
    }

    // ── Weekday vs Weekend (Pro) ──────────────────────────────
    let weekdayWeekend = null;
    try {
      const wd = [], we = [];
      for (const d of daily) {
        if (d.calories <= 0) continue;
        const dow = new Date(d.date + 'T12:00:00Z').getDay();
        (dow === 0 || dow === 6 ? we : wd).push(d.calories);
      }
      if (wd.length >= 2 && we.length >= 2) {
        const wdAvg = Math.round(wd.reduce((a,b) => a+b, 0) / wd.length);
        const weAvg = Math.round(we.reduce((a,b) => a+b, 0) / we.length);
        const wdOnTarget = target ? wd.filter(c => Math.abs(c - target) <= ADHERENCE_TOLERANCE).length : 0;
        const weOnTarget = target ? we.filter(c => Math.abs(c - target) <= ADHERENCE_TOLERANCE).length : 0;
        const extraPerWeekend = Math.max(0, weAvg - wdAvg) * 2; // 2 dias de finde
        const kgImpactMonthly = +(extraPerWeekend * 4.3 / 7700).toFixed(2); // 7700 kcal = 1 kg

        weekdayWeekend = {
          weekday: { avg: wdAvg, days: wd.length, on_target: wdOnTarget, adherence_pct: Math.round(wdOnTarget / wd.length * 100) },
          weekend: { avg: weAvg, days: we.length, on_target: weOnTarget, adherence_pct: Math.round(weOnTarget / we.length * 100) },
          extra_kcal_weekly: extraPerWeekend,
          kg_impact_monthly: kgImpactMonthly,
        };
      }
    } catch {}

    // ── Macro gaps (Pro) — enfoque accionable en gramos ──────────
    let macroGaps = null;
    try {
      const tgtProt  = profile?.target_protein || 0;
      const tgtCarbs = profile?.target_carbs   || 0;
      const tgtFat   = profile?.target_fat     || 0;

      const avgDailyProt  = calDays.length ? Math.round(daily.reduce((s,d) => s + (d.protein || 0), 0) / calDays.length) : 0;
      const avgDailyCarbs = calDays.length ? Math.round(daily.reduce((s,d) => s + (d.carbs   || 0), 0) / calDays.length) : 0;
      const avgDailyFat   = calDays.length ? Math.round(daily.reduce((s,d) => s + (d.fat     || 0), 0) / calDays.length) : 0;

      function analyzeGap(macroName, avgDaily, target) {
        if (!target) return { macro: macroName, status: 'no_target' };
        const diff = avgDaily - target;
        const pct  = Math.round((diff / target) * 100);
        const status = Math.abs(pct) <= 10 ? 'on_target' : diff < 0 ? 'deficit' : 'excess';
        return {
          macro: macroName,
          avg_daily: avgDaily,
          target,
          diff_g: Math.round(Math.abs(diff)),
          pct,
          status,
        };
      }

      macroGaps = {
        protein: analyzeGap('protein', avgDailyProt, tgtProt),
        carbs:   analyzeGap('carbs',   avgDailyCarbs, tgtCarbs),
        fat:     analyzeGap('fat',     avgDailyFat,   tgtFat),
      };
    } catch {}

    return jsonResponse({
      period,
      days_with_data: calDays.length,
      total_days: days,

      calories: {
        avg, min: minCal, max: maxCal,
        days_in_target: daysInTarget, days_over: daysOver, days_under: daysUnder,
        adherence_pct: adherencePct,
        best_day_of_week: bestDay,
        worst_day_of_week: worstDay, worst_day_avg: worstDayAvg,
        trend, trend_pct: trendPct,
      },

      meals: {
        breakfast_avg_pct: mealPct['breakfast'] || 0,
        lunch_avg_pct:     mealPct['lunch']     || 0,
        dinner_avg_pct:    mealPct['dinner']    || 0,
        snacks_avg_pct:    mealPct['snack']     || 0,
        other_avg_pct:     mealPct['other']     || 0,
        most_calories_meal: mostCalMeal,
      },

      weight: {
        start: startWeight, current: currentWeight, change: weightChange,
        trend_per_week: trendPerWeek, data_points: wPoints,
        // Peso ajustado (Hacker's Diet EMA) — elimina ruido de agua/sal
        smoothed_start: smoothedStart,
        smoothed_current: smoothedCurrent,
        smoothed_change: smoothedChange,
      },

      projection: {
        model: 'dynamic-adaptive-v2',
        daily_deficit_theoretical: dailyDeficitTheo ? Math.round(dailyDeficitTheo) : null,
        daily_deficit_effective:   dailyDeficitEff  ? Math.round(dailyDeficitEff)  : null,
        adherence_rate:            +adherenceRate.toFixed(2),
        calorie_variability_cv:    +calorieVariabilityCV.toFixed(2),
        metabolic_adaptation_factor: +metabolicAdaptFactor.toFixed(2),
        // TDEE: teórico (wizard/Mifflin) vs efectivo (calibrado con realidad)
        tdee_theoretical:   tdee ? Math.round(tdee) : null,
        tdee_effective:     tdeeEffective ? Math.round(tdeeEffective) : null,
        tdee_calibrated:    tdeeCalibrated,
        tdee_source:        tdeeSource,
        scenarios,
        plateau_prediction: plateauPrediction,
        weekly_rate_realistic: weeklyRateRealistic,
        days_to_goal_realistic: daysToGoalRealistic,
        goal_weight: goalWeight,
        confidence,
        data_quality_score: dataQualityScore,
      },

      streaks: {
        longest_in_period: longestStreak,
        current: currentStreak,
      },

      top_foods: topFoods || [],
      daily_data: daily,

      // Nuevas secciones Pro
      weekday_weekend: weekdayWeekend,
      macro_gaps: macroGaps,
    });
  }

  return errorResponse('Not found', 404);
}
