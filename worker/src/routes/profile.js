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
                goal_weight, tdee, bmr, pal_factor, formula_used, tdee_calculated_at,
                created_at
         FROM users WHERE id = ?`
      ).bind(user.userId).first();
    } catch {
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
    }
    if (!profile) return errorResponse('Usuario no encontrado', 404);
    return jsonResponse(profile);
  }

  // PUT /api/profile
  if (path === '/api/profile' && request.method === 'PUT') {
    const body = await request.json();
    const {
      name, age, weight, height, gender,
      target_calories, target_protein, target_carbs, target_fat,
      goal_weight,
      tdee, bmr, pal_factor, formula_used, tdee_calculated_at,
      onboarding_completed,
    } = body;

    // TDEE fields use COALESCE so that sending null (e.g. from the profile
    // edit form that doesn't include wizard fields) never overwrites existing values.
    await env.DB.prepare(
      `UPDATE users SET name=?, age=?, weight=?, height=?, gender=?,
                        target_calories=?, target_protein=?, target_carbs=?, target_fat=?,
                        goal_weight=?,
                        tdee=COALESCE(?,tdee), bmr=COALESCE(?,bmr),
                        pal_factor=COALESCE(?,pal_factor), formula_used=COALESCE(?,formula_used),
                        tdee_calculated_at=COALESCE(?,tdee_calculated_at),
                        onboarding_completed=COALESCE(?,onboarding_completed)
       WHERE id=?`
    ).bind(
      name||null, age||null, weight||null, height||null, gender||null,
      target_calories||null, target_protein||null, target_carbs||null, target_fat||null,
      goal_weight||null,
      tdee||null, bmr||null, pal_factor||null, formula_used||null, tdee_calculated_at||null,
      onboarding_completed ?? null,
      user.userId
    ).run();

    return jsonResponse({ message: 'Perfil actualizado' });
  }

  return errorResponse('Not found', 404);
}
