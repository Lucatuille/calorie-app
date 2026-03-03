// ============================================================
//  CALORIE APP — Cloudflare Worker API
// ============================================================

import { handleAuth } from './routes/auth.js';
import { handleEntries } from './routes/entries.js';
import { handleProgress } from './routes/progress.js';
import { handleProfile } from './routes/profile.js';
import { handleAnalyze } from './routes/analyze.js';
import { corsHeaders, jsonResponse, errorResponse } from './utils.js';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Auth routes (public)
      if (path.startsWith('/api/auth')) {
        return await handleAuth(request, env, path);
      }

      // Protected routes
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
        return await handleAnalyze(request, env, path);
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      return errorResponse('Route not found', 404);

    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse('Internal server error', 500);
    }
  }
};
