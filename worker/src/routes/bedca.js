// ============================================================
//  BEDCA ROUTES — /api/bedca/* (admin-only sync)
// ============================================================
//
// Endpoints para sincronizar el dataset del bedca tool (caliro.dev/bedca/)
// con D1. El tool sigue usando localStorage como cache rapido; D1 es
// source of truth + sincronizacion multi-dispositivo.
//
// Restriccion: admin-only (is_admin = 1 OR access_level = 99). El tool
// es uso personal y no esta advertised. Si se abre a otros users, cambiar
// requireAdmin por requireProAccess.

import { jsonResponse, errorResponse, authenticate, rateLimit } from '../utils.js';

const MAX_INGREDIENTS = 10000; // anti-abuse: tope razonable

async function requireAdmin(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return null;
  const dbUser = await env.DB.prepare(
    'SELECT id, is_admin, access_level FROM users WHERE id = ?'
  ).bind(auth.userId).first();
  if (!dbUser) return null;
  if (dbUser.is_admin === 1 || dbUser.access_level === 99) {
    return { userId: auth.userId, ...dbUser };
  }
  return 'forbidden';
}

export async function handleBedca(request, env, path) {
  const user = await requireAdmin(request, env);
  if (!user) return errorResponse('No autorizado', 401);
  if (user === 'forbidden') return errorResponse('Acceso restringido a admin', 403);

  // GET /api/bedca/data — devuelve snapshot del user (o null si vacio)
  if (path === '/api/bedca/data' && request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT snapshot_json, updated_at FROM user_bedca_data WHERE user_id = ?'
    ).bind(user.userId).first();

    if (!row) return jsonResponse({ snapshot: null, updated_at: null });

    let snapshot = null;
    try { snapshot = JSON.parse(row.snapshot_json); } catch {}
    return jsonResponse({ snapshot, updated_at: row.updated_at });
  }

  // PUT /api/bedca/data — UPSERT del snapshot completo (last-write-wins)
  if (path === '/api/bedca/data' && request.method === 'PUT') {
    const rl = await rateLimit(env, request, `bedca-put:${user.userId}`, 30, 60);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const { snapshot } = body;

    if (!snapshot || typeof snapshot !== 'object') {
      return errorResponse('snapshot requerido');
    }
    if (!Array.isArray(snapshot.ingredients)) {
      return errorResponse('snapshot.ingredients debe ser array');
    }
    if (snapshot.ingredients.length > MAX_INGREDIENTS) {
      return errorResponse(`Demasiados ingredientes (max ${MAX_INGREDIENTS})`);
    }

    await env.DB.prepare(`
      INSERT INTO user_bedca_data (user_id, snapshot_json, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        snapshot_json = excluded.snapshot_json,
        updated_at = excluded.updated_at
    `).bind(user.userId, JSON.stringify(snapshot)).run();

    return jsonResponse({ ok: true });
  }

  return errorResponse('Not found', 404);
}
