// ============================================================
//  ANALYZE ROUTE — /api/analyze
//  Receives a base64 image, calls Claude Vision, returns
//  estimated calories + macros for the food in the photo.
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

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
  "notes": "breve descripción de lo detectado y advertencias si la imagen no es clara"
}
Si no puedes identificar comida en la imagen, devuelve confidence: "baja" con valores estimados a 0.`;

export async function handleAnalyze(request, env, path) {
  const user = await authenticate(request, env);
  if (!user) return errorResponse('No autorizado', 401);

  if (path === '/api/analyze' && request.method === 'POST') {
    const { image, mediaType } = await request.json();

    if (!image) return errorResponse('Imagen requerida');
    if (!env.ANTHROPIC_API_KEY) return errorResponse('API key no configurada', 500);

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
            {
              type: 'text',
              text: 'Analiza esta comida y devuelve el JSON con la estimación nutricional.',
            },
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
      return jsonResponse({
        name:       result.name       || '',
        calories:   Math.round(result.calories  || 0),
        protein:    parseFloat((result.protein  || 0).toFixed(1)),
        carbs:      parseFloat((result.carbs    || 0).toFixed(1)),
        fat:        parseFloat((result.fat      || 0).toFixed(1)),
        confidence: result.confidence || 'media',
        notes:      result.notes      || '',
      });
    } catch {
      return errorResponse('Respuesta JSON inválida de Claude', 502);
    }
  }

  return errorResponse('Not found', 404);
}
