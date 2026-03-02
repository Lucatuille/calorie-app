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

    const { results: entries } = await env.DB.prepare(
      `SELECT * FROM entries WHERE user_id = ?
       AND date >= date('now', '-30 days') ORDER BY date ASC`
    ).bind(user.userId).all();

    const { results: streakRows } = await env.DB.prepare(
      `SELECT date FROM entries WHERE user_id = ?
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
      ? Math.round((calories.filter(c => Math.abs(c - targetCalories) <= 200).length / calories.length) * 100)
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

  // GET /api/progress/chart
  if (path === '/api/progress/chart' && request.method === 'GET') {
    const url  = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const { results } = await env.DB.prepare(
      `SELECT date, calories, weight, protein, carbs, fat
       FROM entries WHERE user_id = ?
       AND date >= date('now', '-${days} days')
       ORDER BY date ASC`
    ).bind(user.userId).all();
    return jsonResponse(results);
  }

  return errorResponse('Not found', 404);
}
