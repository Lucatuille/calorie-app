// ============================================================
//  Caliro — Frontend Proxy Worker
//  Routes caliro.dev/* → calorie-app.pages.dev
//  More resilient than Pages custom domain binding
// ============================================================

// Notas sobre directivas:
// - 'unsafe-inline' en script-src: requerido por los <script> inline de app.html
//   (JSON-LD, theme detection, redirect a /app)
// - worker-src blob:: requerido por Sentry session replay y otros libs que spawnean workers
// - connect-src incluye fonts.googleapis.com y fonts.gstatic.com porque el service worker
//   (sw.js) reenvía los fetches con fetch() — Chrome los trata como connect-src aunque
//   originalmente vengan de un <link rel=stylesheet>
// - api-gateway.umami.dev: endpoint donde Umami v2 envía los eventos (separado del script)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cloud.umami.is",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://calorie-app-api.lucatuille.workers.dev https://*.sentry.io https://*.ingest.sentry.io https://cloud.umami.is https://api-gateway.umami.dev https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
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
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), interest-cohort=()');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
