// ============================================================
//  PROGRESS ROUTES — /api/progress
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

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
      ? Math.round((calories.filter(c => Math.abs(c - targetCalories) <= 250).length / calories.length) * 100)
      : null;

    // Weekly comparison
    const weekAgoStr     = new Date(Date.now() - 7  * 86400000).toISOString().split('T')[0];
    const twoWeeksAgoStr = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
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
    const url  = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const { results } = await env.DB.prepare(
      `SELECT date,
         SUM(calories) AS calories, MAX(weight) AS weight,
         SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
       FROM entries WHERE user_id = ?
       AND date >= date('now', '-${days} days')
       GROUP BY date ORDER BY date ASC`
    ).bind(user.userId).all();
    return jsonResponse(results);
  }

  // GET /api/progress/advanced
  if (path === '/api/progress/advanced' && request.method === 'GET') {
    const url    = new URL(request.url);
    const period = url.searchParams.get('period') || 'month';
    const days   = period === 'week' ? 7 : period === '90days' ? 90 : 30;

    const profile = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first();

    // Daily totals for the period
    const { results: daily } = await env.DB.prepare(
      `SELECT date,
         SUM(calories) AS calories, SUM(protein) AS protein,
         SUM(carbs) AS carbs, SUM(fat) AS fat, MAX(weight) AS weight
       FROM entries WHERE user_id = ?
       AND date >= date('now', '-${days} days')
       GROUP BY date ORDER BY date ASC`
    ).bind(user.userId).all();

    if (!daily.length) {
      return jsonResponse({ period, days_with_data: 0, total_days: days });
    }

    // Meal type breakdown
    const { results: mealRows } = await env.DB.prepare(
      `SELECT meal_type, SUM(calories) AS total_cal
       FROM entries WHERE user_id = ?
       AND date >= date('now', '-${days} days')
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
         AND date >= date('now', '-${days} days')
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

    const daysInTarget = target ? calDays.filter(c => Math.abs(c-target) <= 250).length : 0;
    const daysOver     = target ? calDays.filter(c => c > target + 250).length : 0;
    const daysUnder    = target ? calDays.filter(c => c < target - 250).length : 0;
    const adherencePct = (target && calDays.length)
      ? Math.round(daysInTarget / calDays.length * 100) : null;

    // Calorie trend: first half vs second half
    const half = Math.floor(calDays.length / 2);
    let trend = 'stable', trendPct = 0;
    if (half >= 2) {
      const firstAvg  = calDays.slice(0, half).reduce((a,b)=>a+b,0) / half;
      const secondAvg = calDays.slice(half).reduce((a,b)=>a+b,0) / (calDays.length - half);
      trendPct = Math.round((secondAvg - firstAvg) / firstAvg * 100);
      if      (trendPct < -5) trend = 'improving';
      else if (trendPct >  5) trend = 'worsening';
    }

    const bestDay     = dowStats.length ? dowStats[0].day_name : null;
    const worstDay    = dowStats.length ? dowStats[dowStats.length - 1].day_name : null;
    const worstDayAvg = dowStats.length ? Math.round(dowStats[dowStats.length - 1].avg_cal) : null;

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

    // ── Linear regression on weight ────────────────────────────
    let slopeKgPerDay = null;
    if (weightVals.length >= 5) {
      const n = weightVals.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i; sumY += weightVals[i];
        sumXY += i * weightVals[i]; sumX2 += i * i;
      }
      const denom = n * sumX2 - sumX * sumX;
      if (denom !== 0) slopeKgPerDay = (n * sumXY - sumX * sumY) / denom;
    }

    // ── Caloric deficit projection ─────────────────────────────
    let tdee = target;
    if (!tdee && profile?.weight && profile?.height && profile?.age) {
      const bmr = profile.gender === 'female'
        ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161
        : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
      tdee = Math.round(bmr * 1.55);
    }
    const avgDeficit       = (tdee && avg) ? tdee - avg : null;
    const deficitKgPerDay  = avgDeficit ? avgDeficit / 7700 : null;

    // ── Combine regression + caloric deficit ───────────────────
    let dailyRate = null;
    if (slopeKgPerDay !== null && deficitKgPerDay !== null) {
      dailyRate = 0.7 * slopeKgPerDay + 0.3 * deficitKgPerDay;
    } else if (slopeKgPerDay !== null) {
      dailyRate = slopeKgPerDay;
    } else if (deficitKgPerDay !== null) {
      dailyRate = deficitKgPerDay;
    }

    // Safety cap: ±1.5 kg/week
    let weeklyRate = null;
    if (dailyRate !== null) {
      const cap = 1.5 / 7;
      dailyRate  = Math.max(-cap, Math.min(cap, dailyRate));
      weeklyRate = +(dailyRate * 7).toFixed(2);
    }

    // ── Projections ────────────────────────────────────────────
    let proj30 = null, proj60 = null, proj90 = null, daysToGoal = null;
    if (currentWeight !== null && dailyRate !== null) {
      proj30 = +(currentWeight + dailyRate * 30).toFixed(1);
      proj60 = +(currentWeight + dailyRate * 60).toFixed(1);
      proj90 = +(currentWeight + dailyRate * 90).toFixed(1);
    }
    let goalWeight = null;
    try { goalWeight = profile?.goal_weight || null; } catch {}
    if (goalWeight && currentWeight !== null && dailyRate) {
      const d = (goalWeight - currentWeight) / dailyRate;
      daysToGoal = d > 0 ? Math.round(d) : null;
    }

    // Confidence
    const wPoints = weightVals.length;
    const dPoints = calDays.length;
    const confidence = (wPoints > 14 && dPoints > 20) ? 'high'
      : (wPoints >= 7 || dPoints >= 10) ? 'medium' : 'low';

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
        daily_deficit_avg: avgDeficit ? Math.round(avgDeficit) : null,
        weekly_loss_rate: weeklyRate,
        projection_30d: proj30,
        projection_60d: proj60,
        projection_90d: proj90,
        days_to_goal: daysToGoal,
        goal_weight: goalWeight,
        confidence,
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
