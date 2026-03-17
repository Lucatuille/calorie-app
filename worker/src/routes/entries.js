// ============================================================
//  ENTRIES ROUTES — /api/entries
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

export async function handleEntries(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  // POST /api/entries — insert a new meal entry (no upsert)
  if (path === '/api/entries' && request.method === 'POST') {
    const { calories, protein, carbs, fat, weight, notes, meal_type, name, date } = await request.json();
    if (!calories) return errorResponse('Las calorías son obligatorias');

    const entryDate  = date || new Date().toISOString().split('T')[0];
    const mealType   = meal_type || 'other';

    const { meta } = await env.DB.prepare(
      `INSERT INTO entries (user_id, calories, protein, carbs, fat, weight, notes, meal_type, name, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.userId, calories, protein||null, carbs||null, fat||null,
      weight||null, notes||null, mealType, name||null, entryDate
    ).run();

    const entry = await env.DB.prepare(
      'SELECT * FROM entries WHERE id = ?'
    ).bind(meta.last_row_id).first();

    return jsonResponse(entry, 201);
  }

  // GET /api/entries — list with optional ?limit=N (default 90, max 365)
  if (path === '/api/entries' && request.method === 'GET') {
    const url   = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '90'), 365);
    const { results } = await env.DB.prepare(
      `SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT ?`
    ).bind(user.userId, limit).all();
    return jsonResponse(results);
  }

  // GET /api/entries/today — return all of today's entries as array
  if (path === '/api/entries/today' && request.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const { results } = await env.DB.prepare(
      `SELECT * FROM entries WHERE user_id = ? AND date = ? ORDER BY created_at ASC`
    ).bind(user.userId, today).all();
    return jsonResponse(results);
  }

  // PUT /api/entries/:id — update specific entry
  if (path.match(/^\/api\/entries\/\d+$/) && request.method === 'PUT') {
    const id = parseInt(path.split('/').pop());
    const { calories, protein, carbs, fat, weight, notes, meal_type, name } = await request.json();
    if (!calories) return errorResponse('Las calorías son obligatorias');

    const entry = await env.DB.prepare(
      'SELECT id FROM entries WHERE id = ? AND user_id = ?'
    ).bind(id, user.userId).first();
    if (!entry) return errorResponse('Entrada no encontrada', 404);

    await env.DB.prepare(
      `UPDATE entries SET calories=?, protein=?, carbs=?, fat=?, weight=?, notes=?, meal_type=?, name=? WHERE id=?`
    ).bind(
      calories, protein||null, carbs||null, fat||null, weight||null,
      notes||null, meal_type||'other', name||null, id
    ).run();
    return jsonResponse({ message: 'Entrada actualizada' });
  }

  // DELETE /api/entries/:id
  if (path.match(/^\/api\/entries\/\d+$/) && request.method === 'DELETE') {
    const id = parseInt(path.split('/').pop());

    const entry = await env.DB.prepare(
      'SELECT id FROM entries WHERE id = ? AND user_id = ?'
    ).bind(id, user.userId).first();
    if (!entry) return errorResponse('Entrada no encontrada', 404);

    await env.DB.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').bind(id, user.userId).run();
    return jsonResponse({ message: 'Entrada eliminada' });
  }

  return errorResponse('Not found', 404);
}
