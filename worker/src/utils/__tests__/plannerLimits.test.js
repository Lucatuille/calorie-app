import { describe, it, expect, beforeEach } from 'vitest';
import {
  PLANNER_LIMITS,
  checkAndIncrementPlannerLimit,
  rollbackPlannerLimit,
  getPlannerUsage,
} from '../plannerLimits.js';

// ── Mock D1: memoria simple ────────────────────────────────
// Usamos un mapa (user_id|feature|date) → count para simular la tabla.

function todayISO() {
  return new Date().toLocaleDateString('en-CA');
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

function makeMockDB() {
  const rows = new Map(); // key: `${uid}|${feature}|${date}` → count

  const prepare = (sql) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    const binds = [];
    return {
      bind(...args) { binds.push(...args); return this; },
      async first() {
        if (s.startsWith('SELECT count FROM planner_usage')) {
          const [uid, feature, date] = binds;
          const count = rows.get(`${uid}|${feature}|${date}`);
          return count == null ? null : { count };
        }
        if (s.startsWith('SELECT COALESCE(SUM(count), 0) AS total FROM planner_usage')) {
          const [uid, feature, fromDate] = binds;
          let total = 0;
          for (const [key, val] of rows.entries()) {
            const [u, f, d] = key.split('|');
            if (u === String(uid) && f === feature && d >= fromDate) total += val;
          }
          return { total };
        }
        return null;
      },
      async run() {
        if (s.startsWith('INSERT INTO planner_usage')) {
          const [uid, feature, date] = binds;
          const key = `${uid}|${feature}|${date}`;
          rows.set(key, (rows.get(key) ?? 0) + 1);
          return { success: true };
        }
        if (s.startsWith('UPDATE planner_usage SET count = MAX(0, count - 1)')) {
          const [uid, feature, date] = binds;
          const key = `${uid}|${feature}|${date}`;
          const cur = rows.get(key) ?? 0;
          rows.set(key, Math.max(0, cur - 1));
          return { success: true };
        }
        return { success: true };
      },
    };
  };

  return {
    DB: { prepare },
    _rows: rows,
    _reset() { rows.clear(); },
  };
}

// ── PLANNER_LIMITS config ──────────────────────────────────

describe('PLANNER_LIMITS config', () => {
  it('Free tiene 2/semana en suggest y 0 en day/week', () => {
    expect(PLANNER_LIMITS.suggest[3]).toEqual({ day: 0, week: 2 });
    expect(PLANNER_LIMITS.day[3]).toEqual({ day: 0, week: 0 });
    expect(PLANNER_LIMITS.week[3]).toEqual({ day: 0, week: 0 });
  });

  it('Pro tiene limites razonables', () => {
    expect(PLANNER_LIMITS.suggest[2].day).toBe(10);
    expect(PLANNER_LIMITS.day[2].day).toBe(2);
    expect(PLANNER_LIMITS.week[2].day).toBe(1);
  });

  it('Admin es Infinity en todo', () => {
    expect(PLANNER_LIMITS.suggest[99].day).toBe(Infinity);
    expect(PLANNER_LIMITS.day[99].day).toBe(Infinity);
    expect(PLANNER_LIMITS.week[99].day).toBe(Infinity);
  });
});

// ── checkAndIncrementPlannerLimit ──────────────────────────

describe('checkAndIncrementPlannerLimit — Free user (access_level=3)', () => {
  let env;
  beforeEach(() => { env = makeMockDB(); });

  it('permite 2 llamadas de suggest en la semana', async () => {
    const r1 = await checkAndIncrementPlannerLimit(42, 'suggest', 3, env);
    expect(r1.allowed).toBe(true);
    expect(r1.remainingWeek).toBe(1);

    const r2 = await checkAndIncrementPlannerLimit(42, 'suggest', 3, env);
    expect(r2.allowed).toBe(true);
    expect(r2.remainingWeek).toBe(0);
  });

  it('bloquea la 3a llamada de suggest por week_limit', async () => {
    await checkAndIncrementPlannerLimit(42, 'suggest', 3, env);
    await checkAndIncrementPlannerLimit(42, 'suggest', 3, env);
    const r3 = await checkAndIncrementPlannerLimit(42, 'suggest', 3, env);
    expect(r3.allowed).toBe(false);
    expect(r3.reason).toBe('week_limit');
  });

  it('bloquea day completamente con reason blocked', async () => {
    const r = await checkAndIncrementPlannerLimit(42, 'day', 3, env);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('blocked');
  });

  it('bloquea week completamente con reason blocked', async () => {
    const r = await checkAndIncrementPlannerLimit(42, 'week', 3, env);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('blocked');
  });
});

describe('checkAndIncrementPlannerLimit — Pro user (access_level=2)', () => {
  let env;
  beforeEach(() => { env = makeMockDB(); });

  it('permite hasta 10 suggests al dia', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);
      expect(r.allowed).toBe(true);
    }
    const r11 = await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);
    expect(r11.allowed).toBe(false);
    expect(r11.reason).toBe('day_limit');
  });

  it('permite hasta 2 day planners al dia', async () => {
    const r1 = await checkAndIncrementPlannerLimit(7, 'day', 2, env);
    const r2 = await checkAndIncrementPlannerLimit(7, 'day', 2, env);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r2.remainingDay).toBe(0);

    const r3 = await checkAndIncrementPlannerLimit(7, 'day', 2, env);
    expect(r3.allowed).toBe(false);
    expect(r3.reason).toBe('day_limit');
  });

  it('permite 1 plan semanal al dia', async () => {
    const r1 = await checkAndIncrementPlannerLimit(7, 'week', 2, env);
    expect(r1.allowed).toBe(true);
    expect(r1.remainingDay).toBe(0);

    const r2 = await checkAndIncrementPlannerLimit(7, 'week', 2, env);
    expect(r2.allowed).toBe(false);
    expect(r2.reason).toBe('day_limit');
  });
});

describe('checkAndIncrementPlannerLimit — Admin (access_level=99)', () => {
  it('nunca bloquea', async () => {
    const env = makeMockDB();
    for (let i = 0; i < 50; i++) {
      const r = await checkAndIncrementPlannerLimit(1, 'week', 99, env);
      expect(r.allowed).toBe(true);
    }
  });
});

// ── rollback ───────────────────────────────────────────────

describe('rollbackPlannerLimit', () => {
  it('decrementa el contador del dia', async () => {
    const env = makeMockDB();
    await checkAndIncrementPlannerLimit(42, 'suggest', 2, env);
    await checkAndIncrementPlannerLimit(42, 'suggest', 2, env);

    const today = todayISO();
    expect(env._rows.get(`42|suggest|${today}`)).toBe(2);

    await rollbackPlannerLimit(42, 'suggest', env);
    expect(env._rows.get(`42|suggest|${today}`)).toBe(1);
  });

  it('nunca baja de 0', async () => {
    const env = makeMockDB();
    await rollbackPlannerLimit(42, 'suggest', env);
    await rollbackPlannerLimit(42, 'suggest', env);
    const today = todayISO();
    const count = env._rows.get(`42|suggest|${today}`);
    expect(count == null || count === 0).toBe(true);
  });

  it('rollback tras fallo mantiene capacidad para reintentar', async () => {
    const env = makeMockDB();
    // Usuario Pro hace 10 suggests hoy → alcanza el limite
    for (let i = 0; i < 10; i++) {
      await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);
    }
    // La 11a falla
    const blocked = await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);
    expect(blocked.allowed).toBe(false);

    // Simulamos que una de las 10 anteriores fallo por error Anthropic → rollback
    await rollbackPlannerLimit(7, 'suggest', env);

    // Ahora puede reintentar
    const retry = await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);
    expect(retry.allowed).toBe(true);
  });
});

// ── getPlannerUsage ────────────────────────────────────────

describe('getPlannerUsage', () => {
  it('Free usuario sin uso: remaining week=2 en suggest, blocked en day y week', async () => {
    const env = makeMockDB();
    const usage = await getPlannerUsage(42, 3, env);
    expect(usage.suggest.remaining_week).toBe(2);
    expect(usage.suggest.limit_week).toBe(2);
    expect(usage.day.blocked).toBe(true);
    expect(usage.week.blocked).toBe(true);
  });

  it('Pro usuario tras 3 suggests: remaining_day=7', async () => {
    const env = makeMockDB();
    await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);
    await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);
    await checkAndIncrementPlannerLimit(7, 'suggest', 2, env);

    const usage = await getPlannerUsage(7, 2, env);
    expect(usage.suggest.used_day).toBe(3);
    expect(usage.suggest.remaining_day).toBe(7);
    expect(usage.day.remaining_day).toBe(2);
    expect(usage.week.remaining_day).toBe(1);
  });
});
