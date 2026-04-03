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

    // Silent macro backfill for users who completed onboarding before macros were saved
    if (!profile.target_protein && profile.target_calories && profile.tdee) {
      const kcal = profile.target_calories;
      const tdee = profile.tdee;
      const goal = kcal < tdee * 0.95 ? 'lose' : kcal > tdee * 1.05 ? 'gain' : 'maintain';
      const RATIOS = { lose: [0.30,0.40,0.30], maintain: [0.25,0.45,0.30], gain: [0.25,0.50,0.25] };
      const [pr, cr, fr] = RATIOS[goal];
      const protein = Math.round((kcal * pr) / 4);
      const carbs   = Math.round((kcal * cr) / 4);
      const fat     = Math.round((kcal * fr) / 9);
      try {
        await env.DB.prepare(
          'UPDATE users SET target_protein=?, target_carbs=?, target_fat=? WHERE id=? AND target_protein IS NULL'
        ).bind(protein, carbs, fat, user.userId).run();
        profile = { ...profile, target_protein: protein, target_carbs: carbs, target_fat: fat };
      } catch { /* ignore — non-critical */ }
    }

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

    // Input validation
    if (name !== undefined && name !== null && String(name).length > 100)
      return errorResponse('Nombre demasiado largo (máx 100 caracteres)');
    if (age !== undefined && age !== null && (Number(age) < 10 || Number(age) > 120))
      return errorResponse('Edad debe estar entre 10 y 120');
    if (weight !== undefined && weight !== null && (Number(weight) < 20 || Number(weight) > 400))
      return errorResponse('Peso debe estar entre 20 y 400 kg');
    if (height !== undefined && height !== null && (Number(height) < 80 || Number(height) > 260))
      return errorResponse('Altura debe estar entre 80 y 260 cm');
    if (gender !== undefined && gender !== null && !['male', 'female'].includes(gender))
      return errorResponse('Género debe ser male o female');
    if (target_calories !== undefined && target_calories !== null && (Number(target_calories) < 500 || Number(target_calories) > 10000))
      return errorResponse('Objetivo calórico debe estar entre 500 y 10000');
    if (target_protein !== undefined && target_protein !== null && (Number(target_protein) < 0 || Number(target_protein) > 1000))
      return errorResponse('Proteína objetivo debe estar entre 0 y 1000g');
    if (target_carbs !== undefined && target_carbs !== null && (Number(target_carbs) < 0 || Number(target_carbs) > 1500))
      return errorResponse('Carbos objetivo debe estar entre 0 y 1500g');
    if (target_fat !== undefined && target_fat !== null && (Number(target_fat) < 0 || Number(target_fat) > 500))
      return errorResponse('Grasa objetivo debe estar entre 0 y 500g');
    if (goal_weight !== undefined && goal_weight !== null && (Number(goal_weight) < 20 || Number(goal_weight) > 400))
      return errorResponse('Peso objetivo debe estar entre 20 y 400 kg');

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
