// ============================================================
//  PROFILE ROUTES — /api/profile
// ============================================================

import { jsonResponse, errorResponse, authenticate, rateLimit } from '../utils.js';

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
                dietary_preferences,
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

    // Parse dietary_preferences JSON → object (null si vacío o inválido)
    if (profile.dietary_preferences) {
      try {
        profile.dietary_preferences = JSON.parse(profile.dietary_preferences);
      } catch {
        profile.dietary_preferences = null;
      }
    } else {
      profile.dietary_preferences = null;
    }

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

  // GET /api/profile/export — descarga GDPR de TODOS los datos del usuario
  if (path === '/api/profile/export' && request.method === 'GET') {
    const rl = await rateLimit(env, request, `profile-export:${user.userId}`, 5, 60 * 60);
    if (rl) return rl;

    // Helper para .all() defensivo (algunas tablas pueden no existir)
    const safeAll = async (sql, ...args) => {
      try {
        const { results } = await env.DB.prepare(sql).bind(...args).all();
        return results || [];
      } catch { return []; }
    };
    const safeFirst = async (sql, ...args) => {
      try {
        return await env.DB.prepare(sql).bind(...args).first();
      } catch { return null; }
    };

    // 1. Perfil (sin password_hash)
    const userRow = await safeFirst(
      `SELECT id, name, email, age, weight, height, gender,
              target_calories, target_protein, target_carbs, target_fat,
              goal_weight, tdee, bmr, pal_factor, formula_used, tdee_calculated_at,
              access_level, onboarding_completed, last_login, created_at
       FROM users WHERE id = ?`,
      user.userId
    );

    // 2. Comidas (sin LIMIT)
    const entries = await safeAll(
      'SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      user.userId
    );

    // 3. Peso histórico
    const weightLogs = await safeAll(
      'SELECT date, weight_kg, created_at FROM weight_logs WHERE user_id = ? ORDER BY date DESC',
      user.userId
    );

    // 4. Suplementos
    const supplements = await safeAll(
      'SELECT * FROM user_supplements WHERE user_id = ?',
      user.userId
    );
    const supplementLogs = await safeAll(
      'SELECT * FROM supplement_logs WHERE user_id = ? ORDER BY date DESC',
      user.userId
    );

    // 5. Correcciones de IA (incluye los nuevos input_text, ai_response_text)
    const aiCorrections = await safeAll(
      'SELECT * FROM ai_corrections WHERE user_id = ? ORDER BY created_at DESC',
      user.userId
    );

    // 6. Perfil de calibración
    const calibration = await safeFirst(
      'SELECT * FROM user_calibration WHERE user_id = ?',
      user.userId
    );

    // 7. Uso de IA diario
    const aiUsage = await safeAll(
      'SELECT * FROM ai_usage_log WHERE user_id = ? ORDER BY date DESC',
      user.userId
    );

    // 8. Conversaciones del asistente
    const assistantConversations = await safeAll(
      'SELECT * FROM assistant_conversations WHERE user_id = ? ORDER BY created_at DESC',
      user.userId
    );
    const assistantMessages = await safeAll(
      'SELECT * FROM assistant_messages WHERE user_id = ? ORDER BY created_at DESC',
      user.userId
    );

    return jsonResponse({
      exported_at:  new Date().toISOString(),
      format_version: '1.0',
      user:         userRow,
      entries,
      weight_logs:  weightLogs,
      supplements,
      supplement_logs: supplementLogs,
      ai_corrections:  aiCorrections,
      calibration,
      ai_usage:        aiUsage,
      assistant: {
        conversations: assistantConversations,
        messages:      assistantMessages,
      },
    });
  }

  // PUT /api/profile
  if (path === '/api/profile' && request.method === 'PUT') {
    const rl = await rateLimit(env, request, `profile-write:${user.userId}`, 10, 60);
    if (rl) return rl;
    const body = await request.json();
    const {
      name, age, weight, height, gender,
      target_calories, target_protein, target_carbs, target_fat,
      goal_weight,
      tdee, bmr, pal_factor, formula_used, tdee_calculated_at,
      onboarding_completed,
      dietary_preferences,
    } = body;

    // Validar y normalizar dietary_preferences (si viene). Devuelve JSON string o null.
    // Formato esperado:
    //   { diet: 'omnivore'|'vegetarian'|'vegan'|'pescatarian',
    //     allergies: string[], dislikes: string }
    const DIET_VALUES    = ['omnivore', 'vegetarian', 'vegan', 'pescatarian'];
    const ALLERGY_VALUES = ['gluten', 'lactose', 'nuts', 'shellfish', 'egg', 'soy'];
    let dietaryPrefsJson = undefined; // undefined = no enviar → COALESCE conserva valor existente
    if (dietary_preferences !== undefined) {
      if (dietary_preferences === null) {
        dietaryPrefsJson = null; // borrar
      } else if (typeof dietary_preferences === 'object') {
        const diet = dietary_preferences.diet;
        if (diet !== undefined && diet !== null && !DIET_VALUES.includes(diet)) {
          return errorResponse('Tipo de dieta inválido');
        }
        const rawAllergies = Array.isArray(dietary_preferences.allergies) ? dietary_preferences.allergies : [];
        const allergies = rawAllergies.filter(a => ALLERGY_VALUES.includes(a));
        const dislikes = typeof dietary_preferences.dislikes === 'string'
          ? dietary_preferences.dislikes.trim().slice(0, 200)
          : '';
        dietaryPrefsJson = JSON.stringify({
          diet: diet || 'omnivore',
          allergies,
          dislikes,
        });
      } else {
        return errorResponse('dietary_preferences debe ser objeto o null');
      }
    }

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
    // dietary_preferences: si no viene en body (undefined), conservar existente.
    //                      si viene como null, borrar.
    //                      si viene como objeto válido, guardar JSON.
    const dietaryParam = dietaryPrefsJson === undefined ? '__KEEP__' : dietaryPrefsJson;
    const dietarySqlExpr = dietaryParam === '__KEEP__'
      ? 'dietary_preferences'
      : '?';

    try {
      await env.DB.prepare(
        `UPDATE users SET name=?, age=?, weight=?, height=?, gender=?,
                          target_calories=?, target_protein=?, target_carbs=?, target_fat=?,
                          goal_weight=?,
                          tdee=COALESCE(?,tdee), bmr=COALESCE(?,bmr),
                          pal_factor=COALESCE(?,pal_factor), formula_used=COALESCE(?,formula_used),
                          tdee_calculated_at=COALESCE(?,tdee_calculated_at),
                          onboarding_completed=COALESCE(?,onboarding_completed),
                          dietary_preferences=${dietarySqlExpr}
         WHERE id=?`
      ).bind(
        name||null, age||null, weight||null, height||null, gender||null,
        target_calories||null, target_protein||null, target_carbs||null, target_fat||null,
        goal_weight||null,
        tdee||null, bmr||null, pal_factor||null, formula_used||null, tdee_calculated_at||null,
        onboarding_completed ?? null,
        ...(dietaryParam === '__KEEP__' ? [] : [dietaryParam]),
        user.userId
      ).run();
    } catch (err) {
      // Fallback para entornos donde la columna dietary_preferences aún no existe
      // (ej. tests con schema legacy). Reintento sin esa columna.
      if (String(err?.message || '').includes('dietary_preferences')) {
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
      } else {
        throw err;
      }
    }

    // Sincronizar peso a weight_logs si se actualizó
    if (weight) {
      const today = new Date().toISOString().split('T')[0];
      await env.DB.prepare(
        `INSERT INTO weight_logs (user_id, date, weight_kg) VALUES (?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = ?`
      ).bind(user.userId, today, weight, weight).run().catch(() => {});
    }

    return jsonResponse({ message: 'Perfil actualizado' });
  }

  // DELETE /api/profile — borrar la propia cuenta (GDPR Art. 17)
  if (path === '/api/profile' && request.method === 'DELETE') {
    // Rate limit estricto: máx 3 intentos por hora (evita scripts maliciosos)
    const rl = await rateLimit(env, request, `profile-delete:${user.userId}`, 3, 60 * 60);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== 'ELIMINAR') {
      return errorResponse('Confirmación requerida: enviar { "confirm": "ELIMINAR" }', 400);
    }

    // Verificar que el usuario existe y no es admin (admins no pueden auto-eliminarse así)
    const target = await env.DB.prepare(
      'SELECT id, is_admin FROM users WHERE id = ?'
    ).bind(user.userId).first();
    if (!target) return errorResponse('Usuario no encontrado', 404);
    if (target.is_admin) return errorResponse('Los administradores no pueden eliminar su cuenta así', 400);

    // 1. Borrar datos en tablas SIN ON DELETE CASCADE
    try {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').bind(user.userId),
        env.DB.prepare('DELETE FROM upgrade_events WHERE user_id = ?').bind(user.userId),
        env.DB.prepare('DELETE FROM weight_logs WHERE user_id = ?').bind(user.userId),
        env.DB.prepare('DELETE FROM ai_usage_logs WHERE user_id = ?').bind(user.userId),
        env.DB.prepare('DELETE FROM assistant_digests WHERE user_id = ?').bind(user.userId),
      ]);
    } catch { /* algunas tablas pueden no existir aún — continuar */ }

    // 2. Borrar usuario — CASCADE limpia: entries, user_supplements, supplement_logs,
    //    ai_corrections, user_calibration, ai_usage_log, assistant_conversations,
    //    assistant_messages, assistant_usage
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.userId).run();

    return jsonResponse({ success: true, message: 'Cuenta eliminada' });
  }

  return errorResponse('Not found', 404);
}
