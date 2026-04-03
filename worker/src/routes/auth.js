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
    if (age && Number(age) < 16) {
      return errorResponse('Debes tener al menos 16 años para registrarte');
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

    // Welcome email (non-blocking)
    if (env.RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Caliro <noreply@caliro.dev>',
          to: [email.toLowerCase()],
          subject: 'Bienvenido a Caliro',
          html: welcomeEmailHTML(name),
        }),
      }).catch(() => {});
    }

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

  // POST /api/auth/forgot-password
  if (path === '/api/auth/forgot-password' && request.method === 'POST') {
    const { email } = await request.json();

    // Always respond the same way — prevent email enumeration
    const okResponse = () => jsonResponse({ message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' });

    if (!email) return okResponse();

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 3 per email per hour
    const allowed = await checkRateLimit(env, `reset:${normalizedEmail}`, 3, 3600);
    if (!allowed) return okResponse(); // silent — don't reveal rate limit

    // Artificial delay to prevent timing attacks
    await new Promise(r => setTimeout(r, 200));

    const user = await env.DB.prepare(
      'SELECT id, name FROM users WHERE email = ?'
    ).bind(normalizedEmail).first();

    if (!user) return okResponse(); // user doesn't exist — same response

    // Generate token
    const rawToken = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await sha256(rawToken);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 3600; // 1 hour

    // Delete any existing unused tokens for this user
    await env.DB.prepare(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL'
    ).bind(user.id).run();

    // Store hashed token
    await env.DB.prepare(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, tokenHash, expiresAt).run();

    // Send email via Resend
    const resetLink = `https://caliro.dev/app/reset-password?token=${rawToken}`;
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Caliro <noreply@caliro.dev>',
          to: [normalizedEmail],
          subject: 'Restablecer contraseña — Caliro',
          html: resetEmailHTML(user.name || 'usuario', resetLink),
        }),
      });
      if (!emailRes.ok) {
        const err = await emailRes.text();
        console.error('Resend error:', emailRes.status, err);
      }
    } catch (e) { console.error('Resend fetch error:', e.message); }

    return okResponse();
  }

  // POST /api/auth/reset-password
  if (path === '/api/auth/reset-password' && request.method === 'POST') {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return errorResponse('Token y nueva contraseña son obligatorios');
    }
    if (newPassword.length < 8) {
      return errorResponse('La contraseña debe tener al menos 8 caracteres');
    }

    const tokenHash = await sha256(token);
    const now = Math.floor(Date.now() / 1000);

    const row = await env.DB.prepare(
      'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?'
    ).bind(tokenHash).first();

    if (!row) return errorResponse('Enlace inválido o expirado', 400);
    if (row.used_at) return errorResponse('Este enlace ya fue utilizado', 400);
    if (now > row.expires_at) return errorResponse('El enlace ha expirado. Solicita uno nuevo.', 400);

    // Hash new password and update user
    const hashed = await hashPassword(newPassword);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(hashed, row.user_id),
      env.DB.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').bind(now, row.id),
    ]);

    return jsonResponse({ message: 'Contraseña actualizada correctamente' });
  }

  return errorResponse('Not found', 404);
}

// ── Helpers ─────────────────────────────────────────────────

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function resetEmailHTML(name, link) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F2EE;font-family:'DM Sans',system-ui,sans-serif;">
<div style="max-width:440px;margin:40px auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-family:Georgia,serif;font-size:28px;font-style:italic;color:#16a34a;">Caliro</span>
  </div>
  <div style="background:#ffffff;border-radius:16px;padding:28px 24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 12px;color:#111;">Hola ${name},</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px;">
      Has solicitado restablecer tu contraseña. Haz clic en el botón para crear una nueva.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">
        Restablecer contraseña
      </a>
    </div>
    <p style="font-size:12px;color:#999;line-height:1.5;margin:16px 0 0;">
      Este enlace expira en <strong>1 hora</strong>.<br>
      Si no solicitaste este cambio, ignora este email — tu contraseña no cambiará.
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#bbb;margin-top:24px;">
    caliro.dev — Seguimiento calórico con IA
  </p>
</div>
</body></html>`;
}

function welcomeEmailHTML(name) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F2EE;font-family:'DM Sans',system-ui,sans-serif;">
<div style="max-width:440px;margin:40px auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-family:Georgia,serif;font-size:28px;font-style:italic;color:#22c55e;">Caliro</span>
  </div>
  <div style="background:#ffffff;border-radius:16px;padding:28px 24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 12px;color:#111;">Bienvenido, ${name}!</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
      Tu cuenta en Caliro está lista. Ya puedes registrar tus comidas con foto, texto o escáner
      — la IA aprende de tu dieta real y mejora con cada corrección.
    </p>
    <p style="font-size:13px;color:#888;line-height:1.5;margin:0 0 20px;">
      Tres cosas para empezar bien:
    </p>
    <div style="margin:0 0 20px;">
      <p style="font-size:13px;color:#555;margin:0 0 8px;">1. <strong>Registra tu primera comida</strong> — foto, texto o escáner</p>
      <p style="font-size:13px;color:#555;margin:0 0 8px;">2. <strong>Configura tu objetivo</strong> con la calculadora TDEE en Perfil</p>
      <p style="font-size:13px;color:#555;margin:0;">3. <strong>Corrige las estimaciones</strong> si no son exactas — el motor aprende</p>
    </div>
    <div style="text-align:center;">
      <a href="https://caliro.dev/app" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500;">
        Abrir Caliro
      </a>
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#bbb;margin-top:24px;">
    caliro.dev — Seguimiento calórico con IA
  </p>
</div>
</body></html>`;
}
