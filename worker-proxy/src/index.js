// ============================================================
//  Caliro — Frontend Proxy Worker
//  Routes caliro.dev/* → calorie-app.pages.dev
//  More resilient than Pages custom domain binding
// ============================================================

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://calorie-app-api.lucatuille.workers.dev https://*.sentry.io https://*.ingest.sentry.io",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'calorie-app.pages.dev';

    const response = await fetch(new Request(url.toString(), request));

    // Clone response to add security headers
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
