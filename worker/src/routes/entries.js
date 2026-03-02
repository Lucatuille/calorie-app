// ============================================================
//  ENTRIES ROUTES — /api/entries
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

export async function handleEntries(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  // POST /api/entries — save (upsert) a daily entry
  if (path === '/api/entries' && request.method === 'POST') {
    const { calories, protein, carbs, fat, weight, notes, date } = await request.json();
    if (!calories) return errorResponse('Las calorías son obligatorias');

    const entryDate = date || new Date().toISOString().split('T')[0];

    const existing = await env.DB.prepare(
      'SELECT id FROM entries WHERE user_id = ? AND date = ?'
    ).bind(user.userId, entryDate).first();

    if (existing) {
      await env.DB.prepare(
        `UPDATE entries SET calories=?, protein=?, carbs=?, fat=?, weight=?, notes=? WHERE id=?`
      ).bind(calories, protein||null, carbs||null, fat||null, weight||null, notes||null, existing.id).run();
      return jsonResponse({ message: 'Entrada actualizada', date: entryDate });
    }

    await env.DB.prepare(
      `INSERT INTO entries (user_id, calories, protein, carbs, fat, weight, notes, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.userId, calories, protein||null, carbs||null, fat||null, weight||null, notes||null, entryDate).run();

    return jsonResponse({ message: 'Entrada guardada', date: entryDate }, 201);
  }

  // GET /api/entries — list with optional ?limit=N (default 90, max 365)
  if (path === '/api/entries' && request.method === 'GET') {
    const url   = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '90'), 365);
    const { results } = await env.DB.prepare(
      `SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC LIMIT ?`
    ).bind(user.userId, limit).all();
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

  // PUT /api/entries/:id — update specific entry
  if (path.match(/^\/api\/entries\/\d+$/) && request.method === 'PUT') {
    const id = parseInt(path.split('/').pop());
    const { calories, protein, carbs, fat, weight, notes } = await request.json();
    if (!calories) return errorResponse('Las calorías son obligatorias');

    const entry = await env.DB.prepare(
      'SELECT id FROM entries WHERE id = ? AND user_id = ?'
    ).bind(id, user.userId).first();
    if (!entry) return errorResponse('Entrada no encontrada', 404);

    await env.DB.prepare(
      `UPDATE entries SET calories=?, protein=?, carbs=?, fat=?, weight=?, notes=? WHERE id=?`
    ).bind(calories, protein||null, carbs||null, fat||null, weight||null, notes||null, id).run();
    return jsonResponse({ message: 'Entrada actualizada' });
  }

  // DELETE /api/entries/:id
  if (path.match(/^\/api\/entries\/\d+$/) && request.method === 'DELETE') {
    const id = parseInt(path.split('/').pop());

    const entry = await env.DB.prepare(
      'SELECT id FROM entries WHERE id = ? AND user_id = ?'
    ).bind(id, user.userId).first();
    if (!entry) return errorResponse('Entrada no encontrada', 404);

    await env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
    return jsonResponse({ message: 'Entrada eliminada' });
  }

  return errorResponse('Not found', 404);
}
