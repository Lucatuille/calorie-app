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
    weight -= Math.max(0, adjustedDeficit) / tissueEnergyDensity;
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
    const trendPerWeek  = (weightChange != null && weightEntries.length >= 2)
      ? +((weightChange / (days / 7)).toFixed(2)) : null;

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
    if (profile?.tdee) {
      tdee = profile.tdee;
    } else if (profile?.weight && profile?.height && profile?.age) {
      const bmr = profile.gender === 'female'
        ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161
        : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
      tdee = bmr * 1.55;
    }
    if (!tdee && target) tdee = target;

    // Adherence rate: registered days / total period days
    const adherenceRate    = calDays.length / days;
    const dailyDeficitTheo = (tdee && weightedAvgCal) ? tdee - weightedAvgCal : null;
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
        daysToGoalRealistic = Math.round((currentWeight - goalWeight) * (30 / lossIn30));
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

    return jsonResponse({
      period,
      days_with_data: daily.length,
      total_days: days,

      calories: {
        avg, min: minCal, max: maxCal,
        days_in_target: daysInTarget, days_over: daysOver, days_under: daysUnder,
        adherence_pct: adherencePct,
        best_day_of_week: bestDay,
        worst_day_of_week: worstDay, worst_day_avg: worstDayAvg,
        trend, trend_pct: Math.abs(trendPct),
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
      },

      projection: {
        model: 'dynamic-adaptive-v2',
        daily_deficit_theoretical: dailyDeficitTheo ? Math.round(dailyDeficitTheo) : null,
        daily_deficit_effective:   dailyDeficitEff  ? Math.round(dailyDeficitEff)  : null,
        adherence_rate:            +adherenceRate.toFixed(2),
        calorie_variability_cv:    +calorieVariabilityCV.toFixed(2),
        metabolic_adaptation_factor: +metabolicAdaptFactor.toFixed(2),
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

      daily_data: daily,
    });
  }

  return errorResponse('Not found', 404);
}
