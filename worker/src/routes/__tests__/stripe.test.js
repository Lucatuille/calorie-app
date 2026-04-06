// ============================================================
//  TESTS — stripe.js (webhooks, firma, estado de suscripción)
//  Ejecutar: cd worker && npx vitest run src/routes/__tests__/stripe.test.js
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStripe } from '../stripe.js';

// ── Mock utils ─────────────────────────────────────────────

vi.mock('../../utils.js', () => ({
  jsonResponse: (data, status = 200) => ({ _json: true, status, data }),
  errorResponse: (msg, status = 400) => ({ _json: true, status, data: { error: msg } }),
  verifyJWT: vi.fn(),
}));

import { verifyJWT } from '../../utils.js';

// ── Helpers ────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeEnv() {
  return {
    STRIPE_SECRET_KEY: 'sk_test_xxx',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    JWT_SECRET: 'jwt-secret',
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn(async () => ({ success: true })),
        first: vi.fn(async () => null),
      })),
    },
  };
}

async function generateSignature(payload, secret, timestamp) {
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function makeWebhookRequest(body, sigHeader) {
  return {
    method: 'POST',
    headers: new Map([['stripe-signature', sigHeader]]),
    text: async () => body,
  };
}

// ── Webhook signature verification ─────────────────────────

describe('stripe webhook — verificación de firma', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza sin header stripe-signature (400)', async () => {
    const req = {
      method: 'POST',
      headers: new Map(),
      text: async () => '{}',
    };
    const res = await handleStripe(req, makeEnv(), '/api/stripe-webhook');
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/[Ff]irma/);
  });

  it('rechaza firma inválida (400)', async () => {
    const req = makeWebhookRequest('{}', 't=123,v1=invalidhex');
    const res = await handleStripe(req, makeEnv(), '/api/stripe-webhook');
    expect(res.status).toBe(400);
  });

  it('rechaza firma expirada (>5 min)', async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutos
    const body = JSON.stringify({ type: 'test', data: { object: {} } });
    const sig = await generateSignature(body, 'whsec_test', oldTimestamp);
    const req = makeWebhookRequest(body, `t=${oldTimestamp},v1=${sig}`);
    const res = await handleStripe(req, makeEnv(), '/api/stripe-webhook');
    expect(res.status).toBe(400);
  });

  it('acepta firma válida y reciente', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ type: 'unknown.event', data: { object: {} } });
    const sig = await generateSignature(body, 'whsec_test', timestamp);
    const req = makeWebhookRequest(body, `t=${timestamp},v1=${sig}`);
    const res = await handleStripe(req, makeEnv(), '/api/stripe-webhook');
    expect(res.status).toBe(200);
    expect(res.data.received).toBe(true);
  });
});


// ── checkout.session.completed ─────────────────────────────

describe('stripe webhook — checkout.session.completed', () => {
  beforeEach(() => vi.clearAllMocks());

  async function sendCheckoutEvent(env, session) {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: session },
    });
    const sig = await generateSignature(body, 'whsec_test', timestamp);
    const req = makeWebhookRequest(body, `t=${timestamp},v1=${sig}`);
    return handleStripe(req, env, '/api/stripe-webhook');
  }

  it('actualiza usuario a Pro (access_level=2) tras checkout', async () => {
    const bindCalls = [];
    const env = {
      ...makeEnv(),
      DB: {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => {
            bindCalls.push({ sql, args });
            return { run: vi.fn(async () => ({ success: true })) };
          }),
        })),
      },
    };
    const res = await sendCheckoutEvent(env, {
      metadata: { userId: '5' },
      customer: 'cus_123',
      subscription: 'sub_456',
    });
    expect(res.status).toBe(200);
    expect(bindCalls.length).toBeGreaterThan(0);
    const updateCall = bindCalls.find(c => c.sql.includes('access_level = 2'));
    expect(updateCall).toBeTruthy();
    expect(updateCall.args).toEqual(['cus_123', 'sub_456', 5]);
  });

  it('NO toca usuarios Fundador (access_level=1)', async () => {
    const env = makeEnv();
    const res = await sendCheckoutEvent(env, {
      metadata: { userId: '5' },
      customer: 'cus_123',
      subscription: 'sub_456',
    });
    // La query tiene WHERE access_level != 1
    const sql = env.DB.prepare.mock.calls[0][0];
    expect(sql).toContain('access_level != 1');
  });

  it('ignora evento sin metadata.userId', async () => {
    const env = makeEnv();
    const res = await sendCheckoutEvent(env, {
      metadata: {},
      customer: 'cus_123',
    });
    expect(res.status).toBe(200);
    // No debería haber llamado a prepare (no hay userId válido)
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
});


// ── customer.subscription.deleted ──────────────────────────

describe('stripe webhook — customer.subscription.deleted', () => {
  beforeEach(() => vi.clearAllMocks());

  async function sendCancelEvent(env, customerId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      type: 'customer.subscription.deleted',
      data: { object: { customer: customerId } },
    });
    const sig = await generateSignature(body, 'whsec_test', timestamp);
    const req = makeWebhookRequest(body, `t=${timestamp},v1=${sig}`);
    return handleStripe(req, env, '/api/stripe-webhook');
  }

  it('degrada a Free (access_level=3) cuando cancela Pro', async () => {
    const env = makeEnv();
    const res = await sendCancelEvent(env, 'cus_123');
    expect(res.status).toBe(200);
    const sql = env.DB.prepare.mock.calls[0][0];
    expect(sql).toContain('access_level = 3');
    expect(sql).toContain('access_level = 2'); // solo degrada Pro, no Fundador
  });

  it('NO degrada Fundador cuando cancela suscripción Stripe', async () => {
    const env = makeEnv();
    await sendCancelEvent(env, 'cus_123');
    const sql = env.DB.prepare.mock.calls[0][0];
    // La query solo aplica a access_level = 2 (Pro)
    expect(sql).toContain('AND access_level = 2');
  });
});


// ── POST /api/create-checkout-session ───────────────────────

describe('stripe — create-checkout-session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza sin token (401)', async () => {
    const req = {
      method: 'POST',
      headers: new Map(),
    };
    const res = await handleStripe(req, makeEnv(), '/api/create-checkout-session');
    expect(res.status).toBe(401);
  });

  it('rechaza priceId no permitido', async () => {
    verifyJWT.mockResolvedValue({ userId: 1 });
    const req = {
      method: 'POST',
      headers: new Map([['Authorization', 'Bearer valid']]),
      json: async () => ({ priceId: 'price_MALICIOUS' }),
    };
    const res = await handleStripe(req, makeEnv(), '/api/create-checkout-session');
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/[Pp]lan/);
  });

  it('acepta priceId válido y crea sesión', async () => {
    verifyJWT.mockResolvedValue({ userId: 1 });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/xxx' }),
    });
    const req = {
      method: 'POST',
      headers: new Map([['Authorization', 'Bearer valid']]),
      json: async () => ({ priceId: 'price_1TCSy8IDqPCl93zMZmrb0Mzg' }),
    };
    const res = await handleStripe(req, makeEnv(), '/api/create-checkout-session');
    expect(res.status).toBe(200);
    expect(res.data.url).toContain('stripe.com');
  });
});


// ── GET /api/subscription-status ────────────────────────────

describe('stripe — subscription-status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve access_level del usuario', async () => {
    verifyJWT.mockResolvedValue({ userId: 1 });
    const env = makeEnv();
    env.DB.prepare = vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => ({ access_level: 2 })),
    }));
    const req = {
      method: 'GET',
      headers: new Map([['Authorization', 'Bearer valid']]),
    };
    const res = await handleStripe(req, env, '/api/subscription-status');
    expect(res.status).toBe(200);
    expect(res.data.access_level).toBe(2);
  });

  it('devuelve 3 (Free) si access_level es null', async () => {
    verifyJWT.mockResolvedValue({ userId: 1 });
    const env = makeEnv();
    env.DB.prepare = vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => ({ access_level: null })),
    }));
    const req = {
      method: 'GET',
      headers: new Map([['Authorization', 'Bearer valid']]),
    };
    const res = await handleStripe(req, env, '/api/subscription-status');
    expect(res.data.access_level).toBe(3);
  });
});
