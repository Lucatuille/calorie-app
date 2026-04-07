// ============================================================
//  UTILS — Responses, CORS, JWT
// ============================================================

const ALLOWED_ORIGINS = [
  'https://caliro.dev',
  'https://calorie-app.pages.dev',
  'https://lucaeats.org',
  'http://localhost:5173',
];

export function getCorsHeaders(request) {
  const origin = request?.headers?.get?.('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timezone',
    'Vary': 'Origin',
  };
}

// Legacy export for files that don't pass request — falls back to primary origin
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://caliro.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timezone',
  'Vary': 'Origin',
};

// Request context — set once per request in index.js, used by jsonResponse/errorResponse
let _currentRequest = null;
export function setRequestContext(request) { _currentRequest = request; }

export function jsonResponse(data, status = 200, request = null) {
  const req = request || _currentRequest;
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(req ? getCorsHeaders(req) : corsHeaders) },
  });
}

export function errorResponse(message, status = 400, request = null) {
  return jsonResponse({ error: message }, status, request);
}

// ── JWT (no external libs — pure Web Crypto) ─────────────────

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeBase64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJWT(payload, secret) {
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = base64url(new TextEncoder().encode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  })));
  const key  = await getKey(secret);
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${base64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    const key = await getKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      decodeBase64url(sig),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(body)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function authenticate(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return verifyJWT(token, env.JWT_SECRET);
}

// ── Verificación Pro desde BD (nunca confiar solo en el JWT) ──
// Usar en TODOS los endpoints Pro: /progress/advanced, /calibration/profile, etc.
// El JWT puede estar desactualizado o manipulado en localStorage.
// Retorna el objeto usuario enriquecido (JWT + DB) o null si no autenticado/sin acceso.
const PRO_LEVELS = [1, 2, 99]; // Fundador, Pro, Admin

export async function requireProAccess(request, env) {
  const user = await authenticate(request, env);
  if (!user) return null;
  const row = await env.DB.prepare(
    'SELECT id, name, access_level FROM users WHERE id = ?'
  ).bind(user.userId).first();
  if (!row) return null;
  if (row.access_level === 0) return 'waitlist';
  if (!PRO_LEVELS.includes(row.access_level)) return null;
  return { ...user, ...row };
}

// Devuelve la Response correcta según el resultado de requireProAccess.
// Úsalo en todos los endpoints Pro para consistencia.
export function proAccessDenied(result) {
  if (result === 'waitlist') return errorResponse('Tu cuenta está en lista de espera.', 403);
  return errorResponse('Se requiere plan Pro', 403);
}

// ── Client timezone — get "today" from X-Timezone header ─────
export function getClientToday(request) {
  const tz = request?.headers?.get?.('X-Timezone');
  if (tz) {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: tz });
    } catch { /* invalid timezone — fall through */ }
  }
  return new Date().toISOString().split('T')[0]; // UTC fallback
}

// ── Password hashing (PBKDF2 with salt — Web Crypto) ────────
// Format: "pbkdf2:<iterations>:<base64salt>:<base64hash>"
// Legacy SHA-256 hashes (no prefix) are auto-detected and verified,
// then upgraded on next successful login.

const PBKDF2_ITERATIONS = 100000;

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, 256
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${base64url(salt)}:${base64url(derived)}`;
}

export async function verifyPassword(password, storedHash) {
  // PBKDF2 hash (new format)
  if (storedHash.startsWith('pbkdf2:')) {
    const [, iterations, saltB64, hashB64] = storedHash.split(':');
    const salt = decodeBase64url(saltB64);
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: Number(iterations), hash: 'SHA-256' },
      key, 256
    );
    return base64url(derived) === hashB64;
  }
  // Legacy SHA-256 fallback (no salt, no prefix)
  const encoded = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return base64url(hash) === storedHash;
}

// Check if a stored hash needs upgrading to PBKDF2
export function needsHashUpgrade(storedHash) {
  return !storedHash.startsWith('pbkdf2:');
}

// ── Rate limiting (sliding window en D1) ─────────────────────
// Tabla: auth_attempts (key TEXT PK, count INT, window_start INT)
// Reutilizamos la misma tabla para todos los rate limits del worker.

export async function checkRateLimit(env, key, limit, windowSecs) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = await env.DB.prepare(
      'SELECT count, window_start FROM auth_attempts WHERE key = ?'
    ).bind(key).first();

    if (!row || now - row.window_start >= windowSecs) {
      // Nueva ventana — resetear
      await env.DB.prepare(`
        INSERT INTO auth_attempts (key, count, window_start) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start
      `).bind(key, now).run();
      return true;
    }

    if (row.count >= limit) return false;

    await env.DB.prepare(
      'UPDATE auth_attempts SET count = count + 1 WHERE key = ?'
    ).bind(key).run();
    return true;
  } catch {
    // Si la tabla no existe o falla D1 — dejar pasar (no bloquear usuarios legítimos)
    return true;
  }
}

export function getIP(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    || 'unknown';
}

// Helper: aplica rate limit y devuelve Response 429 si bloqueado, o null si OK.
// Uso típico:
//   const limited = await rateLimit(env, request, `analyze:${userId}`, 10, 60);
//   if (limited) return limited;
export async function rateLimit(env, request, key, limit, windowSecs, message = 'Demasiadas peticiones. Espera un momento.') {
  const ok = await checkRateLimit(env, key, limit, windowSecs);
  if (!ok) return jsonResponse({ error: message }, 429, request);
  return null;
}
