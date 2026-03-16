// ============================================================
//  ANALYZE ROUTE — /api/analyze
//  Receives a base64 image, calls Claude Vision, returns
//  estimated calories + macros for the food in the photo.
//  Applies personal calibration profile if available.
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';
import { applyCalibration, findSimilarMeal } from '../utils/calibration.js';

const SYSTEM_PROMPT = `Eres un nutricionista experto. El usuario te envía una foto de su comida.
Analiza visualmente los alimentos y estima sus valores nutricionales.
Responde SOLO con un objeto JSON válido, sin texto adicional, con esta estructura exacta:
{
  "name": "nombre descriptivo del plato",
  "calories": número entero,
  "protein": número decimal (gramos),
  "carbs": número decimal (gramos),
  "fat": número decimal (gramos),
  "confidence": "alta" | "media" | "baja",
  "notes": "breve descripción de lo detectado y advertencias si la imagen no es clara",
  "categories": ["categoría1", "categoría2", "categoría3"]
}

Para "categories": máximo 4 categorías en inglés snake_case que describan el plato.
Ejemplos: ["pasta", "italian", "homemade"], ["grilled_chicken", "protein", "light"],
["salad", "vegetables", "dressing_likely"], ["rice", "asian", "soy_sauce"]

Si no puedes identificar comida en la imagen, devuelve confidence: "baja" con valores estimados a 0.

Importante: NO seas conservador con las estimaciones calóricas. Los estudios muestran que las personas consistentemente subestiman las calorías de sus comidas. Asume siempre:
- Raciones generosas — la mayoría de platos caseros y de restaurante son más grandes de lo que parecen en foto
- Aceites y grasas — cualquier salteado, fritura o asado lleva más aceite del visible
- Ingredientes ocultos — salsas, mantequilla, nata, queso rallado añaden calorías que no se ven
- En caso de duda entre dos estimaciones, elige siempre la más alta
- Si el usuario especifica "casero" o "restaurante", los platos de restaurante tienen de media un 30% más de calorías que los caseros por el uso más generoso de grasas

El objetivo es que la estimación sea realista, no optimista.`;

export async function handleAnalyze(request, env, path, ctx) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  if (path === '/api/analyze' && request.method === 'POST') {
    const { image, mediaType, context, meal_type } = await request.json();

    if (!image) return errorResponse('Imagen requerida');
    if (!env.ANTHROPIC_API_KEY) return errorResponse('API key no configurada', 500);

    // Load calibration profile (non-blocking on failure)
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
          meal_factors:   JSON.parse(calRow.meal_factors  || '{}'),
          food_factors:   JSON.parse(calRow.food_factors  || '{}'),
          time_factors:   JSON.parse(calRow.time_factors  || '{}'),
          frequent_meals: JSON.parse(calRow.frequent_meals || '[]'),
        };
      }
    } catch {}

    const contextSection = context?.trim()
      ? `\n\nContexto adicional del usuario: "${context.trim()}"\nTen en cuenta este contexto para ajustar las estimaciones, especialmente el tamaño de la ración, método de cocción e ingredientes no visibles.`
      : '';

    const userText = `Analiza esta comida y devuelve el JSON con la estimación nutricional.${contextSection}

Si el contexto menciona número de raciones, multiplica todos los valores por ese número.
Si menciona peso en gramos, úsalo para calibrar la estimación.
Si menciona ingredientes adicionales no visibles, inclúyelos en el cálculo.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type:       'base64',
                media_type: mediaType || 'image/jpeg',
                data:       image,
              },
            },
            { type: 'text', text: userText },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return errorResponse(err.error?.message || 'Error al llamar a Claude', 502);
    }

    const claude = await response.json();
    const text   = claude.content?.[0]?.text || '';

    // Extract JSON from the response (Claude may wrap it in markdown)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return errorResponse('No se pudo parsear la respuesta de Claude', 502);

    try {
      const result = JSON.parse(match[0]);

      // Log AI usage — ctx.waitUntil garantiza que el INSERT se completa
      // aunque el Worker ya haya enviado la respuesta al cliente
      const inputTokens  = claude.usage?.input_tokens  || 0;
      const outputTokens = claude.usage?.output_tokens || 0;
      const logPromise = env.DB.prepare(
        'INSERT INTO ai_usage_logs (user_id, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
      ).bind(user.userId, inputTokens, outputTokens).run().catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(logPromise);

      const aiRaw      = Math.round(result.calories || 0);
      const categories = Array.isArray(result.categories) ? result.categories : [];
      const isWeekend  = [0, 6].includes(new Date().getDay());

      // Apply calibration
      const calibrated = applyCalibration(aiRaw, calibrationProfile, {
        meal_type: meal_type || 'other',
        food_categories: categories,
        is_weekend: isWeekend,
      });

      const calibrationApplied = calibrationProfile != null && calibrationProfile.confidence >= 0.1;

      // Find similar meal from user's history
      const similarMeal = findSimilarMeal(result.name, calibrationProfile?.frequent_meals);

      return jsonResponse({
        name:       result.name       || '',
        calories:   calibrated,
        protein:    parseFloat((result.protein  || 0).toFixed(1)),
        carbs:      parseFloat((result.carbs    || 0).toFixed(1)),
        fat:        parseFloat((result.fat      || 0).toFixed(1)),
        confidence: result.confidence || 'media',
        notes:      result.notes      || '',
        categories,
        // Calibration metadata
        ai_raw:                   aiRaw,
        calibration_applied:      calibrationApplied,
        calibration_confidence:   calibrationProfile?.confidence || 0,
        calibration_data_points:  calibrationProfile?.data_points || 0,
        similar_meal:             similarMeal,
      });
    } catch {
      return errorResponse('Respuesta JSON inválida de Claude', 502);
    }
  }

  return errorResponse('Not found', 404);
}
