// ============================================================
//  AUTH ROUTES — /api/auth/register  /api/auth/login
// ============================================================

import { jsonResponse, errorResponse, hashPassword, verifyPassword, signJWT, verifyJWT } from '../utils.js';

export async function handleAuth(request, env, path) {

  // POST /api/auth/register
  if (path === '/api/auth/register' && request.method === 'POST') {
    const { name, email, password, age, weight, height, gender } = await request.json();

    if (!name || !email || !password) {
      return errorResponse('Nombre, email y contraseña son obligatorios');
    }

    // Check if user exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existing) return errorResponse('Este email ya está registrado');

    const hashed = await hashPassword(password);

    // BETA: nuevos usuarios reciben access_level=1 (Fundador) durante la beta.
    // ⚠️  CAMBIAR A 3 (Free) antes de abrir el registro público con Stripe.
    const result = await env.DB.prepare(
      `INSERT INTO users (name, email, password, age, weight, height, gender, access_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(name, email.toLowerCase(), hashed, age || null, weight || null, height || null, gender || null).run();

    const userId = result.meta.last_row_id;
    const token  = await signJWT({ userId, email, name, is_admin: 0, access_level: 1 }, env.JWT_SECRET);

    return jsonResponse({ token, user: { id: userId, name, email, is_admin: 0, access_level: 1, onboarding_completed: 0 } }, 201);
  }

  // POST /api/auth/login
  if (path === '/api/auth/login' && request.method === 'POST') {
    const { email, password } = await request.json();

    if (!email || !password) return errorResponse('Email y contraseña requeridos');

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user) return errorResponse('Credenciales incorrectas', 401);

    const valid = await verifyPassword(password, user.password);
    if (!valid)  return errorResponse('Credenciales incorrectas', 401);

    const accessLevel = user.access_level ?? 3; // fail-safe: nivel desconocido → Free (restrictivo)
    const isAdmin     = user.is_admin || (accessLevel === 99 ? 1 : 0);
    const token = await signJWT(
      { userId: user.id, email: user.email, name: user.name, is_admin: isAdmin, access_level: accessLevel },
      env.JWT_SECRET
    );

    return jsonResponse({
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin, access_level: accessLevel, onboarding_completed: user.onboarding_completed ?? 1 }
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
      'SELECT id, name, email, is_admin, access_level, onboarding_completed FROM users WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);

    const accessLevel = user.access_level ?? 3; // fail-safe: nivel desconocido → Free (restrictivo)
    const isAdmin     = user.is_admin || (accessLevel === 99 ? 1 : 0);
    const token = await signJWT(
      { userId: user.id, email: user.email, name: user.name, is_admin: isAdmin, access_level: accessLevel },
      env.JWT_SECRET
    );

    return jsonResponse({
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin, access_level: accessLevel, onboarding_completed: user.onboarding_completed ?? 1 }
    });
  }

  return errorResponse('Not found', 404);
}
