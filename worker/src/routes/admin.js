// ============================================================
//  ADMIN ROUTES — /api/admin/*  (requires is_admin = 1)
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';
import { LEVEL_CONFIG } from '../utils/levels.js';

async function requireAdmin(request, env) {
  const user = await authenticate(request, env);
  if (!user || !user.is_admin) return null;
  // Verificar en BD — el JWT puede estar desactualizado si el rol fue revocado
  const row = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(user.userId).first();
  if (!row?.is_admin) return null;
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
      streakRow,
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
        WITH dated AS (
          SELECT DISTINCT user_id, date FROM entries
          WHERE date >= date('now', '-90 days')
        ),
        ranked AS (
          SELECT user_id, date,
            julianday(date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date) AS grp
          FROM dated
        ),
        streaks AS (
          SELECT user_id, COUNT(*) as streak_len FROM ranked GROUP BY user_id, grp
        ),
        best AS (
          SELECT user_id, MAX(streak_len) as max_streak
          FROM streaks GROUP BY user_id ORDER BY max_streak DESC LIMIT 1
        )
        SELECT u.name, best.user_id, best.max_streak
        FROM best JOIN users u ON u.id = best.user_id
      `).first(),
    ]);

    const maxStreakDays = streakRow?.max_streak || 0;
    const maxStreakName = streakRow?.name || null;

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
               u.target_calories, u.tdee, u.access_level,
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
          AND date >= date('now', '-90 days')
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
      access_level: u.access_level ?? 3,
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
      { results: cohortData },
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
        WITH cohort_users AS (
          SELECT id, created_at,
            date(created_at, '-' || ((strftime('%w', created_at) + 6) % 7) || ' days') as cohort_week
          FROM users
        ),
        top_cohorts AS (
          SELECT cohort_week FROM cohort_users
          GROUP BY cohort_week ORDER BY cohort_week DESC LIMIT 6
        ),
        filtered_users AS (
          SELECT cu.id, cu.created_at, cu.cohort_week
          FROM cohort_users cu
          WHERE cu.cohort_week IN (SELECT cohort_week FROM top_cohorts)
        ),
        user_activity AS (
          SELECT fu.id, fu.cohort_week, fu.created_at,
            MAX(CASE WHEN e.date >= date(fu.created_at) AND e.date <= date(fu.created_at, '+7 days')  THEN 1 ELSE 0 END) as ret_d7,
            MAX(CASE WHEN e.date >= date(fu.created_at) AND e.date <= date(fu.created_at, '+14 days') THEN 1 ELSE 0 END) as ret_d14,
            MAX(CASE WHEN e.date >= date(fu.created_at) AND e.date <= date(fu.created_at, '+30 days') THEN 1 ELSE 0 END) as ret_d30
          FROM filtered_users fu
          LEFT JOIN entries e ON e.user_id = fu.id
          GROUP BY fu.id
        )
        SELECT cohort_week,
          COUNT(*) as total,
          SUM(ret_d7)  as active_d7,
          SUM(ret_d14) as active_d14,
          SUM(ret_d30) as active_d30
        FROM user_activity
        GROUP BY cohort_week ORDER BY cohort_week DESC
      `).all(),
    ]);

    // Cohort retention: map SQL results, mark d30 as null if window hasn't elapsed
    const cohortRows = cohortData.map(r => {
      const d30cutoff = new Date(r.cohort_week + 'T00:00:00Z');
      d30cutoff.setUTCDate(d30cutoff.getUTCDate() + 30);
      return {
        week:    r.cohort_week,
        total:   r.total,
        d7_pct:  r.total > 0 ? Math.round(r.active_d7  / r.total * 100) : null,
        d14_pct: r.total > 0 ? Math.round(r.active_d14 / r.total * 100) : null,
        d30_pct: r.total > 0 && new Date() > d30cutoff ? Math.round(r.active_d30 / r.total * 100) : null,
      };
    });

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
      { results: aiPerUserToday },
      { results: aiPerUserWeek },
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
      // Per user (total calls)
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
      // Per-user: today
      env.DB.prepare(`
        SELECT u.id, u.name, COALESCE(a.count, 0) as today_calls
        FROM users u
        LEFT JOIN ai_usage_logs a ON u.id = a.user_id AND a.date = date('now')
        ORDER BY today_calls DESC
      `).all(),
      // Per-user: this week
      env.DB.prepare(`
        SELECT user_id, SUM(count) as week_calls
        FROM ai_usage_logs
        WHERE date >= date('now', '-7 days')
        GROUP BY user_id
      `).all(),
    ]);

    const calcCost = (inp, out) => +(((inp || 0) * INPUT_PRICE + (out || 0) * OUTPUT_PRICE).toFixed(4));

    const totalUsers  = allUsers.length;

    // Build per-user AI usage breakdown
    const totalByUser = Object.fromEntries(aiPerUser.map(r => [r.user_id, r.calls]));
    const weekByUser  = Object.fromEntries(aiPerUserWeek.map(r => [r.user_id, r.week_calls]));
    const perUserBreakdown = aiPerUserToday
      .filter(r => totalByUser[r.id] > 0 || r.today_calls > 0)
      .map(r => ({
        user_id:    r.id,
        name:       r.name,
        today:      r.today_calls || 0,
        this_week:  weekByUser[r.id] || 0,
        total:      totalByUser[r.id] || 0,
      }))
      .sort((a, b) => b.this_week - a.this_week || b.total - a.total);
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

    // Assistant stats (tabla puede no existir aún si el SQL no se ha ejecutado)
    let assistantStats = { conversations: 0, messages: 0, users: 0, today: 0, this_week: 0, haiku_pct: 0, sonnet_pct: 0 };
    try {
      const [aConvs, aMsgs, aToday, aWeek, aModels] = await Promise.all([
        env.DB.prepare('SELECT COUNT(*) as n FROM assistant_conversations').first(),
        env.DB.prepare('SELECT COUNT(DISTINCT user_id) as u, COUNT(*) as m FROM assistant_messages WHERE role = "user"').first(),
        env.DB.prepare("SELECT COUNT(*) as n FROM assistant_messages WHERE role='user' AND created_at >= date('now')").first(),
        env.DB.prepare("SELECT COUNT(*) as n FROM assistant_messages WHERE role='user' AND created_at >= datetime('now', '-7 days')").first(),
        env.DB.prepare("SELECT model_used, COUNT(*) as n FROM assistant_messages WHERE role='assistant' GROUP BY model_used").all(),
      ]);
      const totalMsgs  = aMsgs?.m || 0;
      const modelRows  = aModels?.results || [];
      const haikuN     = modelRows.find(r => r.model_used?.includes('haiku'))?.n || 0;
      const sonnetN    = modelRows.find(r => r.model_used?.includes('sonnet'))?.n || 0;
      const modelTotal = haikuN + sonnetN;
      assistantStats = {
        conversations: aConvs?.n || 0,
        messages:      totalMsgs,
        users:         aMsgs?.u  || 0,
        today:         aToday?.n || 0,
        this_week:     aWeek?.n  || 0,
        haiku_pct:  modelTotal > 0 ? Math.round(haikuN  / modelTotal * 100) : 0,
        sonnet_pct: modelTotal > 0 ? Math.round(sonnetN / modelTotal * 100) : 0,
      };
    } catch { /* tablas aún no creadas */ }

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
      per_user: perUserBreakdown,
      features,
      assistant: assistantStats,
    });
  }

  // ── GET /api/admin/products ─────────────────────────────
  if (path === '/api/admin/products' && request.method === 'GET') {
    const [total, { results: top }] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as n FROM products_cache').first(),
      env.DB.prepare(`
        SELECT name, brand, scan_count
        FROM products_cache
        ORDER BY scan_count DESC
        LIMIT 10
      `).all(),
    ]);

    return jsonResponse({
      total_products: total?.n || 0,
      top_products: top,
    });
  }

  // ── PUT /api/admin/users/:id/role ───────────────────────
  const roleMatch = path.match(/^\/api\/admin\/users\/(\d+)\/role$/);
  if (roleMatch && request.method === 'PUT') {
    const userId = roleMatch[1];
    const { access_level } = await request.json();
    const validLevels = [0, 1, 2, 3]; // Admin no puede crear otros admins desde el panel
    if (!validLevels.includes(access_level)) {
      return errorResponse('Nivel inválido', 400);
    }
    await env.DB.prepare(
      'UPDATE users SET access_level = ? WHERE id = ?'
    ).bind(access_level, userId).run();
    return jsonResponse({
      success: true,
      user_id: parseInt(userId),
      new_level: access_level,
      level_name: LEVEL_CONFIG[access_level]?.name || 'Unknown',
    });
  }

  return errorResponse('Not found', 404);
}
