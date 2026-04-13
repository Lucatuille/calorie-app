// ============================================================
//  PLANNER ROUTES — /api/planner/*
//  Chef Caliro: planificador de comidas con IA
// ============================================================

import { jsonResponse, errorResponse, authenticate, rateLimit } from '../utils.js';
import { checkAndIncrementPlannerLimit, rollbackPlannerLimit, getPlannerUsage } from '../utils/plannerLimits.js';
import { SYSTEM_PROMPT, buildDayPlanMessage, parseDayPlanResponse } from '../prompts/chef-day.js';

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export async function handlePlanner(request, env, path, ctx) {

  // ── POST /api/planner/day — Plan del día (Sonnet) ──
  if (path === '/api/planner/day' && request.method === 'POST') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);

    // Burst protection
    const rl = await rateLimit(env, request, `planner-day:${auth.userId}`, 5, 60);
    if (rl) return rl;

    // Fetch user from DB
    const user = await env.DB.prepare(
      `SELECT id, name, weight, goal_weight, target_calories, target_protein,
              target_carbs, target_fat, access_level, dietary_preferences
       FROM users WHERE id = ?`
    ).bind(auth.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);
    if (!user.target_calories) return errorResponse('Configura tu objetivo calórico en el perfil primero', 400);

    // Check planner limits
    const limitCheck = await checkAndIncrementPlannerLimit(auth.userId, 'day', user.access_level, env);
    if (!limitCheck.allowed) {
      const msg = limitCheck.reason === 'blocked'
        ? 'El plan del día es una función Pro.'
        : limitCheck.reason === 'day_limit'
          ? 'Has alcanzado el límite de planes del día por hoy.'
          : 'Has alcanzado el límite semanal.';
      return jsonResponse({ error: msg, reason: limitCheck.reason, limits: limitCheck.limits }, 429);
    }

    try {
      const body = await request.json().catch(() => ({}));
      const userContext = (body.context || '').trim().slice(0, 500);

      const today = new Date().toLocaleDateString('en-CA');
      const now = new Date();
      const hourNow = now.getHours();
      const dayOfWeek = DAY_NAMES_ES[now.getDay()];

      // Fetch data in parallel
      const [todayEntries, calibRow] = await Promise.all([
        env.DB.prepare(
          `SELECT meal_type, name, calories, protein, carbs, fat
           FROM entries WHERE user_id = ? AND date = ?
           ORDER BY created_at ASC`
        ).bind(auth.userId, today).all(),

        env.DB.prepare(
          'SELECT frequent_meals FROM user_calibration WHERE user_id = ?'
        ).bind(auth.userId).first().catch(() => null),
      ]);

      const meals = todayEntries.results || [];

      // Calculate remaining budget
      const consumed = meals.reduce((acc, e) => ({
        kcal: acc.kcal + (e.calories || 0),
        protein: acc.protein + (e.protein || 0),
        carbs: acc.carbs + (e.carbs || 0),
        fat: acc.fat + (e.fat || 0),
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

      const remaining = {
        kcal: Math.max(0, (user.target_calories || 0) - consumed.kcal),
        protein: Math.max(0, (user.target_protein || 0) - consumed.protein),
        carbs: Math.max(0, (user.target_carbs || 0) - consumed.carbs),
        fat: Math.max(0, (user.target_fat || 0) - consumed.fat),
      };

      // Parse frequent meals
      let frequentMeals = [];
      try {
        if (calibRow?.frequent_meals) {
          frequentMeals = JSON.parse(calibRow.frequent_meals);
        }
      } catch {}

      // Parse dietary preferences
      let preferences = null;
      try {
        if (user.dietary_preferences) {
          preferences = typeof user.dietary_preferences === 'string'
            ? JSON.parse(user.dietary_preferences)
            : user.dietary_preferences;
        }
      } catch {}

      // Meal types already registered today
      const mealTypesRegistered = [...new Set(
        meals
          .map(m => (m.meal_type || '').toLowerCase())
          .filter(t => ['desayuno', 'breakfast', 'comida', 'lunch', 'merienda', 'snack', 'cena', 'dinner'].includes(t))
          .map(t => {
            // Normalize to Spanish
            if (t === 'breakfast') return 'desayuno';
            if (t === 'lunch') return 'comida';
            if (t === 'snack') return 'merienda';
            if (t === 'dinner') return 'cena';
            return t;
          })
      )];

      // Build prompt
      const userMessage = buildDayPlanMessage({
        user,
        todayMeals: meals,
        remaining,
        frequentMeals,
        preferences,
        context: userContext,
        dayOfWeek,
        hourNow,
        mealTypesRegistered,
      });

      // Call Claude Sonnet
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!claudeRes.ok) {
        await rollbackPlannerLimit(auth.userId, 'day', env);
        const errText = await claudeRes.text().catch(() => 'Unknown error');
        console.error('[planner/day] Anthropic error:', claudeRes.status, errText);
        return errorResponse('Error al conectar con la IA. Inténtalo de nuevo.', 502);
      }

      const claudeData = await claudeRes.json();

      // Check for truncation
      if (claudeData.stop_reason === 'max_tokens') {
        await rollbackPlannerLimit(auth.userId, 'day', env);
        return errorResponse('El plan generado fue demasiado largo. Intenta con menos comidas (ej: "solo cena").', 422);
      }

      const rawText = claudeData.content?.[0]?.text || '';

      // Parse JSON response
      let planData;
      try {
        planData = parseDayPlanResponse(rawText);
      } catch (parseErr) {
        await rollbackPlannerLimit(auth.userId, 'day', env);
        console.error('[planner/day] JSON parse error:', parseErr.message, 'Raw:', rawText.slice(0, 500));
        return errorResponse('Error al procesar el plan generado. Inténtalo de nuevo.', 502);
      }

      // Log token usage
      const tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);
      await env.DB.prepare(
        'INSERT INTO ai_usage_logs (user_id, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
      ).bind(
        auth.userId,
        claudeData.usage?.input_tokens || 0,
        claudeData.usage?.output_tokens || 0
      ).run().catch(() => {});

      return jsonResponse({
        plan: planData,
        target_kcal: user.target_calories,
        remaining_before: remaining,
        usage: {
          remaining_day: limitCheck.remainingDay,
          remaining_week: limitCheck.remainingWeek,
        },
      });

    } catch (err) {
      await rollbackPlannerLimit(auth.userId, 'day', env);
      console.error('[planner/day] Unexpected error:', err.message);
      return errorResponse('Error inesperado al generar el plan.', 500);
    }
  }

  // ── GET /api/planner/usage — Remaining counts ──
  if (path === '/api/planner/usage' && request.method === 'GET') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);

    const user = await env.DB.prepare(
      'SELECT access_level FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);

    const usage = await getPlannerUsage(auth.userId, user.access_level, env);
    return jsonResponse(usage);
  }

  return errorResponse('Route not found', 404);
}
