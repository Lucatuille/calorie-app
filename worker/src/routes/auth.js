// ============================================================
//  AUTH ROUTES — /api/auth/register  /api/auth/login
// ============================================================

import { jsonResponse, errorResponse, hashPassword, verifyPassword, signJWT } from '../utils.js';

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

    const result = await env.DB.prepare(
      `INSERT INTO users (name, email, password, age, weight, height, gender)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(name, email.toLowerCase(), hashed, age || null, weight || null, height || null, gender || null).run();

    const userId = result.meta.last_row_id;
    const token  = await signJWT({ userId, email, name }, env.JWT_SECRET);

    return jsonResponse({ token, user: { id: userId, name, email } }, 201);
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

    const token = await signJWT({ userId: user.id, email: user.email, name: user.name }, env.JWT_SECRET);

    return jsonResponse({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  }

  return errorResponse('Not found', 404);
}
