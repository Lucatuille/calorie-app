import { authenticate, jsonResponse, errorResponse } from '../utils.js';

export async function handleWeight(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401, request);

  // POST /api/weight — upsert today's weight
  if (path === '/api/weight' && request.method === 'POST') {
    const { weight_kg, date } = await request.json();
    if (!weight_kg || weight_kg < 20 || weight_kg > 300) {
      return errorResponse('Peso inválido (20-300 kg)');
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse('Formato de fecha inválido (YYYY-MM-DD)');
    }
    const entryDate = date || new Date().toISOString().split('T')[0];

    await env.DB.prepare(
      `INSERT INTO weight_logs (user_id, date, weight_kg)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg`
    ).bind(user.userId, entryDate, Math.round(weight_kg * 10) / 10).run();

    return jsonResponse({ date: entryDate, weight_kg: Math.round(weight_kg * 10) / 10 });
  }

  // GET /api/weight/recent — last 30 entries
  if (path === '/api/weight/recent' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT date, weight_kg FROM weight_logs
       WHERE user_id = ? ORDER BY date DESC LIMIT 30`
    ).bind(user.userId).all();

    return jsonResponse(rows.results || []);
  }

  // GET /api/weight/today — today's weight + yesterday for trend
  if (path === '/api/weight/today' && request.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const rows = await env.DB.prepare(
      `SELECT date, weight_kg FROM weight_logs
       WHERE user_id = ? AND date >= date(?, '-1 day')
       ORDER BY date DESC LIMIT 2`
    ).bind(user.userId, today).all();

    const results = rows.results || [];
    const todayEntry = results.find(r => r.date === today);
    const yesterdayEntry = results.find(r => r.date !== today);

    // If no today entry, get last recorded weight as reference
    let lastWeight = null;
    if (!todayEntry) {
      const last = await env.DB.prepare(
        `SELECT weight_kg FROM weight_logs WHERE user_id = ? ORDER BY date DESC LIMIT 1`
      ).bind(user.userId).first();
      lastWeight = last?.weight_kg || null;
    }

    return jsonResponse({
      today: todayEntry?.weight_kg || null,
      yesterday: yesterdayEntry?.weight_kg || null,
      last_recorded: lastWeight,
    });
  }

  return errorResponse('Not found', 404);
}
