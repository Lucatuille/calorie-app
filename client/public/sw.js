const CACHE_NAME = 'caliro-v8';
const STATIC_ASSETS = [
  '/app/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install — cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Network First para todo (garantiza actualizaciones), Cache como fallback offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Páginas estáticas fuera de la app — no interceptar, dejar al navegador
  if (url.pathname === '/invite' || url.pathname === '/invite.html') {
    return;
  }

  // API calls — siempre red, nunca cache
  if (url.hostname.includes('workers.dev') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Navegación a rutas de la app (/app/*) — Network First, fallback a /app/ cacheado
  // Usa request.url (string) en lugar de request (objeto) para evitar problemas con
  // mode:'navigate' en subrequests de iOS PWA standalone
  if (request.mode === 'navigate' && url.pathname.startsWith('/app')) {
    event.respondWith(
      fetch(request.url)
        .catch(() => caches.match('/app/').then(r => r || fetch('/app/')))
    );
    return;
  }

  // App shell y assets — Network First, fallback a cache si offline
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
