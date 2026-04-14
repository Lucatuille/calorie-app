// ============================================================
//  TESTS — plannerHistory
//  Ejecutar: cd worker && npx vitest run src/utils/__tests__/plannerHistory.test.js
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePlannerHistory,
  getRecentPlannerHistory,
  extractRecentDishNames,
} from '../plannerHistory.js';

// ── Mock D1 — array de filas en memoria ─────────────────────

function makeMockEnv() {
  const rows = []; // filas simuladas de planner_history

  const prepare = (sql) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    const binds = [];
    return {
      bind(...args) { binds.push(...args); return this; },
      async run() {
        if (s.startsWith('INSERT INTO planner_history')) {
          const [user_id, feature, date, plan_json, created_at] = binds;
          rows.push({
            id: rows.length + 1,
            user_id, feature, date, plan_json, created_at,
          });
          return { success: true };
        }
        return { success: true };
      },
      async all() {
        if (s.includes('FROM planner_history')) {
          const [user_id, feature, fromDate] = binds;
          const out = rows
            .filter(r =>
              String(r.user_id) === String(user_id) &&
              r.feature === feature &&
              r.date >= fromDate
            )
            .sort((a, b) => {
              if (a.date !== b.date) return b.date.localeCompare(a.date);
              return (b.created_at || 0) - (a.created_at || 0);
            });
          return { results: out };
        }
        return { results: [] };
      },
    };
  };

  return {
    DB: { prepare },
    _rows: rows,
    _reset() { rows.length = 0; },
  };
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA');
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

// ── Tests ───────────────────────────────────────────────────

describe('savePlannerHistory', () => {
  let env;
  beforeEach(() => { env = makeMockEnv(); });

  it('guarda un plan serializado', async () => {
    const plan = { meals: [{ name: 'Pechuga', kcal: 420 }] };
    await savePlannerHistory(7, 'day', plan, env);
    expect(env._rows).toHaveLength(1);
    const row = env._rows[0];
    expect(row.user_id).toBe(7);
    expect(row.feature).toBe('day');
    expect(row.date).toBe(todayISO());
    expect(JSON.parse(row.plan_json)).toEqual(plan);
    expect(typeof row.created_at).toBe('number');
  });

  it('guarda planes week igual', async () => {
    const plan = { days: [{ date: '2026-04-14', meals: [] }] };
    await savePlannerHistory(7, 'week', plan, env);
    expect(env._rows[0].feature).toBe('week');
  });

  it('no lanza si DB falla (silencioso)', async () => {
    const brokenEnv = {
      DB: { prepare: () => { throw new Error('DB unavailable'); } },
    };
    await expect(savePlannerHistory(1, 'day', {}, brokenEnv)).resolves.toBeUndefined();
  });
});

describe('getRecentPlannerHistory', () => {
  let env;
  beforeEach(() => { env = makeMockEnv(); });

  it('devuelve array vacío si no hay planes', async () => {
    const result = await getRecentPlannerHistory(1, 'day', 3, env);
    expect(result).toEqual([]);
  });

  it('devuelve planes de los últimos N días', async () => {
    // Simular 3 planes: uno hace 1 día, otro hace 5 días, otro hace 10 días.
    env._rows.push(
      { user_id: 1, feature: 'day', date: daysAgoISO(1), plan_json: JSON.stringify({ meals: [{ name: 'A' }] }), created_at: 1 },
      { user_id: 1, feature: 'day', date: daysAgoISO(5), plan_json: JSON.stringify({ meals: [{ name: 'B' }] }), created_at: 2 },
      { user_id: 1, feature: 'day', date: daysAgoISO(10), plan_json: JSON.stringify({ meals: [{ name: 'C' }] }), created_at: 3 },
    );
    const result = await getRecentPlannerHistory(1, 'day', 3, env);
    // Solo el de hace 1 día cae dentro del window de 3 días.
    expect(result).toHaveLength(1);
    expect(result[0].plan.meals[0].name).toBe('A');
  });

  it('ordena DESC por fecha', async () => {
    env._rows.push(
      { user_id: 1, feature: 'day', date: daysAgoISO(1), plan_json: JSON.stringify({ n: 1 }), created_at: 10 },
      { user_id: 1, feature: 'day', date: todayISO(), plan_json: JSON.stringify({ n: 2 }), created_at: 20 },
    );
    const result = await getRecentPlannerHistory(1, 'day', 7, env);
    expect(result[0].plan.n).toBe(2); // hoy primero
    expect(result[1].plan.n).toBe(1);
  });

  it('filtra por feature', async () => {
    env._rows.push(
      { user_id: 1, feature: 'day',  date: todayISO(), plan_json: JSON.stringify({ kind: 'D' }), created_at: 1 },
      { user_id: 1, feature: 'week', date: todayISO(), plan_json: JSON.stringify({ kind: 'W' }), created_at: 2 },
    );
    const dayResult  = await getRecentPlannerHistory(1, 'day', 7, env);
    const weekResult = await getRecentPlannerHistory(1, 'week', 7, env);
    expect(dayResult).toHaveLength(1);
    expect(dayResult[0].plan.kind).toBe('D');
    expect(weekResult[0].plan.kind).toBe('W');
  });

  it('filtra por user_id', async () => {
    env._rows.push(
      { user_id: 1, feature: 'day', date: todayISO(), plan_json: '{}', created_at: 1 },
      { user_id: 2, feature: 'day', date: todayISO(), plan_json: '{}', created_at: 2 },
    );
    const result = await getRecentPlannerHistory(2, 'day', 7, env);
    expect(result).toHaveLength(1);
  });

  it('omite filas con JSON corrupto (no lanza)', async () => {
    env._rows.push(
      { user_id: 1, feature: 'day', date: todayISO(), plan_json: '{broken json',      created_at: 1 },
      { user_id: 1, feature: 'day', date: todayISO(), plan_json: JSON.stringify({ ok: true }), created_at: 2 },
    );
    const result = await getRecentPlannerHistory(1, 'day', 7, env);
    expect(result).toHaveLength(1);
    expect(result[0].plan.ok).toBe(true);
  });

  it('no lanza si DB falla', async () => {
    const brokenEnv = {
      DB: { prepare: () => { throw new Error('DB down'); } },
    };
    const result = await getRecentPlannerHistory(1, 'day', 7, brokenEnv);
    expect(result).toEqual([]);
  });
});

describe('extractRecentDishNames', () => {
  it('extrae nombres de planes de día', () => {
    const history = [
      { date: '2026-04-14', plan: { meals: [{ name: 'Pechuga' }, { name: 'Ensalada' }] } },
      { date: '2026-04-13', plan: { meals: [{ name: 'Salmón' }] } },
    ];
    const names = extractRecentDishNames(history);
    expect(names.sort()).toEqual(['Ensalada', 'Pechuga', 'Salmón']);
  });

  it('extrae nombres de planes de semana', () => {
    const history = [
      {
        date: '2026-04-13',
        plan: {
          days: [
            { date: '2026-04-13', meals: [{ name: 'Avena' }, { name: 'Pollo' }] },
            { date: '2026-04-14', meals: [{ name: 'Pollo' }, { name: 'Merluza' }] },
          ],
        },
      },
    ];
    const names = extractRecentDishNames(history);
    // "Pollo" aparece 2 veces pero se deduplica.
    expect(names.sort()).toEqual(['Avena', 'Merluza', 'Pollo']);
  });

  it('combina planes day y week', () => {
    const history = [
      { plan: { meals: [{ name: 'A' }] } },
      { plan: { days: [{ meals: [{ name: 'B' }] }] } },
    ];
    const names = extractRecentDishNames(history);
    expect(names.sort()).toEqual(['A', 'B']);
  });

  it('respeta maxNames', () => {
    const meals = Array.from({ length: 50 }, (_, i) => ({ name: `plato-${i}` }));
    const history = [{ plan: { meals } }];
    const names = extractRecentDishNames(history, 10);
    expect(names).toHaveLength(10);
  });

  it('ignora meals sin name', () => {
    const history = [{ plan: { meals: [{ name: 'A' }, { kcal: 100 }, { name: '' }] } }];
    const names = extractRecentDishNames(history);
    expect(names).toEqual(['A']);
  });

  it('hace trim a los nombres', () => {
    const history = [{ plan: { meals: [{ name: '  Pechuga  ' }] } }];
    const names = extractRecentDishNames(history);
    expect(names).toEqual(['Pechuga']);
  });

  it('devuelve [] para history vacío', () => {
    expect(extractRecentDishNames([])).toEqual([]);
  });
});
