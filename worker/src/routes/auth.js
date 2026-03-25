// ============================================================
//  AUTH ROUTES — /api/auth/register  /api/auth/login
// ============================================================

import { jsonResponse, errorResponse, hashPassword, verifyPassword, needsHashUpgrade, signJWT, verifyJWT } from '../utils.js';

// ── Rate limiting (fija ventana deslizante en D1) ────────────
// Tabla: auth_attempts (key TEXT PK, count INT, window_start INT)
// Ejecutar una vez: CREATE TABLE IF NOT EXISTS auth_attempts
//   (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);

async function checkRateLimit(env, key, limit, windowSecs) {
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

    if (row.count >= limit) return false; // límite superado

    await env.DB.prepare(
      'UPDATE auth_attempts SET count = count + 1 WHERE key = ?'
    ).bind(key).run();
    return true;
  } catch {
    // Si la tabla no existe o falla D1 — dejar pasar (no bloquear usuarios legítimos)
    return true;
  }
}

function getIP(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    || 'unknown';
}

export async function handleAuth(request, env, path) {

  // POST /api/auth/register
  if (path === '/api/auth/register' && request.method === 'POST') {
    const ip = getIP(request);
    const ipOk = await checkRateLimit(env, `register:ip:${ip}`, 10, 60 * 60);
    if (!ipOk) {
      return jsonResponse({ error: 'Demasiados registros desde esta IP. Espera un rato.' }, 429);
    }

    const { name, email, password, age, weight, height, gender } = await request.json();

    if (!name || !email || !password) {
      return errorResponse('Nombre, email y contraseña son obligatorios');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('Formato de email inválido');
    }
    if (password.length < 8) {
      return errorResponse('La contraseña debe tener al menos 8 caracteres');
    }

    // Check if user exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existing) return errorResponse('Este email ya está registrado');

    const hashed = await hashPassword(password);

    const result = await env.DB.prepare(
      `INSERT INTO users (name, email, password, age, weight, height, gender, access_level, onboarding_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 3, 0)`
    ).bind(name, email.toLowerCase(), hashed, age || null, weight || null, height || null, gender || null).run();

    const userId = result.meta.last_row_id;
    const token  = await signJWT({ userId, email, name, is_admin: 0, access_level: 3 }, env.JWT_SECRET);

    return jsonResponse({ token, user: { id: userId, name, email, is_admin: 0, access_level: 3, onboarding_completed: 0, age: age||null, weight: weight||null, height: height||null, gender: gender||null } }, 201);
  }

  // POST /api/auth/login
  if (path === '/api/auth/login' && request.method === 'POST') {
    const ip = getIP(request);
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) return errorResponse('Email y contraseña requeridos');

    const [ipOk, emailOk] = await Promise.all([
      checkRateLimit(env, `login:ip:${ip}`,             20, 15 * 60),
      checkRateLimit(env, `login:email:${email.toLowerCase()}`, 10, 15 * 60),
    ]);
    if (!ipOk || !emailOk) {
      return jsonResponse({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, 429);
    }

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user) return errorResponse('Credenciales incorrectas', 401);

    const valid = await verifyPassword(password, user.password);
    if (!valid)  return errorResponse('Credenciales incorrectas', 401);

    // Auto-upgrade legacy SHA-256 hash to PBKDF2 on successful login
    if (needsHashUpgrade(user.password)) {
      const upgraded = await hashPassword(password);
      await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?')
        .bind(upgraded, user.id).run().catch(() => {});
    }

    const accessLevel = user.access_level ?? 3; // fail-safe: nivel desconocido → Free (restrictivo)
    const isAdmin     = user.is_admin || (accessLevel === 99 ? 1 : 0);
    const token = await signJWT(
      { userId: user.id, email: user.email, name: user.name, is_admin: isAdmin, access_level: accessLevel },
      env.JWT_SECRET
    );

    await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

    return jsonResponse({
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin, access_level: accessLevel, onboarding_completed: user.onboarding_completed ?? 1, age: user.age, weight: user.weight, height: user.height, gender: user.gender, target_calories: user.target_calories, target_protein: user.target_protein, target_carbs: user.target_carbs, target_fat: user.target_fat }
    });
  }

  // POST /api/auth/refresh — exchange any valid token for a fresh one with current schema
  if (path === '/api/auth/refresh' && request.method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Token requerido', 401);

    const oldToken = authHeader.slice(7);
    const payload = await verifyJWT(oldToken, env.JWT_SECRET);
    if (!payload) return errorResponse('Token inválido o expirado', 401);

    const user = await env.DB.prepare(
      'SELECT id, name, email, is_admin, access_level, onboarding_completed, age, weight, height, gender, target_calories, target_protein, target_carbs, target_fat FROM users WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);

    const accessLevel = user.access_level ?? 3; // fail-safe: nivel desconocido → Free (restrictivo)
    const isAdmin     = user.is_admin || (accessLevel === 99 ? 1 : 0);
    const token = await signJWT(
      { userId: user.id, email: user.email, name: user.name, is_admin: isAdmin, access_level: accessLevel },
      env.JWT_SECRET
    );

    await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

    return jsonResponse({
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin, access_level: accessLevel, onboarding_completed: user.onboarding_completed ?? 1, age: user.age, weight: user.weight, height: user.height, gender: user.gender, target_calories: user.target_calories, target_protein: user.target_protein, target_carbs: user.target_carbs, target_fat: user.target_fat }
    });
  }

  return errorResponse('Not found', 404);
}
