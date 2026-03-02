// ============================================================
//  PROGRESS ROUTES — /api/progress
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

export async function handleProgress(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  // GET /api/progress/summary — weekly + monthly stats
  if (path === '/api/progress/summary' && request.method === 'GET') {
    const profile = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(user.userId).first();

    // Last 30 days of entries
    const { results: entries } = await env.DB.prepare(
      `SELECT * FROM entries WHERE user_id = ?
       AND date >= date('now', '-30 days')
       ORDER BY date ASC`
    ).bind(user.userId).all();

    if (!entries.length) return jsonResponse({ entries: [], summary: null });

    const calories = entries.map(e => e.calories).filter(Boolean);
    const weights  = entries.map(e => e.weight).filter(Boolean);

    const avgCalories   = Math.round(calories.reduce((a,b) => a+b, 0) / calories.length);
    const targetCalories = profile?.target_calories || null;

    // Weight trend (first vs last available weight)
    const weightTrend = weights.length >= 2
      ? +(weights[weights.length-1] - weights[0]).toFixed(1)
      : null;

    // Adherence: days within ±200 kcal of target
    const adherence = targetCalories
      ? Math.round(
          (calories.filter(c => Math.abs(c - targetCalories) <= 200).length / calories.length) * 100
        )
      : null;

    // Last 7 days
    const last7 = entries.slice(-7);
    const avgLast7 = last7.length
      ? Math.round(last7.reduce((a,b) => a + b.calories, 0) / last7.length)
      : null;

    return jsonResponse({
      entries,
      summary: {
        avgCalories,
        avgLast7,
        targetCalories,
        adherence,
        weightTrend,
        totalDaysLogged: entries.length,
        currentWeight: weights[weights.length - 1] || null,
      }
    });
  }

  // GET /api/progress/chart — data formatted for Recharts
  if (path === '/api/progress/chart' && request.method === 'GET') {
    const url    = new URL(request.url);
    const days   = parseInt(url.searchParams.get('days') || '30');

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
