// ============================================================
//  TESTS — handlePlanner (/api/planner/*)
//  Ejecutar: cd worker && npx vitest run src/routes/__tests__/planner.test.js
//
//  Mocks:
//   - utils.authenticate + rateLimit + jsonResponse/errorResponse
//   - plannerLimits (check/rollback/usage)
//   - plannerHistory (save/getRecent/extractNames)
//   - fetch global (Anthropic API)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────

vi.mock('../../utils.js', () => ({
  jsonResponse:  (data, status = 200) => ({ _json: true, status, data }),
  errorResponse: (msg, status = 400)  => ({ _json: true, status, data: { error: msg } }),
  authenticate:  vi.fn(),
  rateLimit:     vi.fn(async () => null),
}));

vi.mock('../../utils/plannerLimits.js', () => ({
  checkAndIncrementPlannerLimit: vi.fn(),
  rollbackPlannerLimit:          vi.fn(async () => {}),
  getPlannerUsage:               vi.fn(),
}));

vi.mock('../../utils/plannerHistory.js', () => ({
  savePlannerHistory:       vi.fn(async () => {}),
  getRecentPlannerHistory:  vi.fn(async () => []),
  extractRecentDishNames:   vi.fn(() => []),
}));

import { handlePlanner } from '../planner.js';
import { authenticate } from '../../utils.js';
import {
  checkAndIncrementPlannerLimit,
  rollbackPlannerLimit,
  getPlannerUsage,
} from '../../utils/plannerLimits.js';
import {
  savePlannerHistory,
  getRecentPlannerHistory,
  extractRecentDishNames,
} from '../../utils/plannerHistory.js';

// ── Helpers ─────────────────────────────────────────────────

function makeRequest(method, path, body = null) {
  return {
    method,
    url: `https://api.test${path}`,
    headers: new Map([['Authorization', 'Bearer test']]),
    json: async () => body || {},
  };
}

/**
 * env.DB mock simplificado:
 *  - users SELECT → userRow
 *  - entries WHERE date = today → todayEntries
 *  - entries WHERE date BETWEEN → recentEntries
 *  - user_calibration → calib
 *  - planner_history (con feature+date filter) → historyRows
 */
function makeEnv({
  userRow = null,
  todayEntries = [],
  recentEntries = [],
  calib = null,
  historyRows = [],
  insertId = 1,
} = {}) {
  const logSqlCalls = [];

  const prepare = (sql) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    logSqlCalls.push(s);
    const binds = [];
    return {
      bind(...args) { binds.push(...args); return this; },
      async first() {
        if (s.startsWith('SELECT id, name, weight, goal_weight')) return userRow;
        if (s.startsWith('SELECT target_calories FROM users'))    return userRow;
        if (s.startsWith('SELECT access_level FROM users'))       return userRow;
        if (s.startsWith('SELECT frequent_meals FROM user_calibration')) return calib;
        if (s.includes('FROM planner_history') && s.includes('ORDER BY created_at DESC')) {
          return historyRows[0] || null;
        }
        return null;
      },
      async all() {
        if (s.startsWith('SELECT meal_type, name, calories, protein, carbs, fat, created_at FROM entries WHERE user_id = ? AND date = ?')) {
          return { results: todayEntries };
        }
        if (s.startsWith('SELECT date, meal_type, name, calories FROM entries')) {
          return { results: recentEntries };
        }
        return { results: [] };
      },
      async run() {
        return { success: true, meta: { last_row_id: insertId } };
      },
    };
  };

  return {
    DB: { prepare },
    ANTHROPIC_API_KEY: 'test-key',
    _sqlCalls: logSqlCalls,
  };
}

function mockAnthropicResponse(jsonPayload, { ok = true, stopReason = 'end_turn' } = {}) {
  const content = typeof jsonPayload === 'string'
    ? jsonPayload
    : JSON.stringify(jsonPayload);
  return {
    ok,
    status: ok ? 200 : 500,
    async text() { return ok ? '' : 'error'; },
    async json() {
      return {
        content: [{ text: content }],
        stop_reason: stopReason,
        usage: { input_tokens: 100, output_tokens: 200 },
      };
    },
  };
}

// ── Auth tests ──────────────────────────────────────────────

describe('handlePlanner — auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /day sin token → 401', async () => {
    authenticate.mockResolvedValue(null);
    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day'),
      makeEnv(),
      '/api/planner/day'
    );
    expect(res.status).toBe(401);
  });

  it('POST /week sin token → 401', async () => {
    authenticate.mockResolvedValue(null);
    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/week'),
      makeEnv(),
      '/api/planner/week'
    );
    expect(res.status).toBe(401);
  });

  it('GET /usage sin token → 401', async () => {
    authenticate.mockResolvedValue(null);
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/usage'),
      makeEnv(),
      '/api/planner/usage'
    );
    expect(res.status).toBe(401);
  });

  it('ruta desconocida → 404', async () => {
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/unknown'),
      makeEnv(),
      '/api/planner/unknown'
    );
    expect(res.status).toBe(404);
  });
});

// ── POST /api/planner/day ───────────────────────────────────

describe('POST /api/planner/day', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
    checkAndIncrementPlannerLimit.mockResolvedValue({
      allowed: true, remainingDay: 1, remainingWeek: Infinity, limits: { day: 2 },
    });
  });

  it('Free bloqueado → 429 con reason blocked', async () => {
    checkAndIncrementPlannerLimit.mockResolvedValue({
      allowed: false, reason: 'blocked', limits: { day: 0, week: 0 },
    });
    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 3 } }),
      '/api/planner/day'
    );
    expect(res.status).toBe(429);
    expect(res.data.error).toMatch(/Pro/i);
  });

  it('sin target_calories → 400', async () => {
    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({ userRow: { id: 1, target_calories: null, access_level: 2 } }),
      '/api/planner/day'
    );
    expect(res.status).toBe(400);
  });

  it('usuario no encontrado → 404', async () => {
    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({ userRow: null }),
      '/api/planner/day'
    );
    expect(res.status).toBe(404);
  });

  it('Pro éxito → devuelve plan + usage', async () => {
    const fakePlan = {
      meals: [
        { type: 'desayuno', name: 'Avena', kcal: 400, protein: 20, carbs: 50, fat: 10 },
        { type: 'comida',   name: 'Pollo', kcal: 500, protein: 40, carbs: 40, fat: 12 },
      ],
      totals: { kcal: 900, protein: 60, carbs: 90, fat: 22 },
    };
    global.fetch = vi.fn(async () => mockAnthropicResponse(fakePlan));

    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({
        userRow: { id: 1, target_calories: 2000, access_level: 2 },
        todayEntries: [],
      }),
      '/api/planner/day'
    );

    expect(res.status).toBe(200);
    expect(res.data.plan.meals).toHaveLength(2);
    expect(res.data.target_kcal).toBe(2000);
    expect(res.data.usage.remaining_day).toBe(1);
    expect(savePlannerHistory).toHaveBeenCalledWith(1, 'day', expect.any(Object), expect.any(Object));
  });

  it('Anthropic error → rollback + 502', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false, status: 500,
      async text() { return 'error'; },
    }));

    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 2 } }),
      '/api/planner/day'
    );

    expect(res.status).toBe(502);
    expect(rollbackPlannerLimit).toHaveBeenCalledWith(1, 'day', expect.any(Object));
  });

  it('max_tokens truncation → rollback + 422', async () => {
    global.fetch = vi.fn(async () => mockAnthropicResponse('', { stopReason: 'max_tokens' }));

    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 2 } }),
      '/api/planner/day'
    );

    expect(res.status).toBe(422);
    expect(rollbackPlannerLimit).toHaveBeenCalled();
  });

  it('JSON parse error → rollback + 502', async () => {
    global.fetch = vi.fn(async () => mockAnthropicResponse('not a json response'));

    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 2 } }),
      '/api/planner/day'
    );

    expect(res.status).toBe(502);
    expect(rollbackPlannerLimit).toHaveBeenCalled();
  });

  it('strip server-side: filtra meals de tipos ya registrados hoy', async () => {
    // Usuario ya registró "desayuno". Sonnet ignora la regla y devuelve 4 meals.
    const fakePlan = {
      meals: [
        { type: 'desayuno', name: 'Tostadas', kcal: 400, protein: 20, carbs: 50, fat: 10 },
        { type: 'comida',   name: 'Pollo',    kcal: 500, protein: 40, carbs: 40, fat: 12 },
        { type: 'merienda', name: 'Yogur',    kcal: 200, protein: 10, carbs: 20, fat: 5 },
        { type: 'cena',     name: 'Merluza',  kcal: 400, protein: 30, carbs: 30, fat: 8 },
      ],
      totals: { kcal: 1500, protein: 100, carbs: 140, fat: 35 },
    };
    global.fetch = vi.fn(async () => mockAnthropicResponse(fakePlan));

    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/day', {}),
      makeEnv({
        userRow: { id: 1, target_calories: 2000, access_level: 2 },
        todayEntries: [
          { meal_type: 'breakfast', name: 'Ya comí tostadas', calories: 350, protein: 18, carbs: 45, fat: 8 },
        ],
      }),
      '/api/planner/day'
    );

    expect(res.status).toBe(200);
    const meals = res.data.plan.meals;
    // Desayuno ha sido stripeado
    expect(meals.find(m => m.type === 'desayuno')).toBeUndefined();
    expect(meals).toHaveLength(3);
    // Totals recalculados
    expect(res.data.plan.totals.kcal).toBe(1100); // 1500 - 400
  });

  it('contexto del body se pasa al prompt', async () => {
    global.fetch = vi.fn(async () => mockAnthropicResponse({
      meals: [{ type: 'cena', name: 'X', kcal: 400, protein: 10, carbs: 10, fat: 5 }],
      totals: { kcal: 400, protein: 10, carbs: 10, fat: 5 },
    }));

    await handlePlanner(
      makeRequest('POST', '/api/planner/day', { context: 'solo cena, algo ligero' }),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 2 } }),
      '/api/planner/day'
    );

    expect(global.fetch).toHaveBeenCalled();
    const call = global.fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    const userMsg = body.messages[0].content;
    expect(userMsg).toContain('solo cena, algo ligero');
  });
});

// ── POST /api/planner/week ──────────────────────────────────

describe('POST /api/planner/week', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
    checkAndIncrementPlannerLimit.mockResolvedValue({
      allowed: true, remainingDay: 0, remainingWeek: Infinity, limits: { day: 1 },
    });
  });

  it('Free bloqueado → 429', async () => {
    checkAndIncrementPlannerLimit.mockResolvedValue({
      allowed: false, reason: 'blocked', limits: { day: 0, week: 0 },
    });
    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/week', {}),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 3 } }),
      '/api/planner/week'
    );
    expect(res.status).toBe(429);
  });

  it('éxito → devuelve plan con N días', async () => {
    // Construimos un plan semanal de prueba (N días, cada uno con 4 meals).
    // Como N depende del día real, lo construimos flexible.
    const today = new Date();
    const dow = today.getDay();
    const N = dow === 0 ? 1 : (7 - dow + 1);

    const daysArr = [];
    for (let i = 0; i < N; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = d.toLocaleDateString('en-CA');
      const names = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
      const dayName = names[d.getDay() === 0 ? 6 : d.getDay() - 1];
      daysArr.push({
        date: iso,
        day_name: dayName,
        meals: [
          { type: 'desayuno', name: 'Avena', kcal: 400, protein: 20, carbs: 50, fat: 10 },
          { type: 'comida',   name: 'Pollo', kcal: 500, protein: 40, carbs: 40, fat: 12 },
          { type: 'merienda', name: 'Yogur', kcal: 200, protein: 10, carbs: 20, fat: 5 },
          { type: 'cena',     name: 'Merluza', kcal: 400, protein: 30, carbs: 30, fat: 8 },
        ],
      });
    }

    global.fetch = vi.fn(async () => mockAnthropicResponse({ days: daysArr }));

    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/week', {}),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 2 } }),
      '/api/planner/week'
    );

    expect(res.status).toBe(200);
    expect(res.data.plan.days).toHaveLength(N);
    expect(res.data.target_kcal).toBe(2000);
    expect(savePlannerHistory).toHaveBeenCalledWith(1, 'week', expect.any(Object), expect.any(Object));
  });

  it('strip server-side: elimina meals del día de hoy ya registrados', async () => {
    const today = new Date();
    const todayISO = today.toLocaleDateString('en-CA');
    const dow = today.getDay();
    const names = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const dayName = names[dow === 0 ? 6 : dow - 1];

    // Sonnet devuelve todos los meals para hoy aunque comida ya esté registrada.
    const dayPlan = {
      date: todayISO,
      day_name: dayName,
      meals: [
        { type: 'desayuno', name: 'Tostadas', kcal: 400, protein: 20, carbs: 50, fat: 10 },
        { type: 'comida',   name: 'Ensalada', kcal: 500, protein: 30, carbs: 40, fat: 15 },
        { type: 'merienda', name: 'Fruta',    kcal: 150, protein: 2,  carbs: 30, fat: 1  },
        { type: 'cena',     name: 'Sopa',     kcal: 350, protein: 20, carbs: 30, fat: 10 },
      ],
    };

    global.fetch = vi.fn(async () => mockAnthropicResponse({ days: [dayPlan] }));

    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/week', {}),
      makeEnv({
        userRow: { id: 1, target_calories: 2000, access_level: 2 },
        todayEntries: [
          { meal_type: 'lunch', name: 'Ya comí', calories: 450, protein: 25, carbs: 50, fat: 10 },
        ],
      }),
      '/api/planner/week'
    );

    expect(res.status).toBe(200);
    const firstDay = res.data.plan.days[0];
    expect(firstDay.meals.find(m => m.type === 'comida')).toBeUndefined();
    expect(firstDay.meals).toHaveLength(3);
  });

  it('JSON inválido → rollback + 502', async () => {
    global.fetch = vi.fn(async () => mockAnthropicResponse('not json'));
    const res = await handlePlanner(
      makeRequest('POST', '/api/planner/week', {}),
      makeEnv({ userRow: { id: 1, target_calories: 2000, access_level: 2 } }),
      '/api/planner/week'
    );
    expect(res.status).toBe(502);
    expect(rollbackPlannerLimit).toHaveBeenCalledWith(1, 'week', expect.any(Object));
  });
});

// ── GET /api/planner/day/current ────────────────────────────

describe('GET /api/planner/day/current', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
  });

  it('sin plan → { plan: null }', async () => {
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/day/current'),
      makeEnv({ userRow: { target_calories: 2000 }, historyRows: [] }),
      '/api/planner/day/current'
    );
    expect(res.status).toBe(200);
    expect(res.data.plan).toBe(null);
  });

  it('con plan → devuelve plan parseado + target_kcal', async () => {
    const planObj = { meals: [{ name: 'Avena', kcal: 400 }] };
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/day/current'),
      makeEnv({
        userRow: { target_calories: 1812 },
        historyRows: [{ plan_json: JSON.stringify(planObj), created_at: 123 }],
      }),
      '/api/planner/day/current'
    );
    expect(res.status).toBe(200);
    expect(res.data.plan).toEqual(planObj);
    expect(res.data.target_kcal).toBe(1812);
    expect(res.data.generated_at).toBe(123);
  });

  it('JSON corrupto en DB → { plan: null } (no crash)', async () => {
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/day/current'),
      makeEnv({
        userRow: { target_calories: 2000 },
        historyRows: [{ plan_json: '{corrupt', created_at: 1 }],
      }),
      '/api/planner/day/current'
    );
    expect(res.status).toBe(200);
    expect(res.data.plan).toBe(null);
  });
});

// ── GET /api/planner/week/current ───────────────────────────

describe('GET /api/planner/week/current', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
  });

  it('sin plan → { plan: null }', async () => {
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/week/current'),
      makeEnv({ userRow: { target_calories: 2000 }, historyRows: [] }),
      '/api/planner/week/current'
    );
    expect(res.status).toBe(200);
    expect(res.data.plan).toBe(null);
  });

  it('con plan → devuelve plan + target_kcal + generated_date', async () => {
    const planObj = { days: [{ date: '2026-04-14', meals: [] }] };
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/week/current'),
      makeEnv({
        userRow: { target_calories: 1812 },
        historyRows: [{
          plan_json: JSON.stringify(planObj),
          created_at: 456,
          date: '2026-04-14',
        }],
      }),
      '/api/planner/week/current'
    );
    expect(res.status).toBe(200);
    expect(res.data.plan).toEqual(planObj);
    expect(res.data.target_kcal).toBe(1812);
    expect(res.data.generated_date).toBe('2026-04-14');
  });
});

// ── GET /api/planner/usage ──────────────────────────────────

describe('GET /api/planner/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
  });

  it('devuelve usage del helper', async () => {
    const fakeUsage = {
      day:  { used_day: 1, remaining_day: 1, blocked: false },
      week: { used_day: 0, remaining_day: 1, blocked: false },
    };
    getPlannerUsage.mockResolvedValue(fakeUsage);

    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/usage'),
      makeEnv({ userRow: { access_level: 2 } }),
      '/api/planner/usage'
    );

    expect(res.status).toBe(200);
    expect(res.data).toEqual(fakeUsage);
    expect(getPlannerUsage).toHaveBeenCalledWith(1, 2, expect.any(Object));
  });

  it('usuario no encontrado → 404', async () => {
    const res = await handlePlanner(
      makeRequest('GET', '/api/planner/usage'),
      makeEnv({ userRow: null }),
      '/api/planner/usage'
    );
    expect(res.status).toBe(404);
  });
});
