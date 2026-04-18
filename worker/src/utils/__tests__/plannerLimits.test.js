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
  it('Features disponibles: day + week (suggest descartado 2026-04-18)', () => {
    expect(Object.keys(PLANNER_LIMITS).sort()).toEqual(['day', 'week']);
    expect(PLANNER_LIMITS.suggest).toBeUndefined();
  });

  it('Free tiene day y week bloqueados (0/0)', () => {
    expect(PLANNER_LIMITS.day[3]).toEqual({ day: 0, week: 0 });
    expect(PLANNER_LIMITS.week[3]).toEqual({ day: 0, week: 0 });
  });

  it('Pro tiene limites razonables', () => {
    expect(PLANNER_LIMITS.day[2].day).toBe(2);
    expect(PLANNER_LIMITS.week[2].day).toBe(1);
  });

  it('Admin es Infinity en todo', () => {
    expect(PLANNER_LIMITS.day[99].day).toBe(Infinity);
    expect(PLANNER_LIMITS.week[99].day).toBe(Infinity);
  });
});

// ── checkAndIncrementPlannerLimit ──────────────────────────

describe('checkAndIncrementPlannerLimit — Free user (access_level=3)', () => {
  let env;
  beforeEach(() => { env = makeMockDB(); });

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

  it('permite hasta 5 day planners al dia para Founder (access_level=1)', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await checkAndIncrementPlannerLimit(11, 'day', 1, env);
      expect(r.allowed).toBe(true);
    }
    const r6 = await checkAndIncrementPlannerLimit(11, 'day', 1, env);
    expect(r6.allowed).toBe(false);
    expect(r6.reason).toBe('day_limit');
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
    // Pro tiene 2/day, Founder tiene 5/day — usamos Founder para tener margen
    await checkAndIncrementPlannerLimit(42, 'day', 1, env);
    await checkAndIncrementPlannerLimit(42, 'day', 1, env);

    const today = todayISO();
    expect(env._rows.get(`42|day|${today}`)).toBe(2);

    await rollbackPlannerLimit(42, 'day', env);
    expect(env._rows.get(`42|day|${today}`)).toBe(1);
  });

  it('nunca baja de 0', async () => {
    const env = makeMockDB();
    await rollbackPlannerLimit(42, 'day', env);
    await rollbackPlannerLimit(42, 'day', env);
    const today = todayISO();
    const count = env._rows.get(`42|day|${today}`);
    expect(count == null || count === 0).toBe(true);
  });

  it('rollback tras fallo mantiene capacidad para reintentar', async () => {
    const env = makeMockDB();
    // Usuario Pro hace 2 day planners → alcanza el limite
    await checkAndIncrementPlannerLimit(7, 'day', 2, env);
    await checkAndIncrementPlannerLimit(7, 'day', 2, env);
    // La 3a falla
    const blocked = await checkAndIncrementPlannerLimit(7, 'day', 2, env);
    expect(blocked.allowed).toBe(false);

    // Simulamos que uno anterior fallo por error Anthropic → rollback
    await rollbackPlannerLimit(7, 'day', env);

    // Ahora puede reintentar
    const retry = await checkAndIncrementPlannerLimit(7, 'day', 2, env);
    expect(retry.allowed).toBe(true);
  });
});

// ── getPlannerUsage ────────────────────────────────────────

describe('getPlannerUsage', () => {
  it('Free usuario: day y week bloqueados, no expone feature suggest', async () => {
    const env = makeMockDB();
    const usage = await getPlannerUsage(42, 3, env);
    expect(usage.day.blocked).toBe(true);
    expect(usage.week.blocked).toBe(true);
    expect(usage.suggest).toBeUndefined();
  });

  it('Pro usuario tras 1 plan día: remaining_day=1', async () => {
    const env = makeMockDB();
    await checkAndIncrementPlannerLimit(7, 'day', 2, env);

    const usage = await getPlannerUsage(7, 2, env);
    expect(usage.day.used_day).toBe(1);
    expect(usage.day.remaining_day).toBe(1);
    expect(usage.week.remaining_day).toBe(1);
  });
});
