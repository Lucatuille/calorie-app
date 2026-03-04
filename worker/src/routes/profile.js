// ============================================================
//  PROFILE ROUTES — /api/profile
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

export async function handleProfile(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  // GET /api/profile
  if (path === '/api/profile' && request.method === 'GET') {
    let profile;
    try {
      profile = await env.DB.prepare(
        `SELECT id, name, email, age, weight, height, gender,
                target_calories, target_protein, target_carbs, target_fat,
                goal_weight, created_at
         FROM users WHERE id = ?`
      ).bind(user.userId).first();
    } catch {
      try {
        profile = await env.DB.prepare(
          `SELECT id, name, email, age, weight, height, gender,
                  target_calories, target_protein, target_carbs, target_fat, created_at
           FROM users WHERE id = ?`
        ).bind(user.userId).first();
      } catch {
        profile = await env.DB.prepare(
          `SELECT id, name, email, age, weight, height, gender, target_calories, created_at
           FROM users WHERE id = ?`
        ).bind(user.userId).first();
      }
    }
    if (!profile) return errorResponse('Usuario no encontrado', 404);
    return jsonResponse(profile);
  }

  // PUT /api/profile
  if (path === '/api/profile' && request.method === 'PUT') {
    const { name, age, weight, height, gender,
            target_calories, target_protein, target_carbs, target_fat,
            goal_weight } = await request.json();

    try {
      await env.DB.prepare(
        `UPDATE users SET name=?, age=?, weight=?, height=?, gender=?,
                          target_calories=?, target_protein=?, target_carbs=?, target_fat=?,
                          goal_weight=?
         WHERE id=?`
      ).bind(
        name||null, age||null, weight||null, height||null, gender||null,
        target_calories||null, target_protein||null, target_carbs||null, target_fat||null,
        goal_weight||null,
        user.userId
      ).run();
    } catch {
      try {
        await env.DB.prepare(
          `UPDATE users SET name=?, age=?, weight=?, height=?, gender=?,
                            target_calories=?, target_protein=?, target_carbs=?, target_fat=?
           WHERE id=?`
        ).bind(
          name||null, age||null, weight||null, height||null, gender||null,
          target_calories||null, target_protein||null, target_carbs||null, target_fat||null,
          user.userId
        ).run();
      } catch {
        await env.DB.prepare(
          `UPDATE users SET name=?, age=?, weight=?, height=?, gender=?, target_calories=? WHERE id=?`
        ).bind(name||null, age||null, weight||null, height||null, gender||null, target_calories||null, user.userId).run();
      }
    }

    return jsonResponse({ message: 'Perfil actualizado' });
  }

  return errorResponse('Not found', 404);
}
