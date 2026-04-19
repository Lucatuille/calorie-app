// ============================================================
//  CALIBRATION ROUTES — /api/calibration
// ============================================================

import { jsonResponse, errorResponse, requireProAccess, proAccessDenied, rateLimit, authenticate } from '../utils.js';
import { calculateCalibrationProfile, updateFrequentMeals } from '../utils/calibration.js';

export async function handleCalibration(request, env, path) {
  // POST /api/calibration/correction — requiere Pro (verificación desde BD)
  if (path === '/api/calibration/correction' && request.method === 'POST') {
    const user = await requireProAccess(request, env);
    if (!user || user === 'waitlist') return proAccessDenied(user);
    const rl = await rateLimit(env, request, `calibration:${user.userId}`, 30, 60);
    if (rl) return rl;
    const {
      entry_id, ai_raw, ai_calibrated, user_final,
      food_categories, meal_type, meal_name,
      has_context, accepted_without_change,
      input_text, input_type, ai_response_text,
      user_protein, user_carbs, user_fat,
    } = await request.json();

    if (ai_calibrated == null || user_final == null) {
      return errorResponse('ai_calibrated y user_final son obligatorios');
    }

    // Avoid division by zero
    if (!ai_calibrated) return jsonResponse({ success: true });

    const correctionPct = (user_final - ai_calibrated) / ai_calibrated;

    // Use the entry's date for weekend/hour metadata (not "now") so past-dated entries are calibrated correctly
    let refDate = new Date();
    if (entry_id) {
      try {
        const entry = await env.DB.prepare('SELECT date FROM entries WHERE id = ? AND user_id = ?')
          .bind(entry_id, user.userId).first();
        if (entry?.date) refDate = new Date(entry.date + 'T12:00:00Z');
      } catch { /* fallback to now */ }
    }
    const isWeekend = [0, 6].includes(refDate.getDay());

    // 1. Guardar corrección
    await env.DB.prepare(`
      INSERT INTO ai_corrections
      (user_id, entry_id, ai_raw_estimate, ai_calibrated, user_final,
       correction_pct, food_categories, meal_type, has_context,
       is_weekend, day_of_week, hour_of_day, accepted_without_change,
       input_text, input_type, ai_response_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.userId,
      entry_id || null,
      ai_raw || ai_calibrated,
      ai_calibrated,
      user_final,
      correctionPct,
      JSON.stringify(food_categories || []),
      meal_type || 'other',
      has_context ? 1 : 0,
      isWeekend ? 1 : 0,
      refDate.getDay(),
      refDate.getHours(),
      accepted_without_change ? 1 : 0,
      input_text || null,
      input_type || 'photo',
      ai_response_text || null,
    ).run();

    // 2. Recalcular perfil con últimas 50 correcciones + contar total real
    const corrResult = await env.DB.prepare(
      'SELECT * FROM ai_corrections WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(user.userId).all();
    const corrections = corrResult.results || [];

    const totalRow = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM ai_corrections WHERE user_id = ?'
    ).bind(user.userId).first();

    const newProfile = calculateCalibrationProfile(corrections);
    // Usar el total real, no el limitado a 50
    newProfile.data_points = totalRow?.total || corrections.length;

    // 3. Actualizar comidas frecuentes
    const calRow = await env.DB.prepare(
      'SELECT frequent_meals FROM user_calibration WHERE user_id = ?'
    ).bind(user.userId).first();

    let meals = [];
    try { meals = JSON.parse(calRow?.frequent_meals || '[]'); } catch {}
    const updatedMeals = updateFrequentMeals(meals, meal_name, user_final, {
      protein: user_protein, carbs: user_carbs, fat: user_fat,
    });

    // 4. Upsert perfil
    await env.DB.prepare(`
      INSERT OR REPLACE INTO user_calibration
      (user_id, global_bias, confidence, data_points,
       meal_factors, food_factors, time_factors, frequent_meals, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.userId,
      newProfile.global_bias,
      newProfile.confidence,
      newProfile.data_points,
      JSON.stringify(newProfile.meal_factors),
      JSON.stringify(newProfile.food_factors),
      JSON.stringify(newProfile.time_factors),
      JSON.stringify(updatedMeals),
    ).run();

    return jsonResponse({ success: true });
  }

  // GET /api/calibration/profile — requiere Pro (verificación desde BD)
  if (path === '/api/calibration/profile' && request.method === 'GET') {
    const user = await requireProAccess(request, env);
    if (!user || user === 'waitlist') return proAccessDenied(user);
    const row = await env.DB.prepare(
      'SELECT * FROM user_calibration WHERE user_id = ?'
    ).bind(user.userId).first();

    return jsonResponse({
      global_bias:    row?.global_bias    || 0,
      confidence:     row?.confidence     || 0,
      data_points:    row?.data_points    || 0,
      meal_factors:   JSON.parse(row?.meal_factors   || '{}'),
      food_factors:   JSON.parse(row?.food_factors   || '{}'),
      frequent_meals: JSON.parse(row?.frequent_meals || '[]'),
    });
  }

  // GET /api/calibration/frequent-meals — accesible a TODOS los users
  // autenticados (Free + Pro). Los frequent_meals se acumulan para todos en
  // cada POST /entries (ver entries.js), así que gatearlos a Pro era
  // inconsistente. El motor de calibración completo (bias/factors/
  // data_points) sigue Pro-only en /api/calibration/profile.
  if (path === '/api/calibration/frequent-meals' && request.method === 'GET') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);
    const row = await env.DB.prepare(
      'SELECT frequent_meals FROM user_calibration WHERE user_id = ?'
    ).bind(auth.userId).first();
    return jsonResponse({
      frequent_meals: JSON.parse(row?.frequent_meals || '[]'),
    });
  }

  // DELETE /api/calibration/profile — requiere Pro (verificación desde BD)
  if (path === '/api/calibration/profile' && request.method === 'DELETE') {
    const user = await requireProAccess(request, env);
    if (!user || user === 'waitlist') return proAccessDenied(user);
    await Promise.all([
      env.DB.prepare('DELETE FROM user_calibration WHERE user_id = ?').bind(user.userId).run(),
      env.DB.prepare('DELETE FROM ai_corrections WHERE user_id = ?').bind(user.userId).run(),
    ]);
    return jsonResponse({ success: true });
  }

  return errorResponse('Not found', 404);
}
