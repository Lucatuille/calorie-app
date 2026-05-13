// ============================================================
//  AUTH ROUTES — /api/auth/register  /api/auth/login
// ============================================================

import { jsonResponse, errorResponse, hashPassword, verifyPassword, needsHashUpgrade, signJWT, verifyJWT, checkRateLimit, getIP } from '../utils.js';

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
    if (password.length < 12) {
      return errorResponse('La contraseña debe tener al menos 12 caracteres');
    }
    if (age && Number(age) < 17) {
      return errorResponse('Debes tener al menos 17 años para registrarte');
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

    // Welcome email — await to ensure it completes before Worker exits
    if (env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Caliro <noreply@caliro.dev>',
            reply_to: 'contacto@caliro.dev',
            to: [email.toLowerCase()],
            subject: 'Bienvenido a Caliro',
            html: welcomeEmailHTML(name, email.toLowerCase()),
          }),
        });
      } catch { /* silent — don't fail registration if email fails */ }
    }

    return jsonResponse({ token, user: { id: userId, name, email, is_admin: 0, access_level: 3, onboarding_completed: 0, age: age||null, weight: weight||null, height: height||null, gender: gender||null, onboarding_state: {}, has_unread_digest: false } }, 201);
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

    let onboardingState = {};
    try { onboardingState = JSON.parse(user.onboarding_state || '{}'); } catch {}
    const has_unread_digest = await computeHasUnreadDigest(user.id, accessLevel, onboardingState, env);

    return jsonResponse({
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin, access_level: accessLevel, onboarding_completed: user.onboarding_completed ?? 1, age: user.age, weight: user.weight, height: user.height, gender: user.gender, target_calories: user.target_calories, target_protein: user.target_protein, target_carbs: user.target_carbs, target_fat: user.target_fat, onboarding_state: onboardingState, has_unread_digest }
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
      'SELECT id, name, email, is_admin, access_level, onboarding_completed, age, weight, height, gender, target_calories, target_protein, target_carbs, target_fat, onboarding_state FROM users WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) return errorResponse('Usuario no encontrado', 404);

    const accessLevel = user.access_level ?? 3; // fail-safe: nivel desconocido → Free (restrictivo)
    const isAdmin     = user.is_admin || (accessLevel === 99 ? 1 : 0);
    const token = await signJWT(
      { userId: user.id, email: user.email, name: user.name, is_admin: isAdmin, access_level: accessLevel },
      env.JWT_SECRET
    );

    await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(user.id).run();

    let onboardingState = {};
    try { onboardingState = JSON.parse(user.onboarding_state || '{}'); } catch {}
    const has_unread_digest = await computeHasUnreadDigest(user.id, accessLevel, onboardingState, env);

    return jsonResponse({
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin, access_level: accessLevel, onboarding_completed: user.onboarding_completed ?? 1, age: user.age, weight: user.weight, height: user.height, gender: user.gender, target_calories: user.target_calories, target_protein: user.target_protein, target_carbs: user.target_carbs, target_fat: user.target_fat, onboarding_state: onboardingState, has_unread_digest }
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
          reply_to: 'contacto@caliro.dev',
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
    if (newPassword.length < 12) {
      return errorResponse('La contraseña debe tener al menos 12 caracteres');
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

// Calcula si el user tiene digest semanal generado pero aún no visto.
// Solo Pro/Founder/Admin (1, 2, 99) tienen digest. Free → siempre false.
async function computeHasUnreadDigest(userId, accessLevel, onboardingState, env) {
  if (![1, 2, 99].includes(accessLevel)) return false;

  // Lunes de esta semana en YYYY-MM-DD (UTC simple, coherente con assistant.js)
  const now = new Date();
  const dow = now.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + offset);
  const weekStart = monday.toISOString().split('T')[0];

  const exists = await env.DB.prepare(
    'SELECT 1 FROM assistant_digests WHERE user_id = ? AND week_start = ? LIMIT 1'
  ).bind(userId, weekStart).first().catch(() => null);

  if (!exists) return false;

  const seenAt = onboardingState?.first_digest_seen_at;
  if (!seenAt) return true; // nunca visto

  // Si lo vio antes del lunes de esta semana, hay uno nuevo no visto
  return new Date(seenAt) < new Date(weekStart + 'T00:00:00Z');
}

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

function welcomeEmailHTML(name, email) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Bienvenido a Caliro</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0; padding: 0; background-color: #F5F2EE; }
    a { color: inherit; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .card { padding: 32px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F2EE;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F2EE;">
    <tr>
      <td align="center" style="padding: 44px 20px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <span style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:32px;color:#22c55e;letter-spacing:-0.5px;">Caliro</span>
            </td>
          </tr>
          <tr>
            <td class="card" style="background-color:#ffffff;border-radius:16px;box-shadow:0 2px 16px rgba(0,0,0,0.07);border:0.5px solid #E8E4DE;padding:44px 48px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom:16px;">
                    <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:20px;font-weight:500;color:#111111;line-height:1.3;">Hola ${name} 👋</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:32px;">
                    <p style="margin:0 0 12px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;color:#444444;line-height:1.75;">
                      Soy Luca, el estudiante de Barcelona que construyó Caliro. La idea era simple: una app de nutrición que usa IA de verdad — no tablas estáticas, no estimaciones genéricas.
                    </p>
                    <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;color:#444444;line-height:1.75;">
                      Caliro aprende cómo comes <em>tú</em> y te responde con tus datos reales. Aquí te explico cómo funciona el ciclo en tres pasos:
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:28px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr><td style="border-top:1px solid #EEEBE6;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="44" valign="top" style="padding-right:16px;padding-top:2px;">
                          <div style="width:36px;height:36px;background-color:#F0FAF4;border-radius:10px;text-align:center;line-height:36px;font-size:17px;">📸</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 3px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;color:#111111;">Registra con una foto, texto o escáner</p>
                          <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#888888;line-height:1.6;">La IA analiza la imagen y devuelve calorías y macros en segundos. También puedes describir lo que has comido o escanear el código de barras de un producto.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px;padding-top:16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="44" valign="top" style="padding-right:16px;padding-top:2px;">
                          <div style="width:36px;height:36px;background-color:#F0FAF4;border-radius:10px;text-align:center;line-height:36px;font-size:17px;">🎯</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 3px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;color:#111111;">La IA se calibra con cada corrección que haces</p>
                          <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#888888;line-height:1.6;">Si ajustas una estimación, el motor aprende. Cuanto más lo usas, más preciso se vuelve para ti — no para el usuario promedio.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:32px;padding-top:16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="44" valign="top" style="padding-right:16px;padding-top:2px;">
                          <div style="width:36px;height:36px;background-color:#F0FAF4;border-radius:10px;text-align:center;line-height:36px;font-size:17px;">💬</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 3px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;color:#111111;">El asistente responde con tus datos reales</p>
                          <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#888888;line-height:1.6;">Pregunta "¿qué debería cenar para llegar a mi objetivo de proteína?" y el asistente lo calcula con tu historial completo, no con consejos genéricos.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:32px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr><td style="border-top:1px solid #EEEBE6;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="https://caliro.dev/app/" target="_blank"
                       style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;text-decoration:none;padding:14px 40px;border-radius:9999px;letter-spacing:0.1px;">
                      Abrir Caliro
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#F5F2EE;border-radius:12px;padding:20px 22px;">
                    <p style="margin:0 0 10px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#555555;line-height:1.75;">
                      Si algo no funciona como esperas, o simplemente quieres darme feedback, responde directamente a este email. Lo leo yo y te contesto personalmente.
                    </p>
                    <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">
                      — Luca, creador de Caliro
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 6px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12px;color:#BBBBBB;">
                Has recibido este email porque te registraste en <a href="https://caliro.dev" style="color:#BBBBBB;text-decoration:underline;">caliro.dev</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Email día 3 — chequeo personal + recordatorio de features no descubiertas.
// Se envía automáticamente desde scheduled.js (cron daily) a users registrados
// hace exactamente 3 días que aún no lo han recibido.
export function day3EmailHTML(name) {
  const safeName = (name && String(name).trim()) || 'amigo';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>¿Qué tal va tu primera semana con Caliro?</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0; padding: 0; background-color: #F5F2EE; }
    a { color: inherit; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .card { padding: 32px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F2EE;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F2EE;">
    <tr>
      <td align="center" style="padding: 44px 20px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <span style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:32px;color:#22c55e;letter-spacing:-0.5px;">Caliro</span>
            </td>
          </tr>
          <tr>
            <td class="card" style="background-color:#ffffff;border-radius:16px;box-shadow:0 2px 16px rgba(0,0,0,0.07);border:0.5px solid #E8E4DE;padding:44px 48px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom:16px;">
                    <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:20px;font-weight:500;color:#111111;line-height:1.3;">Hola ${safeName},</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:32px;">
                    <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;color:#444444;line-height:1.75;">
                      Han pasado tres días desde que te uniste a Caliro. Quería saber qué tal va — y de paso contarte tres cosas que suelen pasar a estas alturas y que conviene saber.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:28px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr><td style="border-top:1px solid #EEEBE6;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="44" valign="top" style="padding-right:16px;padding-top:2px;">
                          <div style="width:36px;height:36px;background-color:#F0FAF4;border-radius:10px;text-align:center;line-height:36px;font-size:17px;">💬</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 3px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;color:#111111;">El Chef ya conoce tus datos</p>
                          <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#888888;line-height:1.6;">
                            Si le preguntas "¿qué cenar para llegar a mi proteína?" o "¿por qué no bajo de peso?", contesta con tu historial real — no consejos genéricos. Está en la pestaña Chef.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px;padding-top:16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="44" valign="top" style="padding-right:16px;padding-top:2px;">
                          <div style="width:36px;height:36px;background-color:#F0FAF4;border-radius:10px;text-align:center;line-height:36px;font-size:17px;">📊</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 3px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;color:#111111;">Este domingo: tu primer resumen semanal</p>
                          <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#888888;line-height:1.6;">
                            Si has registrado al menos 5 días, el Chef te envía un análisis: adherencia, patrón de finde vs entre semana, áreas a mejorar. Sin metáforas, solo números.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:32px;padding-top:16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="44" valign="top" style="padding-right:16px;padding-top:2px;">
                          <div style="width:36px;height:36px;background-color:#F0FAF4;border-radius:10px;text-align:center;line-height:36px;font-size:17px;">⚡</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 3px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;color:#111111;">Tus comidas habituales se van llenando solas</p>
                          <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#888888;line-height:1.6;">
                            Cuando registras la misma comida 2-3 veces, aparece como sugerencia rápida al ir a registrar. Un toque y listo — sin foto ni IA. Acelera mucho el día a día.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:32px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr><td style="border-top:1px solid #EEEBE6;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="https://caliro.dev/app/" target="_blank"
                       style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;text-decoration:none;padding:14px 40px;border-radius:9999px;letter-spacing:0.1px;">
                      Abrir Caliro
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#F5F2EE;border-radius:12px;padding:20px 22px;">
                    <p style="margin:0 0 10px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#555555;line-height:1.75;">
                      ¿Algo se ha quedado a medias? ¿Una estimación muy fuera, un registro raro, una feature que no encuentras? Responde directamente a este email. Lo leo yo y te contesto personalmente.
                    </p>
                    <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;color:#777777;">
                      — Luca
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12px;color:#BBBBBB;">
                Recibes este email porque te uniste a Caliro hace 3 días en <a href="https://caliro.dev" style="color:#BBBBBB;text-decoration:underline;">caliro.dev</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
