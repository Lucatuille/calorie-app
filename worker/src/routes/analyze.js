// ============================================================
//  ANALYZE ROUTE — /api/analyze  y  /api/entries/analyze-text
//  Análisis visual y textual de comidas con Claude Haiku Vision
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';
import { applyCalibration, findSimilarMeal } from '../utils/calibration.js';
import { getAiLimit, canAccess } from '../utils/levels.js';

// Tamaño máximo de imagen permitido (base64, ~2 MB de imagen original)
const MAX_IMAGE_B64_CHARS = 2_800_000; // ≈ 2 MB en base64

// ── System prompt fotos — estático, apto para prompt caching ─
// ~200 tokens (antes ~420)

const PHOTO_SYSTEM_PROMPT = `Eres un nutricionista experto. Analiza la foto de comida y devuelve SOLO JSON válido con esta estructura exacta:
{"name":"nombre descriptivo","calories":entero,"protein":decimal,"carbs":decimal,"fat":decimal,"confidence":"alta"|"media"|"baja","notes":"observaciones breves","categories":["cat1","cat2"]}

Reglas de estimación (no seas conservador):
- Asume raciones generosas y aceites/grasas ocultos
- Restaurante: +30% vs casero por uso de grasas
- En duda entre dos cifras, elige la más alta
- categories: máx 4, en inglés snake_case
- Si no hay comida identificable: confidence "baja", valores 0`;

// ── System prompt texto — estático, apto para prompt caching ─
// ~150 tokens (antes ~380 en user message)

const TEXT_SYSTEM_PROMPT = `Eres un nutricionista experto. El usuario describe su comida en texto. Devuelve SOLO JSON válido:
{"name":"nombre descriptivo","items":[{"name":"nombre","quantity":"cantidad","calories":entero,"protein":decimal,"carbs":decimal,"fat":decimal}],"total":{"calories":entero,"protein":decimal,"carbs":decimal,"fat":decimal},"categories":["cat1","cat2"],"confidence":"high"|"medium"|"low","notes":"observaciones breves"}

Reglas: ración normal española si no se especifica cantidad | casero: moderado en aceites | restaurante: +25-35% | múltiples alimentos: analiza y suma | no seas conservador.`;

// ── Rate limiting con incremento atómico previo ─────────────
// FIX: incremento ANTES de llamar a Claude, rollback si falla.

async function checkAndIncrementAiLimit(env, userId, accessLevel) {
  const limit = getAiLimit(accessLevel);
  if (limit === null) return { error: null, used: 0, limit: null }; // null = ilimitado (admin)

  const today   = new Date().toLocaleDateString('en-CA');
  const row     = await env.DB.prepare(
    'SELECT count FROM ai_usage_log WHERE user_id = ? AND date = ?'
  ).bind(userId, today).first();
  const current = row?.count || 0;

  if (current >= limit) {
    const hoursLeft = 24 - new Date().getHours();
    return {
      error: jsonResponse({
        error: 'ai_limit_reached',
        used: current,
        limit,
        hours_left: hoursLeft,
        message: `Has usado tus ${limit} análisis de IA de hoy. Se renuevan a las 00:00.`,
        upgrade_available: true,
      }, 429),
    };
  }

  // Incremento atómico ANTES de la llamada a Claude
  await env.DB.prepare(`
    INSERT INTO ai_usage_log (user_id, date, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
  `).bind(userId, today).run();

  return { error: null, used: current, limit };
}

async function rollbackAiLimit(env, userId) {
  const today = new Date().toLocaleDateString('en-CA');
  await env.DB.prepare(
    'UPDATE ai_usage_log SET count = MAX(0, count - 1) WHERE user_id = ? AND date = ?'
  ).bind(userId, today).run().catch(() => {});
}

// ── POST /api/analyze — análisis por foto ───────────────────

export async function handleAnalyze(request, env, path, ctx) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  // Verificar access_level desde BD — nunca confiar solo en el JWT (puede estar desactualizado)
  const dbUser = await env.DB.prepare(
    'SELECT access_level FROM users WHERE id = ?'
  ).bind(user.userId).first();
  const accessLevel = dbUser?.access_level ?? 3;

  if (!canAccess(accessLevel)) {
    return jsonResponse({ error: 'waitlist', message: 'Tu cuenta está en lista de espera.' }, 403);
  }

  if (path === '/api/analyze' && request.method === 'POST') {
    const { image, mediaType, context, meal_type } = await request.json();

    if (!image) return errorResponse('Imagen requerida');
    if (!env.ANTHROPIC_API_KEY) return errorResponse('API key no configurada', 500);

    // Guard de tamaño de imagen
    if (image.length > MAX_IMAGE_B64_CHARS) {
      return errorResponse(`Imagen demasiado grande. Reduce la resolución antes de enviar (máx ~2 MB).`, 413);
    }

    const limitCheck = await checkAndIncrementAiLimit(env, user.userId, accessLevel);
    if (limitCheck.error) return limitCheck.error;

    // Calibración (no-blocking)
    let calibrationProfile = null;
    try {
      const calRow = await env.DB.prepare(
        'SELECT * FROM user_calibration WHERE user_id = ?'
      ).bind(user.userId).first();
      if (calRow) {
        calibrationProfile = {
          global_bias:    calRow.global_bias,
          confidence:     calRow.confidence,
          data_points:    calRow.data_points,
          meal_factors:   JSON.parse(calRow.meal_factors   || '{}'),
          food_factors:   JSON.parse(calRow.food_factors   || '{}'),
          time_factors:   JSON.parse(calRow.time_factors   || '{}'),
          frequent_meals: JSON.parse(calRow.frequent_meals || '[]'),
        };
      }
    } catch {}

    const contextSection = context?.trim()
      ? `\nContexto: "${context.trim().slice(0, 200)}"`
      : '';

    const userText = `Analiza esta comida y devuelve el JSON.${contextSection}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system:     PHOTO_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image },
            },
            { type: 'text', text: userText },
          ],
        }],
      }),
    });

    if (!response.ok) {
      await rollbackAiLimit(env, user.userId);
      const err = await response.json().catch(() => ({}));
      return errorResponse(err.error?.message || 'Error al llamar a Claude', 502);
    }

    const claude = await response.json();
    const text   = claude.content?.[0]?.text || '';

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      await rollbackAiLimit(env, user.userId);
      return errorResponse('No se pudo parsear la respuesta de Claude', 502);
    }

    try {
      const result = JSON.parse(match[0]);

      const inputTokens  = claude.usage?.input_tokens  || 0;
      const outputTokens = claude.usage?.output_tokens || 0;
      const logPromise = env.DB.prepare(
        "INSERT INTO ai_usage_logs (user_id, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, datetime('now'))"
      ).bind(user.userId, inputTokens, outputTokens).run().catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(logPromise);

      const aiRaw      = Math.round(result.calories || 0);
      const categories = Array.isArray(result.categories) ? result.categories : [];
      const isWeekend  = [0, 6].includes(new Date().getDay());

      const calibrated = applyCalibration(aiRaw, calibrationProfile, {
        meal_type:       meal_type || 'other',
        food_categories: categories,
        is_weekend:      isWeekend,
      });

      const calibrationApplied = calibrationProfile != null && calibrationProfile.confidence >= 0.1;
      const similarMeal        = findSimilarMeal(result.name, calibrationProfile?.frequent_meals);

      return jsonResponse({
        name:       result.name       || '',
        calories:   calibrated,
        protein:    parseFloat((result.protein  || 0).toFixed(1)),
        carbs:      parseFloat((result.carbs    || 0).toFixed(1)),
        fat:        parseFloat((result.fat      || 0).toFixed(1)),
        confidence: result.confidence || 'media',
        notes:      result.notes      || '',
        categories,
        ai_raw:                  aiRaw,
        calibration_applied:     calibrationApplied,
        calibration_confidence:  calibrationProfile?.confidence   || 0,
        calibration_data_points: calibrationProfile?.data_points  || 0,
        similar_meal:            similarMeal,
        usage: { used: limitCheck.used + 1, limit: limitCheck.limit ?? null },
      });
    } catch {
      await rollbackAiLimit(env, user.userId);
      return errorResponse('Respuesta JSON inválida de Claude', 502);
    }
  }

  return errorResponse('Not found', 404);
}

// ── POST /api/entries/analyze-text ─────────────────────────

export async function handleAnalyzeText(request, env, ctx) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  // Verificar access_level desde BD — nunca confiar solo en el JWT (puede estar desactualizado)
  const dbUser = await env.DB.prepare(
    'SELECT access_level FROM users WHERE id = ?'
  ).bind(user.userId).first();
  const accessLevel = dbUser?.access_level ?? 3;

  if (!canAccess(accessLevel)) {
    return jsonResponse({ error: 'waitlist', message: 'Tu cuenta está en lista de espera.' }, 403);
  }

  const { text, meal_type } = await request.json();
  if (!text?.trim()) return errorResponse('Texto vacío', 400);
  if (text.length > 500) return errorResponse('Texto demasiado largo (máx 500 caracteres)', 400);

  const limitCheck = await checkAndIncrementAiLimit(env, user.userId, accessLevel);
  if (limitCheck.error) return limitCheck.error;

  // Calibración — solo si hay confianza suficiente
  let calibrationRow = null;
  let calibrationProfile = null;
  try {
    calibrationRow = await env.DB.prepare(
      'SELECT global_bias, confidence, data_points, meal_factors, food_factors, time_factors, frequent_meals FROM user_calibration WHERE user_id = ?'
    ).bind(user.userId).first();
  } catch {}

  if (calibrationRow) {
    calibrationProfile = {
      global_bias:    calibrationRow.global_bias,
      confidence:     calibrationRow.confidence,
      data_points:    calibrationRow.data_points,
      meal_factors:   JSON.parse(calibrationRow.meal_factors   || '{}'),
      food_factors:   JSON.parse(calibrationRow.food_factors   || '{}'),
      time_factors:   JSON.parse(calibrationRow.time_factors   || '{}'),
      frequent_meals: JSON.parse(calibrationRow.frequent_meals || '[]'),
    };
  }

  // Nota de calibración — solo si confidence > 0.2 (y es corta)
  let calibNote = '';
  if (calibrationProfile?.confidence > 0.2) {
    const biasPct = Math.round(Math.abs(calibrationProfile.global_bias) * 100);
    const dir     = calibrationProfile.global_bias > 0 ? 'más' : 'menos';
    calibNote = ` [Calibración: usuario consume ${biasPct}% ${dir} de lo estimado]`;
  }

  const userMessage = `${text.trim()}${calibNote}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:     TEXT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    await rollbackAiLimit(env, user.userId);
    const err = await response.json().catch(() => ({}));
    return errorResponse(err?.error?.message || 'Error de IA (upstream)', 502);
  }

  let aiData;
  try { aiData = await response.json(); } catch {
    await rollbackAiLimit(env, user.userId);
    return errorResponse('Respuesta no-JSON de Claude', 502);
  }
  const rawText = aiData.content?.[0]?.text || '';

  let result;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    result = JSON.parse(match[0]);
  } catch {
    await rollbackAiLimit(env, user.userId);
    return errorResponse('Respuesta inválida de Claude', 502);
  }

  const rawCalories = result.total?.calories || 0;
  const isWeekend   = [0, 6].includes(new Date().getDay());
  const calibratedCalories = applyCalibration(rawCalories, calibrationProfile, {
    meal_type:       meal_type || 'other',
    food_categories: result.categories || [],
    is_weekend:      isWeekend,
  });

  const similarMeal = findSimilarMeal(text, calibrationProfile?.frequent_meals);

  const inputTokens  = aiData.usage?.input_tokens  || 0;
  const outputTokens = aiData.usage?.output_tokens || 0;
  const logPromise = env.DB.prepare(
    "INSERT INTO ai_usage_logs (user_id, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).bind(user.userId, inputTokens, outputTokens).run().catch(() => {});
  if (ctx?.waitUntil) ctx.waitUntil(logPromise);

  const calibrationApplied = calibrationProfile != null && calibrationProfile.confidence >= 0.1;

  return jsonResponse({
    name:       result.name  || '',
    items:      result.items || [],
    total: {
      calories: calibratedCalories,
      protein:  parseFloat((result.total?.protein || 0).toFixed(1)),
      carbs:    parseFloat((result.total?.carbs   || 0).toFixed(1)),
      fat:      parseFloat((result.total?.fat     || 0).toFixed(1)),
    },
    categories:              result.categories || [],
    confidence:              result.confidence || 'medium',
    notes:                   result.notes      || '',
    ai_raw_calories:         rawCalories,
    calibration_applied:     calibrationApplied,
    calibration_confidence:  calibrationProfile?.confidence  || 0,
    calibration_data_points: calibrationProfile?.data_points || 0,
    similar_meal:            similarMeal,
    usage: { used: limitCheck.used + 1, limit: limitCheck.limit ?? null },
  });
}
