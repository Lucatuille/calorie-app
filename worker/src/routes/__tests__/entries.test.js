// ============================================================
//  TESTS — entries.js (CRUD + pagination)
//  Ejecutar: cd worker && npx vitest run src/routes/__tests__/entries.test.js
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEntries } from '../entries.js';

// ── Mock utils ─────────────────────────────────────────────

vi.mock('../../utils.js', () => ({
  jsonResponse: (data, status = 200) => ({ _json: true, status, data }),
  errorResponse: (msg, status = 400) => ({ _json: true, status, data: { error: msg } }),
  authenticate: vi.fn(),
  getClientToday: vi.fn(() => '2026-04-06'),
  rateLimit: vi.fn(async () => null),  // por defecto no bloquea
}));

import { authenticate } from '../../utils.js';

// ── Helpers ────────────────────────────────────────────────

function makeRequest(method, path, body = null, query = '') {
  return {
    method,
    url: `https://api.test${path}${query}`,
    headers: new Map([['Authorization', 'Bearer test']]),
    json: async () => body,
  };
}

function makeEnv(overrides = {}) {
  const rows = overrides.rows || [];
  const insertId = overrides.insertId || 1;
  const firstResult = overrides.firstResult || null;

  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn(async () => ({ results: rows })),
        first: vi.fn(async () => firstResult),
        run: vi.fn(async () => ({
          success: true,
          meta: { last_row_id: insertId },
        })),
      })),
    },
  };
}

// ── Tests ──────────────────────────────────────────────────

describe('handleEntries — autenticación', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza sin token (401)', async () => {
    authenticate.mockResolvedValue(null);
    const res = await handleEntries(
      makeRequest('GET', '/api/entries'),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(401);
  });
});


describe('handleEntries — POST /api/entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
  });

  it('crea entry con datos válidos (201)', async () => {
    const entry = { id: 1, calories: 500, protein: 30, date: '2026-04-06' };
    const env = makeEnv({ insertId: 1, firstResult: entry });
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, protein: 30 }),
      env,
      '/api/entries'
    );
    expect(res.status).toBe(201);
    expect(res.data).toEqual(entry);
  });

  it('rechaza calorías = 0 (required, min 1)', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 0 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza calorías negativas', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: -100 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza calorías > 15000', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 16000 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza proteína > 1000', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, protein: 1500 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza carbohidratos > 1500', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, carbs: 2000 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza grasa > 1000', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, fat: 1100 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza peso fuera de rango (< 20 o > 300)', async () => {
    let res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, weight: 10 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);

    res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, weight: 400 }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza fecha con formato inválido', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, date: '06-04-2026' }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('acepta fecha YYYY-MM-DD válida', async () => {
    const entry = { id: 1, calories: 500, date: '2026-03-15' };
    const env = makeEnv({ insertId: 1, firstResult: entry });
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, date: '2026-03-15' }),
      env,
      '/api/entries'
    );
    expect(res.status).toBe(201);
  });

  it('rechaza nombre > 200 caracteres', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, name: 'x'.repeat(201) }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('rechaza notas > 1000 caracteres', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 500, notes: 'x'.repeat(1001) }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('acepta entry sin macros opcionales', async () => {
    const entry = { id: 1, calories: 300 };
    const env = makeEnv({ insertId: 1, firstResult: entry });
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 300 }),
      env,
      '/api/entries'
    );
    expect(res.status).toBe(201);
  });

  it('valores no numéricos en calorías rechazan', async () => {
    const res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: 'muchas' }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });

  it('Infinity/NaN en calorías rechazan', async () => {
    let res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: Infinity }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);

    res = await handleEntries(
      makeRequest('POST', '/api/entries', { calories: NaN }),
      makeEnv(),
      '/api/entries'
    );
    expect(res.status).toBe(400);
  });
});


describe('handleEntries — GET /api/entries (paginación)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
  });

  function makeEnvTrackingBinds(rows = []) {
    const bindCalls = [];
    return {
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn((...args) => {
              bindCalls.push(args);
              return {
                all: vi.fn(async () => ({ results: rows })),
                first: vi.fn(async () => null),
                run: vi.fn(async () => ({ success: true })),
              };
            }),
          })),
        },
      },
      bindCalls,
    };
  }

  it('devuelve entries con limit por defecto (90)', async () => {
    const { env, bindCalls } = makeEnvTrackingBinds([{ id: 1 }, { id: 2 }]);
    const res = await handleEntries(
      makeRequest('GET', '/api/entries'),
      env,
      '/api/entries'
    );
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(2);
    expect(bindCalls[0]).toEqual([1, 90, 0]);
  });

  it('respeta limit custom', async () => {
    const { env, bindCalls } = makeEnvTrackingBinds();
    await handleEntries(
      makeRequest('GET', '/api/entries', null, '?limit=30'),
      env,
      '/api/entries'
    );
    expect(bindCalls[0]).toEqual([1, 30, 0]);
  });

  it('limit no puede superar 365', async () => {
    const { env, bindCalls } = makeEnvTrackingBinds();
    await handleEntries(
      makeRequest('GET', '/api/entries', null, '?limit=9999'),
      env,
      '/api/entries'
    );
    expect(bindCalls[0]).toEqual([1, 365, 0]);
  });

  it('offset funciona correctamente', async () => {
    const { env, bindCalls } = makeEnvTrackingBinds();
    await handleEntries(
      makeRequest('GET', '/api/entries', null, '?limit=90&offset=180'),
      env,
      '/api/entries'
    );
    expect(bindCalls[0]).toEqual([1, 90, 180]);
  });

  it('offset negativo se clampea a 0', async () => {
    const { env, bindCalls } = makeEnvTrackingBinds();
    await handleEntries(
      makeRequest('GET', '/api/entries', null, '?offset=-10'),
      env,
      '/api/entries'
    );
    expect(bindCalls[0]).toEqual([1, 90, 0]);
  });
});


describe('handleEntries — PUT /api/entries/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
  });

  it('actualiza entry existente propia', async () => {
    const env = makeEnv({ firstResult: { id: 5 } });
    const res = await handleEntries(
      makeRequest('PUT', '/api/entries/5', { calories: 600, protein: 40 }),
      env,
      '/api/entries/5'
    );
    expect(res.status).toBe(200);
  });

  it('rechaza entry que no existe (404)', async () => {
    const env = makeEnv({ firstResult: null });
    const res = await handleEntries(
      makeRequest('PUT', '/api/entries/999', { calories: 600 }),
      env,
      '/api/entries/999'
    );
    expect(res.status).toBe(404);
  });

  it('rechaza actualización sin calorías', async () => {
    const res = await handleEntries(
      makeRequest('PUT', '/api/entries/5', { protein: 40 }),
      makeEnv(),
      '/api/entries/5'
    );
    expect(res.status).toBe(400);
  });

  it('valida macros en actualización igual que en creación', async () => {
    const res = await handleEntries(
      makeRequest('PUT', '/api/entries/5', { calories: 500, protein: 1500 }),
      makeEnv(),
      '/api/entries/5'
    );
    expect(res.status).toBe(400);
  });
});


describe('handleEntries — DELETE /api/entries/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1 });
  });

  it('elimina entry propia', async () => {
    const env = makeEnv({ firstResult: { id: 5 } });
    const res = await handleEntries(
      makeRequest('DELETE', '/api/entries/5'),
      env,
      '/api/entries/5'
    );
    expect(res.status).toBe(200);
  });

  it('rechaza eliminar entry de otro usuario (404)', async () => {
    const env = makeEnv({ firstResult: null });
    const res = await handleEntries(
      makeRequest('DELETE', '/api/entries/999'),
      env,
      '/api/entries/999'
    );
    expect(res.status).toBe(404);
  });
});
