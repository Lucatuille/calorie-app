// ============================================================
//  ADMIN ROUTES — /api/admin/*  (requires is_admin = 1)
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

async function requireAdmin(request, env) {
  const user = await authenticate(request, env);
  if (!user || !user.is_admin) return null;
  return user;
}

// ── Helpers ────────────────────────────────────────────────

function relativeTime(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

function computeLongestStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort();
  let longest = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00Z');
    const curr = new Date(sorted[i]     + 'T12:00:00Z');
    if ((curr - prev) / 86400000 === 1) { cur++; longest = Math.max(longest, cur); }
    else cur = 1;
  }
  return longest;
}

export async function handleAdmin(request, env, path) {
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('Forbidden', 403);

  // ── GET /api/admin/overview ─────────────────────────────
  if (path === '/api/admin/overview' && request.method === 'GET') {

    const [
      { total_users },
      { active_today },
      { active_week },
      { new_7d },
      { total_entries },
      { entries_today },
      avgRow,
      { results: dailyActivity },
      { results: alertRows },
      { results: recentDates },
    ] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as total_users FROM users').first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as active_today FROM entries WHERE date = date('now')`).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as active_week FROM entries WHERE date >= date('now', '-7 days')`).first(),
      env.DB.prepare(`SELECT COUNT(*) as new_7d FROM users WHERE created_at >= datetime('now', '-7 days')`).first(),
      env.DB.prepare('SELECT COUNT(*) as total_entries FROM entries').first(),
      env.DB.prepare(`SELECT COUNT(*) as entries_today FROM entries WHERE date = date('now')`).first(),
      env.DB.prepare(`
        SELECT ROUND(AVG(daily_cal), 0) as avg_cal FROM (
          SELECT user_id, date, SUM(calories) as daily_cal FROM entries
          WHERE date >= date('now', '-7 days') AND date < date('now')
          GROUP BY user_id, date
        )
      `).first(),
      env.DB.prepare(`
        SELECT date,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as entry_count
        FROM entries
        WHERE date >= date('now', '-30 days')
        GROUP BY date ORDER BY date ASC
      `).all(),
      env.DB.prepare(`
        SELECT u.id, u.name, MAX(e.date) as last_entry
        FROM users u LEFT JOIN entries e ON u.id = e.user_id
        GROUP BY u.id
        HAVING last_entry IS NULL OR last_entry < date('now', '-7 days')
        ORDER BY last_entry ASC
      `).all(),
      env.DB.prepare(`
        SELECT user_id, date FROM entries
        WHERE date >= date('now', '-90 days')
        ORDER BY user_id, date ASC
      `).all(),
    ]);

    // Compute max streak per user
    const datesByUser = {};
    for (const r of recentDates) {
      if (!datesByUser[r.user_id]) datesByUser[r.user_id] = [];
      datesByUser[r.user_id].push(r.date);
    }
    let maxStreakDays = 0, maxStreakUser = null;
    for (const [uid, dates] of Object.entries(datesByUser)) {
      const s = computeLongestStreak(dates);
      if (s > maxStreakDays) { maxStreakDays = s; maxStreakUser = uid; }
    }
    // Get name for max streak user
    let maxStreakName = null;
    if (maxStreakUser) {
      const u = await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(maxStreakUser).first();
      maxStreakName = u?.name || null;
    }

    const alerts = alertRows.map(r => ({
      user_id: r.id,
      name: r.name,
      last_entry: r.last_entry,
      days_inactive: r.last_entry
        ? Math.floor((Date.now() - new Date(r.last_entry).getTime()) / 86400000)
        : null,
    }));

    return jsonResponse({
      users: {
        total: total_users,
        active_today,
        active_week,
        new_last_7d: new_7d,
      },
      platform: {
        total_entries,
        entries_today,
        avg_calories_7d: avgRow?.avg_cal || null,
        max_streak: maxStreakDays > 0 ? { user: maxStreakName, days: maxStreakDays } : null,
      },
      daily_activity: dailyActivity,
      alerts,
    });
  }

  // ── GET /api/admin/users ────────────────────────────────
  if (path === '/api/admin/users' && request.method === 'GET') {

    const [
      { results: users },
      { results: stats7d },
      { results: topFoods },
      { results: supps },
    ] = await Promise.all([
      env.DB.prepare(`
        SELECT u.id, u.name, u.email, u.created_at, u.weight, u.goal_weight,
               u.target_calories, u.tdee,
               MAX(e.date) as last_entry,
               COUNT(DISTINCT e.date) as total_days
        FROM users u LEFT JOIN entries e ON u.id = e.user_id
        GROUP BY u.id ORDER BY last_entry DESC
      `).all(),
      env.DB.prepare(`
        SELECT user_id,
               COUNT(DISTINCT date) as days_7d,
               ROUND(AVG(daily_cal), 0) as avg_cal_7d
        FROM (
          SELECT user_id, date, SUM(calories) as daily_cal
          FROM entries
          WHERE date >= date('now', '-7 days') AND date < date('now')
          GROUP BY user_id, date
        )
        GROUP BY user_id
      `).all(),
      env.DB.prepare(`
        SELECT user_id, name, COUNT(*) as cnt
        FROM entries
        WHERE name IS NOT NULL AND name != '' AND LENGTH(name) > 1
        GROUP BY user_id, name
        ORDER BY user_id, cnt DESC
      `).all(),
      env.DB.prepare(`
        SELECT user_id, GROUP_CONCAT(name, ', ') as supplements
        FROM user_supplements
        GROUP BY user_id
      `).all(),
    ]);

    // Map stats7d, topFoods, supps by user_id
    const stats7dMap = Object.fromEntries(stats7d.map(r => [r.user_id, r]));
    const suppsMap   = Object.fromEntries(supps.map(r => [r.user_id, r.supplements]));

    // Top food per user (first row per user_id since ordered by cnt DESC)
    const topFoodMap = {};
    for (const r of topFoods) {
      if (!topFoodMap[r.user_id]) topFoodMap[r.user_id] = { name: r.name, count: r.cnt };
    }

    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      created_at: u.created_at,
      weight: u.weight,
      goal_weight: u.goal_weight,
      target_calories: u.target_calories,
      tdee: u.tdee,
      last_entry: u.last_entry,
      last_entry_relative: relativeTime(u.last_entry ? u.last_entry + 'T12:00:00Z' : null),
      total_days: u.total_days,
      days_7d: stats7dMap[u.id]?.days_7d || 0,
      avg_cal_7d: stats7dMap[u.id]?.avg_cal_7d || null,
      top_food: topFoodMap[u.id] || null,
      supplements: suppsMap[u.id] || null,
    }));

    return jsonResponse(result);
  }

  // ── GET /api/admin/engagement ───────────────────────────
  if (path === '/api/admin/engagement' && request.method === 'GET') {

    const [
      { results: mealTypes },
      { results: topFoods },
      { results: heatmapData },
      { results: cohortUsers },
    ] = await Promise.all([
      env.DB.prepare(`
        SELECT meal_type, SUM(calories) as total_cal, COUNT(*) as entry_count
        FROM entries GROUP BY meal_type ORDER BY total_cal DESC
      `).all(),
      env.DB.prepare(`
        SELECT name, COUNT(*) as count
        FROM entries
        WHERE name IS NOT NULL AND name != '' AND LENGTH(name) > 2
        GROUP BY name ORDER BY count DESC LIMIT 10
      `).all(),
      env.DB.prepare(`
        SELECT date, COUNT(DISTINCT user_id) as active_users
        FROM entries
        WHERE date >= date('now', '-28 days')
        GROUP BY date ORDER BY date ASC
      `).all(),
      env.DB.prepare(`
        SELECT id, created_at FROM users ORDER BY created_at DESC
      `).all(),
    ]);

    // Cohort retention: group users by registration week
    const cohorts = {};
    for (const u of cohortUsers) {
      const d = new Date(u.created_at);
      const weekStart = new Date(d);
      weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1); // Monday
      const key = weekStart.toISOString().split('T')[0];
      if (!cohorts[key]) cohorts[key] = [];
      cohorts[key].push({ id: u.id, created_at: u.created_at });
    }

    // For each cohort, check activity at D+7, D+14, D+30
    const cohortRows = [];
    for (const [week, users] of Object.entries(cohorts).sort().reverse().slice(0, 6)) {
      const userIds = users.map(u => u.id);
      if (!userIds.length) continue;
      const regDate = new Date(users[0].created_at);
      const d7  = new Date(regDate.getTime() + 7  * 86400000).toISOString().split('T')[0];
      const d14 = new Date(regDate.getTime() + 14 * 86400000).toISOString().split('T')[0];
      const d30 = new Date(regDate.getTime() + 30 * 86400000).toISOString().split('T')[0];

      const placeholders = userIds.map(() => '?').join(',');
      const [a7, a14, a30] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as n FROM entries WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?`).bind(...userIds, regDate.toISOString().split('T')[0], d7).first(),
        env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as n FROM entries WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?`).bind(...userIds, regDate.toISOString().split('T')[0], d14).first(),
        new Date() > new Date(d30)
          ? env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as n FROM entries WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?`).bind(...userIds, regDate.toISOString().split('T')[0], d30).first()
          : Promise.resolve(null),
      ]);

      cohortRows.push({
        week,
        total: userIds.length,
        d7_pct:  a7  ? Math.round(a7.n  / userIds.length * 100) : null,
        d14_pct: a14 ? Math.round(a14.n / userIds.length * 100) : null,
        d30_pct: a30 ? Math.round(a30.n / userIds.length * 100) : null,
      });
    }

    // Meal type total for pct
    const totalCal = mealTypes.reduce((a, m) => a + m.total_cal, 0);
    const mealDist = mealTypes.map(m => ({
      meal_type: m.meal_type,
      total_cal: m.total_cal,
      entry_count: m.entry_count,
      pct: totalCal ? Math.round(m.total_cal / totalCal * 100) : 0,
    }));

    return jsonResponse({
      meal_distribution: mealDist,
      top_foods: topFoods,
      heatmap: heatmapData,
      cohort_retention: cohortRows,
    });
  }

  // ── GET /api/admin/ai-stats ─────────────────────────────
  if (path === '/api/admin/ai-stats' && request.method === 'GET') {
    // Pricing: claude-haiku-4-5 — $0.80/MTok input, $4.00/MTok output
    const INPUT_PRICE  = 0.80  / 1_000_000;
    const OUTPUT_PRICE = 4.00  / 1_000_000;

    const [
      { results: allUsers },
      { results: usersWithEntries },
      { results: usersWithSupps },
      { results: usersWithTDEE },
      aiTotal,
      aiWeek,
      aiMonth,
      { results: aiPerUser },
      { results: aiMonthlyTotals },
    ] = await Promise.all([
      env.DB.prepare('SELECT id, name FROM users').all(),
      env.DB.prepare('SELECT DISTINCT user_id FROM entries').all(),
      env.DB.prepare('SELECT DISTINCT user_id FROM user_supplements').all(),
      env.DB.prepare('SELECT id FROM users WHERE tdee IS NOT NULL').all(),
      // Total AI calls + tokens
      env.DB.prepare(`
        SELECT COUNT(*) as calls, SUM(input_tokens) as input, SUM(output_tokens) as output
        FROM ai_usage_logs
      `).first(),
      // This week
      env.DB.prepare(`
        SELECT COUNT(*) as calls, SUM(input_tokens) as input, SUM(output_tokens) as output
        FROM ai_usage_logs WHERE created_at >= datetime('now', '-7 days')
      `).first(),
      // This month (30d)
      env.DB.prepare(`
        SELECT COUNT(*) as calls, SUM(input_tokens) as input, SUM(output_tokens) as output
        FROM ai_usage_logs WHERE created_at >= datetime('now', '-30 days')
      `).first(),
      // Per user
      env.DB.prepare(`
        SELECT user_id, COUNT(*) as calls
        FROM ai_usage_logs GROUP BY user_id
      `).all(),
      // Monthly breakdown (last 6 months)
      env.DB.prepare(`
        SELECT strftime('%Y-%m', created_at) as month,
               COUNT(*) as calls,
               SUM(input_tokens) as input, SUM(output_tokens) as output
        FROM ai_usage_logs
        GROUP BY month ORDER BY month DESC LIMIT 6
      `).all(),
    ]);

    const calcCost = (inp, out) => +(((inp || 0) * INPUT_PRICE + (out || 0) * OUTPUT_PRICE).toFixed(4));

    const totalUsers  = allUsers.length;
    const withEntries = new Set(usersWithEntries.map(r => r.user_id));
    const withSupps   = new Set(usersWithSupps.map(r => r.user_id));
    const withTDEE    = new Set(usersWithTDEE.map(r => r.id));
    const withAI      = new Set(aiPerUser.map(r => r.user_id));

    const features = [
      { feature: 'Registro manual',      users: withEntries.size, total: totalUsers },
      { feature: 'Análisis por foto',    users: withAI.size,      total: totalUsers },
      { feature: 'Calculadora TDEE',     users: withTDEE.size,    total: totalUsers },
      { feature: 'Suplementos',          users: withSupps.size,   total: totalUsers },
    ];

    const totalCalls = aiTotal?.calls || 0;
    const costTotal  = calcCost(aiTotal?.input, aiTotal?.output);
    const costMonth  = calcCost(aiMonth?.input, aiMonth?.output);
    const costPerPhoto = totalCalls > 0 ? +((costTotal / totalCalls).toFixed(4)) : null;

    return jsonResponse({
      photos: {
        total:       totalCalls,
        this_week:   aiWeek?.calls  || 0,
        this_month:  aiMonth?.calls || 0,
        avg_per_user: totalUsers > 0 ? +((totalCalls / totalUsers).toFixed(1)) : 0,
      },
      cost: {
        total:     costTotal,
        this_month: costMonth,
        per_photo: costPerPhoto,
      },
      monthly_breakdown: aiMonthlyTotals.map(r => ({
        month: r.month,
        calls: r.calls,
        cost:  calcCost(r.input, r.output),
      })),
      features,
    });
  }

  return errorResponse('Not found', 404);
}
