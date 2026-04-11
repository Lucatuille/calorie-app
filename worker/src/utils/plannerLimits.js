// ============================================================
//  plannerLimits — rate limit atómico para Chef Caliro.
//
//  Soporta dos dimensiones: diaria Y semanal (rolling 7 días),
//  segmentado por feature ('suggest' | 'day' | 'week') y access_level.
//
//  Patrón: increment ANTES de llamar a Claude. Si Claude falla,
//  rollback (decremento). Así se elimina la ventana de race
//  condition en llamadas concurrentes.
//
//  Requiere la tabla `planner_usage` (ver migration chef-caliro-schema.sql).
// ============================================================

// Config — editable sin tocar la lógica del helper.
// Niveles: 0=Waitlist, 1=Founder, 2=Pro, 3=Free, 99=Admin
// week: Infinity significa "sin límite semanal, solo respetar el diario".
export const PLANNER_LIMITS = {
  suggest: {
    0: { day: 0,        week: 0        }, // Waitlist: bloqueado
    1: { day: 20,       week: Infinity }, // Founder
    2: { day: 10,       week: Infinity }, // Pro
    3: { day: 0,        week: 2        }, // Free: 2 por semana
    99:{ day: Infinity, week: Infinity }, // Admin
  },
  day: {
    0: { day: 0,        week: 0        },
    1: { day: 5,        week: Infinity },
    2: { day: 2,        week: Infinity },
    3: { day: 0,        week: 0        }, // Free: bloqueado
    99:{ day: Infinity, week: Infinity },
  },
  week: {
    0: { day: 0,        week: 0        },
    1: { day: 3,        week: Infinity },
    2: { day: 1,        week: Infinity },
    3: { day: 0,        week: 0        }, // Free: bloqueado
    99:{ day: Infinity, week: Infinity },
  },
};

const FEATURES = ['suggest', 'day', 'week'];

function todayISO() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en zona local
}

function sevenDaysAgoISO() {
  // Ventana rolling de 7 días (hoy incluido → -6 días)
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString('en-CA');
}

function getLimits(feature, accessLevel) {
  const byFeature = PLANNER_LIMITS[feature];
  if (!byFeature) return { day: 0, week: 0 };
  return byFeature[accessLevel] ?? byFeature[3]; // fallback a Free
}

/**
 * Verifica si el usuario puede hacer una llamada al feature del planner,
 * y si puede, incrementa el contador atómicamente.
 *
 * @returns { allowed, reason?, remainingDay?, remainingWeek?, limits }
 *   - allowed: true si la llamada está permitida (ya se incrementó el contador).
 *   - reason: 'day_limit' | 'week_limit' | 'blocked' si allowed=false.
 *   - remainingDay, remainingWeek: cuántas llamadas le quedan tras esta.
 *   - limits: los límites aplicables (para devolver al cliente).
 */
export async function checkAndIncrementPlannerLimit(userId, feature, accessLevel, env) {
  const limits = getLimits(feature, accessLevel);

  // Acceso completamente bloqueado (Waitlist o Free en day/week)
  if (limits.day === 0 && limits.week === 0) {
    return { allowed: false, reason: 'blocked', limits };
  }

  const today = todayISO();

  // Convención: limit = 0 significa "esta dimensión no aplica, usa la otra".
  // Bloqueo total ya está capturado arriba (ambos = 0 → blocked).
  const dayApplies  = limits.day  > 0 && limits.day  !== Infinity;
  const weekApplies = limits.week > 0 && limits.week !== Infinity;

  // Check día
  if (dayApplies) {
    const dayRow = await env.DB.prepare(
      'SELECT count FROM planner_usage WHERE user_id = ? AND feature = ? AND date = ?'
    ).bind(userId, feature, today).first();
    const dayCount = dayRow?.count ?? 0;
    if (dayCount >= limits.day) {
      return { allowed: false, reason: 'day_limit', limits };
    }
  }

  // Check semana
  if (weekApplies) {
    const weekStart = sevenDaysAgoISO();
    const weekRow = await env.DB.prepare(
      'SELECT COALESCE(SUM(count), 0) AS total FROM planner_usage WHERE user_id = ? AND feature = ? AND date >= ?'
    ).bind(userId, feature, weekStart).first();
    const weekCount = weekRow?.total ?? 0;
    if (weekCount >= limits.week) {
      return { allowed: false, reason: 'week_limit', limits };
    }
  }

  // Increment atómico — ON CONFLICT para crear o sumar
  await env.DB.prepare(
    `INSERT INTO planner_usage (user_id, feature, date, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, feature, date) DO UPDATE SET count = count + 1`
  ).bind(userId, feature, today).run();

  // Calcular remaining tras el incremento
  let remainingDay  = Infinity;
  let remainingWeek = Infinity;

  if (dayApplies) {
    const dayRow2 = await env.DB.prepare(
      'SELECT count FROM planner_usage WHERE user_id = ? AND feature = ? AND date = ?'
    ).bind(userId, feature, today).first();
    remainingDay = Math.max(0, limits.day - (dayRow2?.count ?? 0));
  }
  if (weekApplies) {
    const weekStart = sevenDaysAgoISO();
    const weekRow2 = await env.DB.prepare(
      'SELECT COALESCE(SUM(count), 0) AS total FROM planner_usage WHERE user_id = ? AND feature = ? AND date >= ?'
    ).bind(userId, feature, weekStart).first();
    remainingWeek = Math.max(0, limits.week - (weekRow2?.total ?? 0));
  }

  return { allowed: true, remainingDay, remainingWeek, limits };
}

/**
 * Decrementa el contador del día actual — usar si Claude o el parse
 * fallan tras incrementar. Nunca baja de 0.
 */
export async function rollbackPlannerLimit(userId, feature, env) {
  const today = todayISO();
  await env.DB.prepare(
    'UPDATE planner_usage SET count = MAX(0, count - 1) WHERE user_id = ? AND feature = ? AND date = ?'
  ).bind(userId, feature, today).run().catch(() => {});
}

/**
 * Devuelve el uso actual de los 3 features para GET /api/planner/usage.
 * No incrementa nada — solo consulta.
 */
export async function getPlannerUsage(userId, accessLevel, env) {
  const today = todayISO();
  const weekStart = sevenDaysAgoISO();

  const usage = {};

  for (const feature of FEATURES) {
    const limits      = getLimits(feature, accessLevel);
    const dayApplies  = limits.day  > 0 && limits.day  !== Infinity;
    const weekApplies = limits.week > 0 && limits.week !== Infinity;

    let dayCount  = 0;
    let weekCount = 0;

    if (dayApplies) {
      const dayRow = await env.DB.prepare(
        'SELECT count FROM planner_usage WHERE user_id = ? AND feature = ? AND date = ?'
      ).bind(userId, feature, today).first();
      dayCount = dayRow?.count ?? 0;
    }

    if (weekApplies) {
      const weekRow = await env.DB.prepare(
        'SELECT COALESCE(SUM(count), 0) AS total FROM planner_usage WHERE user_id = ? AND feature = ? AND date >= ?'
      ).bind(userId, feature, weekStart).first();
      weekCount = weekRow?.total ?? 0;
    }

    usage[feature] = {
      used_day:       dayApplies  ? dayCount  : null,
      used_week:      weekApplies ? weekCount : null,
      limit_day:      dayApplies  ? limits.day  : null,
      limit_week:     weekApplies ? limits.week : null,
      remaining_day:  dayApplies  ? Math.max(0, limits.day  - dayCount)  : null,
      remaining_week: weekApplies ? Math.max(0, limits.week - weekCount) : null,
      blocked:        limits.day === 0 && limits.week === 0,
    };
  }

  return usage;
}
