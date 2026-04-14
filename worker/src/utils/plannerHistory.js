// ============================================================
//  plannerHistory — persistencia de planes generados por Sonnet.
//
//  Uso:
//    await savePlannerHistory(userId, 'day', planObject, env);
//    const recent = await getRecentPlannerHistory(userId, 'day', 3, env);
//
//  Los planes se guardan como JSON string. Al leerlos se parsean.
//  Si el JSON está corrupto, esa fila se omite silenciosamente.
//
//  Requiere la tabla `planner_history` (ver chef-planner-history.sql).
// ============================================================

/**
 * Guarda un plan generado en el histórico.
 * No lanza errores — si falla, solo loguea. El flujo del planner
 * no debe bloquearse por un problema de historial.
 *
 * @param {number} userId
 * @param {'day'|'week'} feature
 * @param {object} plan — objeto serializable
 * @param {object} env
 */
export async function savePlannerHistory(userId, feature, plan, env) {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const now   = Date.now();
    const json  = JSON.stringify(plan);
    await env.DB.prepare(
      `INSERT INTO planner_history (user_id, feature, date, plan_json, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, feature, today, json, now).run();
  } catch (err) {
    console.error('[plannerHistory.save]', err.message);
  }
}

/**
 * Lee los últimos N días de histórico para un feature.
 * @returns {Array} — filas ordenadas descendentemente por fecha,
 *                   con plan ya parseado. Filas con JSON inválido se omiten.
 */
export async function getRecentPlannerHistory(userId, feature, daysBack, env) {
  try {
    const from = new Date();
    from.setDate(from.getDate() - daysBack);
    const fromISO = from.toLocaleDateString('en-CA');

    const res = await env.DB.prepare(
      `SELECT date, plan_json FROM planner_history
       WHERE user_id = ? AND feature = ? AND date >= ?
       ORDER BY date DESC, created_at DESC`
    ).bind(userId, feature, fromISO).all();

    const rows = res.results || [];
    return rows
      .map(r => {
        try {
          return { date: r.date, plan: JSON.parse(r.plan_json) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[plannerHistory.getRecent]', err.message);
    return [];
  }
}

/**
 * Extrae nombres de platos de los últimos N planes (day o week).
 * Útil para inyectar en prompts como "no repitas estos platos".
 *
 * @param {Array} history — salida de getRecentPlannerHistory
 * @param {number} maxNames — corte (por defecto 30)
 * @returns {string[]} — nombres únicos de platos recientes
 */
export function extractRecentDishNames(history, maxNames = 30) {
  const names = new Set();

  for (const entry of history) {
    const plan = entry.plan || {};

    // Formato day: { meals: [{name,...}], totals: {...} }
    if (Array.isArray(plan.meals)) {
      for (const m of plan.meals) {
        if (m?.name) names.add(m.name.trim());
      }
    }

    // Formato week: { days: [{ meals: [...] }, ...] }
    if (Array.isArray(plan.days)) {
      for (const day of plan.days) {
        if (Array.isArray(day?.meals)) {
          for (const m of day.meals) {
            if (m?.name) names.add(m.name.trim());
          }
        }
      }
    }

    if (names.size >= maxNames) break;
  }

  return Array.from(names).slice(0, maxNames);
}
