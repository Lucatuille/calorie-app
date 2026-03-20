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
// ~300 tokens

const PHOTO_SYSTEM_PROMPT = `Eres un nutricionista experto analizando una foto de comida.

Proceso obligatorio antes de estimar:
1. Identifica cada componente visible (proteína, carbohidrato, verdura, salsa, aceite)
2. Estima el peso aproximado de cada uno en gramos según el tamaño del plato
3. Calcula kcal por componente y suma → ese es el total real

Devuelve SOLO JSON válido:
{"name":"nombre descriptivo","calories":entero,"calories_min":entero|null,"calories_max":entero|null,"protein":decimal,"carbs":decimal,"fat":decimal,"confidence":"alta"|"media"|"baja","notes":"componentes: X g proteína (~Nkcal) + Y g carbos (~Nkcal) + ...","categories":["cat1","cat2"]}

Si confidence!="alta", rellena calories_min y calories_max con el rango realista (±15-25%).

Referencia por 100g (úsala para calcular, no como techo):
pollo/pavo pechuga 120kcal | muslo pollo 180kcal | ternera 250kcal | cerdo 280kcal | pescado blanco 90kcal | salmón 200kcal | huevo 155kcal | arroz cocido 130kcal | pasta cocida 160kcal | pan 260kcal | patata cocida 85kcal | patata frita 310kcal | legumbres 120kcal | verdura hoja 25kcal | aceite 880kcal

Reglas:
- El total depende de la CANTIDAD visible — un plato grande de pasta puede ser 700kcal, uno pequeño 350kcal
- Grasa de cocción según método: hervido/vapor +0 | plancha/horno +15-30kcal | salteado/rehogado +60-100kcal | frito sartén +100-180kcal | frito freidora +150-250kcal | salsa cremosa visible +100-200kcal | aliño ensalada +80-150kcal
- Si hay múltiples platos o acompañamientos visibles (guarnición, pan, bebida), estímalos todos y suma al total
- Restaurante o preparación elaborada: +25-35% vs casero simple (ya incluido en grasa si aplica)
- confidence "baja" si la imagen no muestra comida claramente, valores 0
- categories: máx 4, inglés snake_case`;

// ── System prompt texto — estático, apto para prompt caching ─
// ~200 tokens

const TEXT_SYSTEM_PROMPT = `Eres un nutricionista experto. El usuario describe su comida en texto. Devuelve SOLO JSON válido:
{"name":"nombre descriptivo","items":[{"name":"nombre","quantity":"cantidad","calories":entero,"protein":decimal,"carbs":decimal,"fat":decimal}],"total":{"calories":entero,"protein":decimal,"carbs":decimal,"fat":decimal},"categories":["cat1","cat2"],"confidence":"high"|"medium"|"low","notes":"observaciones breves","clarification_question":null,"clarification_options":null}

Si confidence="low", rellena clarification_question con la duda más relevante (ej: "¿El pollo era a la plancha o frito?") y clarification_options con 2-3 opciones cortas.

Reglas:
- Ración normal española si no se especifica cantidad | no seas conservador
- Casero: moderado en aceites | restaurante: +25-35%
- Cocción no especificada: carnes/pescados → asumir plancha; patatas en restaurante → asumir fritas
- Múltiples alimentos: analiza cada uno individualmente y suma`;

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
    const { image, mediaType, context, meal_type, photo_location, photo_plate_size } = await request.json();

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

    // Contexto estructurado desde los toggles del cliente
    const locationLabels = { home: 'comida casera', restaurant: 'restaurante', takeaway: 'takeaway/para llevar', fastfood: 'fast food' };
    const sizeLabels     = { small: 'plato pequeño (~20cm)', normal: 'plato estándar (~26cm)', large: 'plato grande (~30cm)', bowl: 'bol/cuenco' };
    const structuredParts = [
      photo_location   ? `Lugar: ${locationLabels[photo_location]   || photo_location}`   : null,
      photo_plate_size ? `Tamaño: ${sizeLabels[photo_plate_size] || photo_plate_size}` : null,
    ].filter(Boolean);
    const fullContext = [structuredParts.join(' | '), context?.trim()].filter(Boolean).join(' · ');

    const contextSection = fullContext ? `\nContexto: "${fullContext.slice(0, 250)}"` : '';
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
        max_tokens: 800,
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

    if (claude.stop_reason === 'max_tokens') {
      await rollbackAiLimit(env, user.userId);
      return jsonResponse({
        error: 'response_too_large',
        message: 'La IA no pudo completar el análisis (respuesta demasiado larga). Prueba con una imagen más clara o con menos elementos en el plato.',
      }, 422);
    }

    const text  = claude.content?.[0]?.text || '';

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

      // Scale the range by the same calibration ratio applied to the midpoint
      const calibRatio = aiRaw > 0 ? calibrated / aiRaw : 1;
      const caloriesMin = result.calories_min ? Math.round(result.calories_min * calibRatio) : null;
      const caloriesMax = result.calories_max ? Math.round(result.calories_max * calibRatio) : null;

      const calibrationApplied = calibrationProfile != null && calibrationProfile.confidence >= 0.05;
      const similarMeal        = findSimilarMeal(result.name, calibrationProfile?.frequent_meals);

      return jsonResponse({
        name:         result.name       || '',
        calories:     calibrated,
        calories_min: caloriesMin,
        calories_max: caloriesMax,
        protein:      parseFloat((result.protein  || 0).toFixed(1)),
        carbs:        parseFloat((result.carbs    || 0).toFixed(1)),
        fat:          parseFloat((result.fat      || 0).toFixed(1)),
        confidence:   result.confidence || 'media',
        notes:        result.notes      || '',
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
      max_tokens: 800,
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

  if (aiData.stop_reason === 'max_tokens') {
    await rollbackAiLimit(env, user.userId);
    return jsonResponse({
      error: 'response_too_large',
      message: 'La IA no pudo completar el análisis (respuesta demasiado larga). Intenta con una descripción más corta.',
    }, 422);
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
