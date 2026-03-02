// ============================================================
//  ENTRIES ROUTES — /api/entries
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

export async function handleEntries(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  // POST /api/entries — save a daily entry
  if (path === '/api/entries' && request.method === 'POST') {
    const { calories, protein, carbs, fat, weight, notes, date } = await request.json();

    if (!calories) return errorResponse('Las calorías son obligatorias');

    const entryDate = date || new Date().toISOString().split('T')[0];

    // Upsert: if entry for this date exists, update it
    const existing = await env.DB.prepare(
      'SELECT id FROM entries WHERE user_id = ? AND date = ?'
    ).bind(user.userId, entryDate).first();

    if (existing) {
      await env.DB.prepare(
        `UPDATE entries SET calories=?, protein=?, carbs=?, fat=?, weight=?, notes=?
         WHERE id=?`
      ).bind(calories, protein||null, carbs||null, fat||null, weight||null, notes||null, existing.id).run();

      return jsonResponse({ message: 'Entrada actualizada', date: entryDate });
    }

    await env.DB.prepare(
      `INSERT INTO entries (user_id, calories, protein, carbs, fat, weight, notes, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.userId, calories, protein||null, carbs||null, fat||null, weight||null, notes||null, entryDate).run();

    return jsonResponse({ message: 'Entrada guardada', date: entryDate }, 201);
  }

  // GET /api/entries — get last 30 entries
  if (path === '/api/entries' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM entries WHERE user_id = ?
       ORDER BY date DESC LIMIT 30`
    ).bind(user.userId).all();

    return jsonResponse(results);
  }

  // GET /api/entries/today
  if (path === '/api/entries/today' && request.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const entry = await env.DB.prepare(
      'SELECT * FROM entries WHERE user_id = ? AND date = ?'
    ).bind(user.userId, today).first();

    return jsonResponse(entry || null);
  }

  return errorResponse('Not found', 404);
}
