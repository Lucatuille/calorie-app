// ============================================================
//  PLANNER ROUTES — /api/planner/*
//  Chef Caliro: planificador de comidas con IA
// ============================================================

import { jsonResponse, errorResponse, authenticate, rateLimit } from '../utils.js';
import { checkAndIncrementPlannerLimit, rollbackPlannerLimit, getPlannerUsage } from '../utils/plannerLimits.js';
import { savePlannerHistory, getRecentPlannerHistory, extractRecentDishNames } from '../utils/plannerHistory.js';
import { resolveMealTypesRegistered } from '../utils/mealTypeInfer.js';
import { calibrateMeals, recomputeTotals } from '../utils/calibratePlan.js';
import { SYSTEM_PROMPT, buildDayPlanMessage, parseDayPlanResponse } from '../prompts/chef-day.js';
import {
  SYSTEM_PROMPT_WEEK,
  buildWeekPlanMessage,
  parseWeekPlanResponse,
  computeDaysToPlan,
} from '../prompts/chef-week.js';

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

      // Variedad — ventana de 3 días atrás (sin incluir hoy)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoISO = threeDaysAgo.toLocaleDateString('en-CA');

      // Fetch data in parallel
      const [todayEntries, calibRow, recentEntriesRes, recentHistoryDay] = await Promise.all([
        env.DB.prepare(
          `SELECT meal_type, name, calories, protein, carbs, fat, created_at
           FROM entries WHERE user_id = ? AND date = ?
           ORDER BY created_at ASC`
        ).bind(auth.userId, today).all(),

        env.DB.prepare(
          'SELECT frequent_meals FROM user_calibration WHERE user_id = ?'
        ).bind(auth.userId).first().catch(() => null),

        env.DB.prepare(
          `SELECT date, meal_type, name, calories
           FROM entries
           WHERE user_id = ? AND date >= ? AND date < ?
           ORDER BY date DESC, created_at ASC`
        ).bind(auth.userId, threeDaysAgoISO, today).all().catch(() => ({ results: [] })),

        getRecentPlannerHistory(auth.userId, 'day', 3, env),
      ]);

      const meals = todayEntries.results || [];
      const recentEntries = recentEntriesRes.results || [];
      const recentPlannedDishes = extractRecentDishNames(recentHistoryDay, 20);

      // Calculate remaining budget — puede ser negativo si el usuario ya se pasó.
      // No lo clampeamos: el prompt y el cliente tienen que saber la verdad para
      // actuar bien (sugerir solo snack mínimo, avisar de exceso, etc.).
      const consumed = meals.reduce((acc, e) => ({
        kcal: acc.kcal + (e.calories || 0),
        protein: acc.protein + (e.protein || 0),
        carbs: acc.carbs + (e.carbs || 0),
        fat: acc.fat + (e.fat || 0),
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

      const remaining = {
        kcal:    (user.target_calories || 0) - consumed.kcal,
        protein: (user.target_protein  || 0) - consumed.protein,
        carbs:   (user.target_carbs    || 0) - consumed.carbs,
        fat:     (user.target_fat      || 0) - consumed.fat,
      };
      const isOverBudget = remaining.kcal <= 0;

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

      // Meal types already registered today — infiere por hora si meal_type = 'other'
      const mealTypesRegistered = resolveMealTypesRegistered(meals);

      // Build prompt
      const userMessage = buildDayPlanMessage({
        user,
        todayMeals: meals,
        remaining,
        isOverBudget,
        frequentMeals,
        preferences,
        context: userContext,
        dayOfWeek,
        hourNow,
        mealTypesRegistered,
        recentEntries,
        recentPlannedDishes,
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

      // Enforce server-side: filtrar meals de tipos ya registrados (Sonnet
      // a veces ignora la instrucción "solo genera los que faltan").
      if (mealTypesRegistered.length > 0 && Array.isArray(planData.meals)) {
        const TYPE_MAP = {
          desayuno: 'desayuno', breakfast: 'desayuno',
          comida:   'comida',   lunch:     'comida',
          merienda: 'merienda', snack:     'merienda',
          cena:     'cena',     dinner:    'cena',
        };
        planData.meals = planData.meals.filter(m => {
          const t = (m.type || '').toLowerCase();
          const normalized = TYPE_MAP[t] || t;
          return !mealTypesRegistered.includes(normalized);
        });
        planData.totals = recomputeTotals(planData.meals);
      }

      // Calibrar porciones para acercarse al presupuesto restante (±10%).
      // Protein-aware: protegemos proteína, C+F absorben el ajuste.
      // Si remaining <= 0 (usuario ya se pasó) calibrateMeals lo detecta y
      // devuelve { overBudgetSkipped: true } sin tocar nada.
      const calibration = calibrateMeals(planData.meals, {
        kcal: remaining.kcal,
        protein: remaining.protein > 0 ? remaining.protein : undefined,
      });
      if (calibration.calibrated) {
        planData.totals = recomputeTotals(planData.meals);
      }

      // Warnings honestos al cliente. Campos nuevos, todos nullables.
      const warnings = buildDayWarnings({
        planData,
        remaining,
        calibration,
        isOverBudget,
        targetProtein: user.target_protein,
      });

      // Log token usage
      await env.DB.prepare(
        'INSERT INTO ai_usage_logs (user_id, input_tokens, output_tokens, model, feature, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
      ).bind(
        auth.userId,
        claudeData.usage?.input_tokens || 0,
        claudeData.usage?.output_tokens || 0,
        'claude-sonnet-4-6',
        'chef_day'
      ).run().catch(() => {});

      // Guardar en history para variedad futura
      await savePlannerHistory(auth.userId, 'day', planData, env);

      return jsonResponse({
        plan: planData,
        target_kcal: user.target_calories,
        remaining_before: remaining,
        warnings,
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

  // ── POST /api/planner/week — Plan semanal (Sonnet) ──
  if (path === '/api/planner/week' && request.method === 'POST') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);

    const rl = await rateLimit(env, request, `planner-week:${auth.userId}`, 2, 120);
    if (rl) return rl;

    const user = await env.DB.prepare(
      `SELECT id, name, weight, goal_weight, target_calories, target_protein,
              target_carbs, target_fat, access_level, dietary_preferences
       FROM users WHERE id = ?`
    ).bind(auth.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);
    if (!user.target_calories) return errorResponse('Configura tu objetivo calórico en el perfil primero', 400);

    const limitCheck = await checkAndIncrementPlannerLimit(auth.userId, 'week', user.access_level, env);
    if (!limitCheck.allowed) {
      const msg = limitCheck.reason === 'blocked'
        ? 'El plan semanal es una función Pro.'
        : limitCheck.reason === 'day_limit'
          ? 'Has alcanzado el límite de planes semanales por hoy.'
          : 'Has alcanzado el límite semanal.';
      return jsonResponse({ error: msg, reason: limitCheck.reason, limits: limitCheck.limits }, 429);
    }

    try {
      const body = await request.json().catch(() => ({}));
      const userContext = (body.context || '').trim().slice(0, 500);

      const today = new Date();
      const todayISO = today.toLocaleDateString('en-CA');

      // Ventana de 14 días atrás (sin incluir hoy) para contexto
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fourteenDaysAgoISO = fourteenDaysAgo.toLocaleDateString('en-CA');

      const [todayEntries, calibRow, recentEntriesRes, recentHistory] = await Promise.all([
        env.DB.prepare(
          `SELECT meal_type, name, calories, protein, carbs, fat, created_at
           FROM entries WHERE user_id = ? AND date = ?
           ORDER BY created_at ASC`
        ).bind(auth.userId, todayISO).all(),

        env.DB.prepare(
          'SELECT frequent_meals FROM user_calibration WHERE user_id = ?'
        ).bind(auth.userId).first().catch(() => null),

        env.DB.prepare(
          `SELECT date, meal_type, name, calories
           FROM entries
           WHERE user_id = ? AND date >= ? AND date < ?
           ORDER BY date DESC, created_at ASC`
        ).bind(auth.userId, fourteenDaysAgoISO, todayISO).all().catch(() => ({ results: [] })),

        // history: 14 días de planes day + week
        getRecentPlannerHistory(auth.userId, 'day', 14, env),
      ]);

      const todayMeals = todayEntries.results || [];
      const recentEntries = recentEntriesRes.results || [];
      const recentPlannedDishes = extractRecentDishNames(recentHistory, 30);

      // Normalizar meal_types registrados hoy (inglés/español + inferencia por hora para 'other')
      const mealTypesRegistered = resolveMealTypesRegistered(todayMeals);

      const daysToPlan = computeDaysToPlan(today, mealTypesRegistered);

      let frequentMeals = [];
      try {
        if (calibRow?.frequent_meals) {
          frequentMeals = JSON.parse(calibRow.frequent_meals);
        }
      } catch {}

      let preferences = null;
      try {
        if (user.dietary_preferences) {
          preferences = typeof user.dietary_preferences === 'string'
            ? JSON.parse(user.dietary_preferences)
            : user.dietary_preferences;
        }
      } catch {}

      // Consumido hoy — kcal + macros. Usado tanto para inyectar target real
      // en el prompt (día parcial) como para calibración post-parse.
      const consumedToday = todayMeals.reduce((acc, e) => ({
        kcal:    acc.kcal    + (e.calories || 0),
        protein: acc.protein + (e.protein  || 0),
        carbs:   acc.carbs   + (e.carbs    || 0),
        fat:     acc.fat     + (e.fat      || 0),
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

      const userMessage = buildWeekPlanMessage({
        user,
        daysToPlan,
        todayMeals,
        consumedToday,
        frequentMeals,
        preferences,
        context: userContext,
        recentEntries,
        recentPlannedDishes,
      });

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4500,
          system: SYSTEM_PROMPT_WEEK,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!claudeRes.ok) {
        await rollbackPlannerLimit(auth.userId, 'week', env);
        const errText = await claudeRes.text().catch(() => 'Unknown error');
        console.error('[planner/week] Anthropic error:', claudeRes.status, errText);
        return errorResponse('Error al conectar con la IA. Inténtalo de nuevo.', 502);
      }

      const claudeData = await claudeRes.json();

      if (claudeData.stop_reason === 'max_tokens') {
        await rollbackPlannerLimit(auth.userId, 'week', env);
        return errorResponse('El plan semanal generado fue demasiado largo. Intenta añadir menos contexto.', 422);
      }

      const rawText = claudeData.content?.[0]?.text || '';

      let planData;
      try {
        planData = parseWeekPlanResponse(rawText);
      } catch (parseErr) {
        await rollbackPlannerLimit(auth.userId, 'week', env);
        console.error('[planner/week] JSON parse error:', parseErr.message, 'Raw:', rawText.slice(0, 500));
        return errorResponse('Error al procesar el plan generado. Inténtalo de nuevo.', 502);
      }

      // Enforce server-side: si hoy es parcial, filtrar meals de tipos ya
      // registrados. Sonnet a veces ignora la instrucción "solo lo que falta".
      if (planData.days?.length > 0 && mealTypesRegistered.length > 0) {
        const firstDay = planData.days[0];
        if (firstDay.date === todayISO) {
          const TYPE_MAP = {
            desayuno: 'desayuno', breakfast: 'desayuno',
            comida:   'comida',   lunch:     'comida',
            merienda: 'merienda', snack:     'merienda',
            cena:     'cena',     dinner:    'cena',
          };
          firstDay.meals = (firstDay.meals || []).filter(m => {
            const t = (m.type || '').toLowerCase();
            const normalized = TYPE_MAP[t] || t;
            return !mealTypesRegistered.includes(normalized);
          });
          firstDay.totals = recomputeTotals(firstDay.meals);
        }
      }

      // Calibrar porciones por día. Protein-aware: cada día mantiene el piso
      // de proteína del usuario; C+F absorben el ajuste kcal.
      // Acumulamos warnings para devolverlos en la respuesta.
      const weekWarnings = { off_budget_days: [], low_protein_days: [], over_budget_today: null };

      if (planData.days?.length > 0) {
        for (let i = 0; i < planData.days.length; i++) {
          const day = planData.days[i];
          const isFirstAndPartial = i === 0 && day.date === todayISO && consumedToday.kcal > 0;

          // Target del día: completo (target_calories) o parcial (restante).
          const dayTargetKcal = isFirstAndPartial
            ? (user.target_calories || 0) - consumedToday.kcal
            : (user.target_calories || 0);
          const dayTargetProtein = isFirstAndPartial
            ? Math.max(0, (user.target_protein || 0) - consumedToday.protein)
            : (user.target_protein || 0);

          // Día parcial con remaining <= 0 → usuario ya se pasó hoy. Saltamos
          // calibración; warning de over_budget_today.
          if (isFirstAndPartial && dayTargetKcal <= 0) {
            weekWarnings.over_budget_today = { exceeded_by_kcal: Math.abs(dayTargetKcal) };
            continue;
          }

          const calRes = calibrateMeals(day.meals, {
            kcal:    dayTargetKcal,
            protein: dayTargetProtein > 0 ? dayTargetProtein : undefined,
          });
          if (calRes.calibrated) {
            day.totals = recomputeTotals(day.meals);
          }

          // Warning: plan del día extremo (Sonnet muy fuera de rango).
          if (calRes.extreme) {
            weekWarnings.off_budget_days.push({
              date: day.date,
              actual_kcal: calRes.originalKcal,
              target_kcal: dayTargetKcal,
              diff: calRes.originalKcal - dayTargetKcal,
            });
          }

          // Warning: proteína total del día < 85% del piso del usuario.
          if (dayTargetProtein > 0 && day.totals?.protein != null) {
            const floor = dayTargetProtein * 0.85;
            if (day.totals.protein < floor) {
              weekWarnings.low_protein_days.push({
                date: day.date,
                actual_g: day.totals.protein,
                target_g: dayTargetProtein,
              });
            }
          }
        }

        // Recalcular totals semanales tras todos los ajustes
        planData.week_totals = {
          kcal:    planData.days.reduce((s, d) => s + (d.totals?.kcal    || 0), 0),
          protein: planData.days.reduce((s, d) => s + (d.totals?.protein || 0), 0),
          carbs:   planData.days.reduce((s, d) => s + (d.totals?.carbs   || 0), 0),
          fat:     planData.days.reduce((s, d) => s + (d.totals?.fat     || 0), 0),
        };
      }

      await env.DB.prepare(
        'INSERT INTO ai_usage_logs (user_id, input_tokens, output_tokens, model, feature, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
      ).bind(
        auth.userId,
        claudeData.usage?.input_tokens || 0,
        claudeData.usage?.output_tokens || 0,
        'claude-sonnet-4-6',
        'chef_week'
      ).run().catch(() => {});

      await savePlannerHistory(auth.userId, 'week', planData, env);

      return jsonResponse({
        plan: planData,
        target_kcal: user.target_calories,
        target_macros: {
          protein: user.target_protein,
          carbs: user.target_carbs,
          fat: user.target_fat,
        },
        warnings: {
          off_budget_days: weekWarnings.off_budget_days.length ? weekWarnings.off_budget_days : null,
          low_protein_days: weekWarnings.low_protein_days.length ? weekWarnings.low_protein_days : null,
          over_budget_today: weekWarnings.over_budget_today,
        },
        usage: {
          remaining_day: limitCheck.remainingDay,
          remaining_week: limitCheck.remainingWeek,
        },
      });

    } catch (err) {
      await rollbackPlannerLimit(auth.userId, 'week', env);
      console.error('[planner/week] Unexpected error:', err.message);
      return errorResponse('Error inesperado al generar el plan semanal.', 500);
    }
  }

  // ── GET /api/planner/day/current — Último plan del día guardado ──
  if (path === '/api/planner/day/current' && request.method === 'GET') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);

    const user = await env.DB.prepare(
      'SELECT target_calories FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    const today = new Date().toLocaleDateString('en-CA');
    const row = await env.DB.prepare(
      `SELECT plan_json, created_at FROM planner_history
       WHERE user_id = ? AND feature = 'day' AND date = ?
       ORDER BY created_at DESC LIMIT 1`
    ).bind(auth.userId, today).first();

    if (!row) return jsonResponse({ plan: null });

    let plan;
    try { plan = JSON.parse(row.plan_json); }
    catch { return jsonResponse({ plan: null }); }

    return jsonResponse({
      plan,
      target_kcal: user?.target_calories || 0,
      generated_at: row.created_at,
    });
  }

  // ── GET /api/planner/week/current — Último plan semanal de la semana en curso ──
  if (path === '/api/planner/week/current' && request.method === 'GET') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);

    const user = await env.DB.prepare(
      'SELECT target_calories FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    // Lunes de la semana en curso (YYYY-MM-DD local)
    const now = new Date();
    const dow = now.getDay(); // 0=dom
    const offset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + offset);
    const weekStart = monday.toLocaleDateString('en-CA');

    const row = await env.DB.prepare(
      `SELECT plan_json, created_at, date FROM planner_history
       WHERE user_id = ? AND feature = 'week' AND date >= ?
       ORDER BY created_at DESC LIMIT 1`
    ).bind(auth.userId, weekStart).first();

    if (!row) return jsonResponse({ plan: null });

    let plan;
    try { plan = JSON.parse(row.plan_json); }
    catch { return jsonResponse({ plan: null }); }

    return jsonResponse({
      plan,
      target_kcal: user?.target_calories || 0,
      generated_at: row.created_at,
      generated_date: row.date,
    });
  }

  // ── POST /api/planner/day/save — Persistir plan editado manualmente ──
  // No consume cuota (no llama a Sonnet). Guarda un row nuevo en
  // planner_history que gana al anterior vía ORDER BY created_at DESC.
  if (path === '/api/planner/day/save' && request.method === 'POST') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);

    // Burst protection (edits rápidas no deben crear 50 rows por segundo).
    const rl = await rateLimit(env, request, `planner-save-day:${auth.userId}`, 30, 60);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const plan = body.plan;

    // Validación de estructura mínima
    if (!plan || !Array.isArray(plan.meals) || plan.meals.length === 0) {
      return errorResponse('Plan inválido: falta meals[]', 400);
    }
    for (const m of plan.meals) {
      if (!m || typeof m.name !== 'string' || !m.name.trim()) {
        return errorResponse('Plan inválido: meal sin nombre', 400);
      }
      if (typeof m.kcal !== 'number' || m.kcal < 0 || m.kcal > 5000) {
        return errorResponse('Plan inválido: kcal fuera de rango', 400);
      }
    }

    await savePlannerHistory(auth.userId, 'day', plan, env);
    return jsonResponse({ saved: true });
  }

  // ── POST /api/planner/week/save — Persistir plan semanal editado ──
  if (path === '/api/planner/week/save' && request.method === 'POST') {
    const auth = await authenticate(request, env);
    if (!auth) return errorResponse('No autorizado', 401);

    const rl = await rateLimit(env, request, `planner-save-week:${auth.userId}`, 30, 60);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const plan = body.plan;

    if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
      return errorResponse('Plan inválido: falta days[]', 400);
    }
    for (const day of plan.days) {
      if (!day || !day.date || !Array.isArray(day.meals)) {
        return errorResponse('Plan inválido: día mal formado', 400);
      }
      for (const m of day.meals) {
        if (!m || typeof m.name !== 'string' || !m.name.trim()) {
          return errorResponse('Plan inválido: meal sin nombre', 400);
        }
        if (typeof m.kcal !== 'number' || m.kcal < 0 || m.kcal > 5000) {
          return errorResponse('Plan inválido: kcal fuera de rango', 400);
        }
      }
    }

    await savePlannerHistory(auth.userId, 'week', plan, env);
    return jsonResponse({ saved: true });
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

// ============================================================
//  Helpers internos
// ============================================================

/**
 * Construye el objeto `warnings` para la respuesta del plan del día.
 * Todos los campos son nullable — ninguno se renderiza si no aplica.
 * El cliente puede ignorarlos (campos aditivos, cero retrocompat risk).
 *
 * @param {{
 *   planData: {meals: Array, totals: {kcal,protein,carbs,fat}},
 *   remaining: {kcal,protein,carbs,fat},
 *   calibration: {calibrated, factor?, originalKcal?, extreme?, overBudgetSkipped?},
 *   isOverBudget: boolean,
 *   targetProtein: number|null,
 * }} params
 * @returns {{
 *   off_budget: {actual_kcal,target_kcal,diff}|null,
 *   low_protein: {actual_g,target_g}|null,
 *   over_budget: {exceeded_by_kcal}|null,
 * }}
 */
function buildDayWarnings({ planData, remaining, calibration, isOverBudget, targetProtein }) {
  const warnings = {
    off_budget: null,
    low_protein: null,
    over_budget: null,
  };

  // Over-budget: usuario ya se pasó antes de generar. Avisar al cliente
  // para que muestre "te has pasado X kcal" en lugar de un contador a 0.
  if (isOverBudget) {
    warnings.over_budget = { exceeded_by_kcal: Math.abs(remaining.kcal) };
  }

  // Off-budget: Sonnet se salió del rango calibrable (<0.70 o >1.40). Antes
  // se devolvía el plan sin flag; ahora se avisa para que el cliente pueda
  // mostrar "el plan está X kcal fuera de tu objetivo".
  if (calibration?.extreme) {
    warnings.off_budget = {
      actual_kcal: calibration.originalKcal,
      target_kcal: remaining.kcal,
      diff: calibration.originalKcal - remaining.kcal,
    };
  }

  // Low-protein: tras calibración, si el plan cubre < 85% de la proteína
  // pendiente, flag. Umbral nutricional pragmático (1.6g/kg es el piso,
  // 85% = un pequeño margen antes de alertar).
  if (typeof targetProtein === 'number' && targetProtein > 0 && remaining.protein > 0) {
    const floor = remaining.protein * 0.85;
    const actual = planData?.totals?.protein ?? 0;
    if (actual < floor) {
      warnings.low_protein = {
        actual_g: actual,
        target_g: Math.round(remaining.protein),
      };
    }
  }

  return warnings;
}
