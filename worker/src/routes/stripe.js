// ============================================================
//  STRIPE ROUTES
//  POST /api/create-checkout-session
//  POST /api/stripe-webhook
//  GET  /api/subscription-status
// ============================================================

import { jsonResponse, errorResponse, verifyJWT } from '../utils.js';

const ALLOWED_PRICES = new Set([
  'price_1TCSy8IDqPCl93zMZmrb0Mzg', // Monthly
  'price_1TCSydIDqPCl93zM6fMYoamR', // Yearly
]);

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = {};
  sigHeader.split(',').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1);
  });
  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  // Reject events older than 5 minutes (replay attack protection)
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (age > 300 || age < -60) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return mismatch === 0;
}

export async function handleStripe(request, env, path) {

  // ── POST /api/create-checkout-session ──────────────────────
  if (path === '/api/create-checkout-session' && request.method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Token requerido', 401);

    const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
    if (!payload) return errorResponse('Token inválido', 401);

    const { priceId } = await request.json();
    if (!ALLOWED_PRICES.has(priceId)) return errorResponse('Plan no válido', 400);

    const params = new URLSearchParams({
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': 'https://caliro.dev/app/?upgraded=true',
      'cancel_url': 'https://caliro.dev/app/profile',
      'metadata[userId]': String(payload.userId),
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const session = await res.json();
    if (!res.ok) return errorResponse(session.error?.message || 'Error al crear sesión de pago', 500);

    return jsonResponse({ url: session.url });
  }

  // ── POST /api/stripe-webhook ────────────────────────────────
  if (path === '/api/stripe-webhook' && request.method === 'POST') {
    const sigHeader = request.headers.get('stripe-signature');
    if (!sigHeader) return errorResponse('Firma requerida', 400);

    const rawBody = await request.text();

    const valid = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return errorResponse('Firma inválida', 400);

    const event = JSON.parse(rawBody);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.metadata?.userId, 10);
      if (!isNaN(userId)) {
        // NUNCA tocar si access_level = 1 (Fundador)
        await env.DB.prepare(`
          UPDATE users
          SET access_level = 2,
              stripe_customer_id = ?,
              stripe_subscription_id = ?
          WHERE id = ? AND (access_level IS NULL OR access_level != 1)
        `).bind(
          session.customer ?? null,
          session.subscription ?? null,
          userId
        ).run();
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      if (customerId) {
        // NUNCA bajar si era Fundador (access_level = 1)
        await env.DB.prepare(`
          UPDATE users SET access_level = 3
          WHERE stripe_customer_id = ? AND access_level = 2
        `).bind(customerId).run();
      }
    }

    // Siempre 200 si la firma es válida
    return jsonResponse({ received: true });
  }

  // ── GET /api/subscription-status ───────────────────────────
  if (path === '/api/subscription-status' && request.method === 'GET') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Token requerido', 401);

    const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
    if (!payload) return errorResponse('Token inválido', 401);

    const user = await env.DB.prepare(
      'SELECT access_level FROM users WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);
    return jsonResponse({ access_level: user.access_level ?? 3 });
  }

  // ── POST /api/create-portal-session ────────────────────────
  if (path === '/api/create-portal-session' && request.method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Token requerido', 401);

    const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
    if (!payload) return errorResponse('Token inválido', 401);

    const user = await env.DB.prepare(
      'SELECT stripe_customer_id, access_level FROM users WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);
    if (!user.stripe_customer_id) return errorResponse('No hay suscripción activa', 400);

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: user.stripe_customer_id,
        return_url: 'https://caliro.dev/app/profile',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Stripe portal error:', res.status, err);
      return errorResponse('Error al crear sesión de portal', 502);
    }

    const session = await res.json();
    return jsonResponse({ url: session.url });
  }

  return errorResponse('Not found', 404);
}
