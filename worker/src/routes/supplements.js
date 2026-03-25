// ============================================================
//  SUPPLEMENTS ROUTES — /api/supplements
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

export async function handleSupplements(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  const url = new URL(request.url);

  // GET /api/supplements/today?date=YYYY-MM-DD
  if (path === '/api/supplements/today' && request.method === 'GET') {
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { results } = await env.DB.prepare(
      `SELECT us.id, us.name, us.emoji, us.order_index,
              CASE WHEN sl.taken = 1 THEN 1 ELSE 0 END AS taken
       FROM user_supplements us
       LEFT JOIN supplement_logs sl
         ON sl.supplement_id = us.id AND sl.date = ?
       WHERE us.user_id = ? AND us.active = 1
       ORDER BY us.order_index ASC, us.created_at ASC`
    ).bind(date, user.userId).all();

    return jsonResponse(results.map(r => ({ ...r, taken: r.taken === 1 })));
  }

  // POST /api/supplements
  if (path === '/api/supplements' && request.method === 'POST') {
    const { name, emoji, order_index } = await request.json();

    if (!name?.trim()) return errorResponse('El nombre es obligatorio', 400);
    if (name.trim().length > 20) return errorResponse('El nombre no puede superar 20 caracteres', 400);

    // Max 20 supplements per user
    const { count } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_supplements WHERE user_id = ? AND active = 1'
    ).bind(user.userId).first();
    if (count >= 20) return errorResponse('Has alcanzado el máximo de 20 suplementos', 400);

    try {
      const result = await env.DB.prepare(
        `INSERT INTO user_supplements (user_id, name, emoji, order_index)
         VALUES (?, ?, ?, ?)
         RETURNING id, name, emoji, order_index`
      ).bind(user.userId, name.trim(), emoji || '💊', order_index ?? count).first();

      return jsonResponse(result, 201);
    } catch (err) {
      if (err.message?.includes('UNIQUE')) {
        return errorResponse('Ya tienes un suplemento con este nombre', 409);
      }
      throw err;
    }
  }

  // DELETE /api/supplements/:id
  const deleteMatch = path.match(/^\/api\/supplements\/(\d+)$/);
  if (deleteMatch && request.method === 'DELETE') {
    const id = parseInt(deleteMatch[1]);

    const existing = await env.DB.prepare(
      'SELECT id FROM user_supplements WHERE id = ? AND user_id = ?'
    ).bind(id, user.userId).first();
    if (!existing) return errorResponse('Suplemento no encontrado', 404);

    await env.DB.prepare('DELETE FROM user_supplements WHERE id = ? AND user_id = ?').bind(id, user.userId).run();
    return jsonResponse({ success: true });
  }

  // POST /api/supplements/:id/toggle
  const toggleMatch = path.match(/^\/api\/supplements\/(\d+)\/toggle$/);
  if (toggleMatch && request.method === 'POST') {
    const id = parseInt(toggleMatch[1]);
    const { date, taken } = await request.json();

    if (!date) return errorResponse('La fecha es obligatoria', 400);

    const existing = await env.DB.prepare(
      'SELECT id FROM user_supplements WHERE id = ? AND user_id = ? AND active = 1'
    ).bind(id, user.userId).first();
    if (!existing) return errorResponse('Suplemento no encontrado', 404);

    if (taken) {
      await env.DB.prepare(
        `INSERT INTO supplement_logs (user_id, supplement_id, date, taken)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(supplement_id, date) DO UPDATE SET taken = 1`
      ).bind(user.userId, id, date).run();
    } else {
      await env.DB.prepare(
        'DELETE FROM supplement_logs WHERE supplement_id = ? AND date = ?'
      ).bind(id, date).run();
    }

    return jsonResponse({ id, date, taken: !!taken });
  }

  // PUT /api/supplements/reorder
  if (path === '/api/supplements/reorder' && request.method === 'PUT') {
    const items = await request.json();
    if (!Array.isArray(items)) return errorResponse('Se esperaba un array', 400);

    const stmts = items.map(({ id, order_index }) =>
      env.DB.prepare('UPDATE user_supplements SET order_index = ? WHERE id = ? AND user_id = ?')
        .bind(Number(order_index), Number(id), user.userId)
    );
    await env.DB.batch(stmts);

    return jsonResponse({ success: true });
  }

  return errorResponse('Not found', 404);
}
