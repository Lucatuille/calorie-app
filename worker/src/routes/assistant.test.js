// ============================================================
//  TESTS — assistant.js
//  Ejecutar con: cd worker && npx vitest run src/routes/assistant.test.js
//  (requiere vitest en devDependencies)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAssistant } from './assistant.js';

// ── Helpers ─────────────────────────────────────────────────

function makeRequest(body, token = 'valid-token') {
  return {
    method: 'POST',
    headers: new Map([['Authorization', `Bearer ${token}`]]),
    json: async () => body,
  };
}

function makeGetRequest(token = 'valid-token') {
  return {
    method: 'GET',
    headers: new Map([['Authorization', `Bearer ${token}`]]),
  };
}

// ── Mock de utils.js ─────────────────────────────────────────

vi.mock('../utils.js', () => ({
  jsonResponse: (data, status = 200) => ({ ok: true, status, data }),
  errorResponse: (msg, status = 400) => ({ ok: false, status, msg }),
  authenticate: vi.fn(),
}));

import { authenticate, jsonResponse, errorResponse } from '../utils.js';

// ── Env mock base ─────────────────────────────────────────────

function makeEnv({ accessLevel = 2, usageMessages = 0, usageIntros = 0, claudeResponse = 'OK' } = {}) {
  const dbResults = {
    // requireProAccess
    'SELECT id, name, access_level FROM users WHERE id = ?': { id: 1, name: 'Test', access_level: accessLevel },
    // is_intro check
    'SELECT intros FROM assistant_usage WHERE user_id = ? AND date = ?': { intros: usageIntros },
    // rate limit check
    'SELECT messages FROM assistant_usage WHERE user_id = ? AND date = ?': { messages: usageMessages },
    // new conversation
    'INSERT INTO assistant_conversations': { id: 42 },
    // history
    'SELECT role, content FROM assistant_messages': { results: [] },
    // micro/light/full context queries
    'SELECT name, age, weight': { name: 'Test', age: 25, weight: 70, target_calories: 2000, target_protein: 150, target_carbs: 200, target_fat: 70, goal_weight: 65, tdee: 2200, height: 175, gender: 'male' },
    'SELECT name, meal_type, calories': { results: [] },
    'SELECT date, SUM(calories)': { results: [] },
    'SELECT AVG(dc)': { avg_cal: 1800, avg_prot: 120, min_cal: 1500, max_cal: 2200, days: 15 },
    'SELECT name, COUNT(*)': { results: [] },
    'SELECT date, weight': { results: [] },
    'SELECT SUM(calories) as cal': { cal: 800, prot: 60, carbs: 80, fat: 30 },
    'SELECT target_calories': { target_calories: 2000 },
  };

  const prepare = vi.fn((sql) => ({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => {
      for (const [key, val] of Object.entries(dbResults)) {
        if (sql.includes(key.split(' ')[0]) && sql.includes(key.split(' ').slice(-1)[0])) return val;
      }
      return null;
    }),
    all: vi.fn(async () => {
      for (const [key, val] of Object.entries(dbResults)) {
        if (val?.results !== undefined && sql.includes(key.split(' ')[0])) return val;
      }
      return { results: [] };
    }),
    run: vi.fn(async () => ({ success: true })),
  }));

  const batch = vi.fn(async (stmts) => stmts.map(() => ({ success: true })));

  return {
    DB: { prepare, batch },
    ANTHROPIC_API_KEY: 'test-key',
    _claudeResponse: claudeResponse,
  };
}

// Mock global fetch (Anthropic API)
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockClaudeOK(text = 'Respuesta del asistente') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ text }],
      usage: { input_tokens: 500, output_tokens: 100 },
    }),
  });
}

function mockClaudeError(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: { message: 'Internal Server Error' } }),
    status,
  });
}

// ── Tests ────────────────────────────────────────────────────

describe('handleAssistant — acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1, email: 'test@test.com' });
  });

  it('bloquea usuarios Free (access_level=1)', async () => {
    const env = makeEnv({ accessLevel: 1 });
    const req = makeRequest({ message: 'hola' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  it('permite usuarios Pro (access_level=2)', async () => {
    const env = makeEnv({ accessLevel: 2 });
    mockClaudeOK();
    const req = makeRequest({ message: 'hola' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(true);
  });

  it('permite usuarios Fundador (access_level=3)', async () => {
    const env = makeEnv({ accessLevel: 3 });
    mockClaudeOK();
    const req = makeRequest({ message: 'hola' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(true);
  });

  it('bloquea tokens inválidos', async () => {
    authenticate.mockResolvedValue(null);
    const env = makeEnv();
    const req = makeRequest({ message: 'hola' }, 'invalid-token');
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });
});

describe('handleAssistant — rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1, email: 'test@test.com' });
  });

  it('bloquea cuando se alcanza el límite Pro (20)', async () => {
    const env = makeEnv({ accessLevel: 2, usageMessages: 20 });
    const req = makeRequest({ message: 'hola' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
  });

  it('permite el mensaje 20 exacto (límite Pro)', async () => {
    const env = makeEnv({ accessLevel: 2, usageMessages: 19 });
    mockClaudeOK();
    const req = makeRequest({ message: 'hola' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(true);
    expect(res.data?.usage?.remaining).toBe(0);
  });

  it('Fundador tiene límite de 40', async () => {
    const env = makeEnv({ accessLevel: 3, usageMessages: 39 });
    mockClaudeOK();
    const req = makeRequest({ message: 'hola' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(true);

    const env2 = makeEnv({ accessLevel: 3, usageMessages: 40 });
    const req2 = makeRequest({ message: 'hola' });
    const res2 = await handleAssistant(req2, env2, '/api/assistant/chat', null);
    expect(res2.status).toBe(429);
  });

  it('revierte el incremento si Claude falla (FIX #3)', async () => {
    const env = makeEnv({ accessLevel: 2, usageMessages: 5 });
    mockClaudeError(500);
    const req = makeRequest({ message: 'hola' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
    // Verificar que se llamó al UPDATE de rollback
    const calls = env.DB.prepare.mock.calls.map(c => c[0]);
    const hasRollback = calls.some(sql => sql.includes('MAX(0, messages - 1)'));
    expect(hasRollback).toBe(true);
  });

  it('incremento se hace ANTES de llamar a Claude (FIX #3)', async () => {
    const env = makeEnv({ accessLevel: 2, usageMessages: 5 });
    let incrementCalledAt = -1;
    let claudeCalledAt    = -1;
    let callOrder = 0;

    env.DB.prepare = vi.fn((sql) => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => {
        if (sql.includes('SELECT id, name, access_level')) return { id: 1, name: 'T', access_level: 2 };
        if (sql.includes('SELECT intros')) return { intros: 0 };
        if (sql.includes('SELECT messages')) return { messages: 5 };
        if (sql.includes('INSERT INTO assistant_conversations')) return { id: 42 };
        if (sql.includes('SELECT role, content')) return null;
        // Context queries
        if (sql.includes('target_calories')) return { target_calories: 2000 };
        if (sql.includes('SUM(calories)')) return { cal: 800, prot: 60, carbs: 80, fat: 30 };
        return null;
      }),
      all: vi.fn(async () => ({ results: [] })),
      run: vi.fn(async () => {
        if (sql.includes('INSERT INTO assistant_usage') && sql.includes('ON CONFLICT')) {
          incrementCalledAt = ++callOrder;
        }
        return { success: true };
      }),
    }));
    env.DB.batch = vi.fn(async () => []);

    mockFetch.mockImplementationOnce(async () => {
      claudeCalledAt = ++callOrder;
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 10, output_tokens: 10 } }),
      };
    });

    await handleAssistant(makeRequest({ message: 'hola' }), env, '/api/assistant/chat', null);
    expect(incrementCalledAt).toBeGreaterThan(0);
    expect(claudeCalledAt).toBeGreaterThan(0);
    expect(incrementCalledAt).toBeLessThan(claudeCalledAt);
  });
});

describe('handleAssistant — is_intro (FIX #1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1, email: 'test@test.com' });
  });

  it('bloquea segunda intro del mismo día', async () => {
    const env = makeEnv({ accessLevel: 2, usageIntros: 1 });
    const req = makeRequest({ message: 'intro', is_intro: true });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
  });

  it('permite primera intro del día', async () => {
    const env = makeEnv({ accessLevel: 2, usageIntros: 0 });
    mockClaudeOK('¡Hola! Llevas 800 kcal hoy.');
    const req = makeRequest({ message: 'intro', is_intro: true });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(true);
    expect(res.data?.is_intro).toBe(true);
  });

  it('intro no consume mensajes del límite diario', async () => {
    const env = makeEnv({ accessLevel: 2, usageIntros: 0, usageMessages: 0 });
    mockClaudeOK('Hola!');
    const req = makeRequest({ message: 'intro', is_intro: true });
    await handleAssistant(req, env, '/api/assistant/chat', null);

    // Verificar que NO se hizo el incremento de messages (solo de intros)
    const calls = env.DB.prepare.mock.calls.map(c => c[0]);
    const usageIncrements = calls.filter(sql =>
      sql.includes('INSERT INTO assistant_usage') && sql.includes('messages')
    );
    expect(usageIncrements.length).toBe(0);
  });

  it('intro no crea conversación', async () => {
    const env = makeEnv({ accessLevel: 2, usageIntros: 0 });
    mockClaudeOK('Hola!');
    const req = makeRequest({ message: 'intro', is_intro: true });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.data?.conversation_id).toBeUndefined();
  });
});

describe('handleAssistant — aislamiento cross-user (FIX #2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 2, email: 'attacker@test.com' });
  });

  it('no devuelve mensajes de conversación de otro usuario', async () => {
    const env = makeEnv({ accessLevel: 2 });
    // Sobreescribir: el ownership check devuelve null (conversación de otro user)
    env.DB.prepare = vi.fn((sql) => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => {
        if (sql.includes('SELECT id FROM assistant_conversations WHERE id = ? AND user_id = ?')) return null;
        if (sql.includes('SELECT id, name, access_level')) return { id: 2, name: 'Attacker', access_level: 2 };
        return null;
      }),
      all: vi.fn(async () => ({ results: [] })),
      run: vi.fn(async () => ({})),
    }));

    const req = makeGetRequest();
    const res = await handleAssistant(req, env, '/api/assistant/conversations/999', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  it('historial de chat incluye user_id en la query (FIX #2)', async () => {
    const env = makeEnv({ accessLevel: 2 });
    mockClaudeOK();
    const req = makeRequest({ message: 'hola', conversation_id: 10 });
    await handleAssistant(req, env, '/api/assistant/chat', null);
    const calls = env.DB.prepare.mock.calls.map(c => c[0]);
    const historyQuery = calls.find(sql =>
      sql.includes('SELECT role, content FROM assistant_messages') && sql.includes('user_id')
    );
    expect(historyQuery).toBeTruthy();
  });
});

describe('handleAssistant — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1, email: 'test@test.com' });
  });

  it('rechaza mensaje vacío', async () => {
    const env = makeEnv({ accessLevel: 2 });
    const req = makeRequest({ message: '   ' });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it('rechaza mensaje > 1000 caracteres', async () => {
    const env = makeEnv({ accessLevel: 2 });
    const req = makeRequest({ message: 'a'.repeat(1001) });
    const res = await handleAssistant(req, env, '/api/assistant/chat', null);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });
});

describe('handleAssistant — modelo y contexto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({ userId: 1, email: 'test@test.com' });
  });

  it('usa Haiku para preguntas simples', async () => {
    const env = makeEnv({ accessLevel: 2 });
    let capturedModel = null;
    mockFetch.mockImplementationOnce(async (url, opts) => {
      capturedModel = JSON.parse(opts.body).model;
      return { ok: true, json: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 10, output_tokens: 10 } }) };
    });
    await handleAssistant(makeRequest({ message: '¿Cuántas calorías llevo?' }), env, '/api/assistant/chat', null);
    expect(capturedModel).toBe('claude-haiku-4-5-20251001');
  });

  it('usa Sonnet para análisis complejo', async () => {
    const env = makeEnv({ accessLevel: 2 });
    let capturedModel = null;
    mockFetch.mockImplementationOnce(async (url, opts) => {
      capturedModel = JSON.parse(opts.body).model;
      return { ok: true, json: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 10, output_tokens: 10 } }) };
    });
    await handleAssistant(makeRequest({ message: 'Analiza mi tendencia esta semana' }), env, '/api/assistant/chat', null);
    expect(capturedModel).toBe('claude-sonnet-4-6');
  });

  it('Haiku max_tokens es 650 (FIX #10)', async () => {
    const env = makeEnv({ accessLevel: 2 });
    let capturedMaxTokens = null;
    mockFetch.mockImplementationOnce(async (url, opts) => {
      capturedMaxTokens = JSON.parse(opts.body).max_tokens;
      return { ok: true, json: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 10, output_tokens: 10 } }) };
    });
    await handleAssistant(makeRequest({ message: '¿Cuántas calorías llevo?' }), env, '/api/assistant/chat', null);
    expect(capturedMaxTokens).toBe(650);
  });

  it('usa micro-contexto cuando hay >= 2 mensajes en historial (FIX #6)', async () => {
    const env = makeEnv({ accessLevel: 2 });
    // Sobreescribir historial para devolver 4 mensajes
    env.DB.prepare = vi.fn((sql) => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => {
        if (sql.includes('SELECT id, name, access_level')) return { id: 1, name: 'T', access_level: 2 };
        if (sql.includes('SELECT messages FROM assistant_usage')) return { messages: 5 };
        if (sql.includes('SELECT intros')) return { intros: 0 };
        if (sql.includes('INSERT INTO assistant_conversations')) return { id: 42 };
        if (sql.includes('SELECT target_calories FROM users')) return { target_calories: 2000 };
        if (sql.includes('SUM(calories) as cal')) return { cal: 800, prot: 60, carbs: 80, fat: 30 };
        return null;
      }),
      all: vi.fn(async () => {
        if (sql.includes('SELECT role, content FROM assistant_messages')) {
          return { results: [
            { role: 'user', content: 'hola' },
            { role: 'assistant', content: 'hola!' },
            { role: 'user', content: '¿cuánto llevo?' },
            { role: 'assistant', content: '800 kcal' },
          ]};
        }
        return { results: [] };
      }),
      run: vi.fn(async () => ({})),
    }));
    env.DB.batch = vi.fn(async () => []);

    let capturedMessages = null;
    mockFetch.mockImplementationOnce(async (url, opts) => {
      capturedMessages = JSON.parse(opts.body).messages;
      return { ok: true, json: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 10, output_tokens: 10 } }) };
    });

    await handleAssistant(makeRequest({ message: '¿cómo voy?', conversation_id: 42 }), env, '/api/assistant/chat', null);
    // El primer mensaje del array debe ser el micro-contexto (corto)
    const contextMsg = capturedMessages?.[0]?.content || '';
    expect(contextMsg).toContain('Datos actualizados');
    expect(contextMsg.length).toBeLessThan(300); // micro-contexto < 300 chars
  });
});
