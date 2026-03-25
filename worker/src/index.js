// ============================================================
//  CALORIE APP — Cloudflare Worker API
// ============================================================

import * as Sentry from '@sentry/cloudflare';
import { handleAuth } from './routes/auth.js';
import { handleEntries } from './routes/entries.js';
import { handleProgress } from './routes/progress.js';
import { handleProfile } from './routes/profile.js';
import { handleAnalyze, handleAnalyzeText } from './routes/analyze.js';
import { handleSupplements } from './routes/supplements.js';
import { handleAdmin } from './routes/admin.js';
import { handleCalibration } from './routes/calibration.js';
import { handleProducts } from './routes/products.js';
import { handleAssistant } from './routes/assistant.js';
import { handleStripe } from './routes/stripe.js';
import { corsHeaders, getCorsHeaders, jsonResponse, errorResponse } from './utils.js';

async function handleRequest(request, env, ctx) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(request) });
  }

  // CSRF: reject mutations from unknown origins
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    const dynamic = getCorsHeaders(request);
    if (origin && dynamic['Access-Control-Allow-Origin'] !== origin) {
      return errorResponse('Origin not allowed', 403, request);
    }
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Auth routes (public)
    if (path.startsWith('/api/auth')) {
      return await handleAuth(request, env, path);
    }

    // Protected routes
    if (path === '/api/entries/analyze-text') {
      return await handleAnalyzeText(request, env, ctx);
    }

    if (path.startsWith('/api/entries')) {
      return await handleEntries(request, env, path);
    }

    if (path.startsWith('/api/progress')) {
      return await handleProgress(request, env, path);
    }

    if (path.startsWith('/api/profile')) {
      return await handleProfile(request, env, path);
    }

    if (path.startsWith('/api/analyze')) {
      return await handleAnalyze(request, env, path, ctx);
    }

    if (path.startsWith('/api/supplements')) {
      return await handleSupplements(request, env, path);
    }

    if (path.startsWith('/api/admin')) {
      return await handleAdmin(request, env, path);
    }

    if (path.startsWith('/api/calibration')) {
      return await handleCalibration(request, env, path);
    }

    if (path.startsWith('/api/products')) {
      return await handleProducts(request, env, path);
    }

    if (path.startsWith('/api/assistant')) {
      return await handleAssistant(request, env, path, ctx);
    }

    if (path === '/api/create-checkout-session' ||
        path === '/api/stripe-webhook' ||
        path === '/api/subscription-status') {
      return await handleStripe(request, env, path);
    }

    // Health check
    if (path === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    return errorResponse('Route not found', 404);

  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      route: path,
      method: request.method,
      message: err.message,
      stack: err.stack,
    }));
    Sentry.captureException(err);
    return errorResponse('Internal server error', 500);
  }
}

export default {
  fetch: (request, env, ctx) => {
    // If no DSN configured, run without Sentry (local dev / missing secret)
    if (!env.SENTRY_DSN) return handleRequest(request, env, ctx);

    return Sentry.withSentry(
      () => ({
        dsn: env.SENTRY_DSN,
        tracesSampleRate: 0.1,
      }),
      { fetch: handleRequest },
    ).fetch(request, env, ctx);
  },
};
