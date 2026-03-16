# 👑 Sistema de Niveles, Insignias y Gestión desde Admin

## Contexto
Implementar desde cero la infraestructura completa de niveles de acceso en LucaEats. Incluye:
1. Estructura de datos en D1 y Worker
2. Insignias visibles en el dashboard junto a la racha
3. Límite de IA por nivel
4. Gestión de roles desde el panel admin con un click

---

## 1. BASE DE DATOS — Columnas en D1

**Avisar para ejecutar en D1 Console:**

```sql
-- Nivel de acceso del usuario
ALTER TABLE users ADD COLUMN access_level INTEGER NOT NULL DEFAULT 0;
-- 0 = Waitlist (sin acceso)
-- 1 = Fundador (beta testers, acceso completo + IA ilimitada)
-- 2 = Pro (pago, IA ilimitada)
-- 3 = Free (registro público, 3 análisis IA/día)
-- 99 = Admin (acceso total)

-- Dar nivel Fundador a todos los usuarios actuales (ya tienen acceso)
UPDATE users SET access_level = 1 WHERE access_level = 0;

-- Dar nivel Admin al dueño
UPDATE users SET access_level = 99 WHERE email = 'TU_EMAIL_AQUI';
```

**IMPORTANTE:** Los usuarios actuales pasan automáticamente a Fundador (nivel 1) — nadie pierde acceso.

---

## 2. DEFINICIÓN DE NIVELES — `worker/src/utils/levels.js`

```js
export const ACCESS_LEVELS = {
  WAITLIST: 0,
  FOUNDER:  1,
  PRO:      2,
  FREE:     3,
  ADMIN:    99,
};

export const LEVEL_CONFIG = {
  0:  { name: 'Waitlist',  badge: null,          ai_limit: 0,    can_access: false },
  1:  { name: 'Fundador',  badge: '🌱 Fundador', ai_limit: null, can_access: true  },
  2:  { name: 'Pro',       badge: '∞ Pro',        ai_limit: null, can_access: true  },
  3:  { name: 'Free',      badge: null,           ai_limit: 3,    can_access: true  },
  99: { name: 'Admin',     badge: '👑 Admin',     ai_limit: null, can_access: true  },
};

// null = ilimitado, número = límite diario
export function getAiLimit(access_level) {
  return LEVEL_CONFIG[access_level]?.ai_limit ?? 3;
}

export function canAccess(access_level) {
  return LEVEL_CONFIG[access_level]?.can_access ?? false;
}
```

---

## 3. WORKER — Middleware de acceso

En `worker/src/utils/auth.js`, actualizar el middleware para verificar acceso:

```js
export async function requireAuth(request, env) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }
  
  // Verificar que tiene acceso (no está en waitlist)
  if (!canAccess(user.access_level)) {
    return new Response(JSON.stringify({ 
      error: 'waitlist',
      message: 'Tu cuenta está en lista de espera. Pronto tendrás acceso.'
    }), { status: 403 });
  }
  
  return user;
}
```

---

## 4. WORKER — Límite de IA diario

En los endpoints `/api/entries/analyze-photo` y `/api/entries/analyze-text`, añadir verificación de límite ANTES de llamar a Claude:

```js
// Verificar límite diario de IA
const limit = getAiLimit(user.access_level);

if (limit !== null) {
  const today = new Date().toLocaleDateString('en-CA');
  
  const usage = await env.DB.prepare(`
    SELECT COALESCE(count, 0) as count 
    FROM ai_usage_log 
    WHERE user_id = ? AND date = ?
  `).bind(user.id, today).first();
  
  const currentCount = usage?.count || 0;
  
  if (currentCount >= limit) {
    return new Response(JSON.stringify({
      error: 'ai_limit_reached',
      used: currentCount,
      limit: limit,
      message: `Has usado tus ${limit} análisis de IA de hoy. Se renuevan a las 00:00.`,
      upgrade_available: true
    }), { status: 429 });
  }
}

// Incrementar contador después de usar IA
await env.DB.prepare(`
  INSERT INTO ai_usage_log (user_id, date, count)
  VALUES (?, ?, 1)
  ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
`).bind(user.id, new Date().toLocaleDateString('en-CA')).run();
```

Crear tabla si no existe:
```sql
-- Añadir a D1 Console:
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  count   INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_log(user_id, date);
```

---

## 5. WORKER — Incluir access_level en el JWT

En `worker/src/routes/auth.js`, al generar el JWT incluir `access_level`:

```js
const payload = {
  userId: user.id,
  email: user.email,
  name: user.name,
  is_admin: user.access_level === 99,
  access_level: user.access_level,
  // ... resto de campos
};
```

También en `POST /api/auth/refresh` — devolver el token actualizado con `access_level`.

---

## 6. WORKER — Endpoint admin para cambiar roles

En `worker/src/routes/admin.js`:

```js
// PUT /api/admin/users/:id/role
export async function updateUserRole(request, env) {
  const url = new URL(request.url);
  const userId = url.pathname.split('/')[4]; // /api/admin/users/:id/role
  const { access_level } = await request.json();
  
  // Validar que el nivel es válido
  const validLevels = [0, 1, 2, 3]; // Admin no puede crear otros admins desde el panel
  if (!validLevels.includes(access_level)) {
    return new Response(JSON.stringify({ error: 'Nivel inválido' }), { status: 400 });
  }
  
  await env.DB.prepare(
    'UPDATE users SET access_level = ? WHERE id = ?'
  ).bind(access_level, userId).run();
  
  return new Response(JSON.stringify({ 
    success: true,
    user_id: userId,
    new_level: access_level,
    level_name: LEVEL_CONFIG[access_level].name
  }));
}
```

Registrar en `index.js`:
```js
router.put('/api/admin/users/:id/role', requireAdmin, updateUserRole)
```

---

## 7. FRONTEND — Badge en el Dashboard

### En `AuthContext.jsx`:
Exponer `access_level` del JWT en el contexto:
```js
const { access_level, is_admin } = parseJWT(token);
// Añadir al valor del contexto
```

### En `Dashboard.jsx` — junto a la racha:

Ahora mismo:
```
Luca 🔥 2 días
```

Nuevo:
```
Luca 🔥 2 días  [🌱 Fundador]
```

```jsx
import { LEVEL_CONFIG } from '../utils/levels';

const { user } = useAuth();
const levelInfo = LEVEL_CONFIG[user.access_level];

// Junto al nombre y la racha:
{levelInfo?.badge && (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '100px',
    fontSize: '12px',
    fontWeight: 500,
    marginLeft: '8px',
    ...getBadgeStyle(user.access_level)
  }}>
    {levelInfo.badge}
  </span>
)}
```

### Estilos por nivel:
```js
function getBadgeStyle(level) {
  switch(level) {
    case 99: return { background: '#1a1a1a', color: '#ffffff' }; // Admin: negro
    case 1:  return { background: '#1e3a2f', color: '#a8d5b5' }; // Fundador: verde oscuro
    case 2:  return { background: '#1a1a2e', color: '#c9b8ff' }; // Pro: azul oscuro
    default: return null; // Free y Waitlist: sin badge
  }
}
```

---

## 8. FRONTEND — Pantalla de Waitlist

Si un usuario intenta acceder a la app con `access_level = 0`, mostrar una pantalla especial en vez del dashboard:

```jsx
// En App.jsx, si el usuario está logueado pero en waitlist:
if (user && user.access_level === 0) {
  return <WaitlistScreen />;
}
```

### `WaitlistScreen.jsx`:
```
                    [Logo LucaEats]

              Estás en lista de espera

     Tu cuenta está registrada. En cuanto
     tengamos un hueco, te daremos acceso.

     ─────────────────────────────────

     📧 Te avisaremos en: tu@email.com

     Mientras tanto puedes seguirnos en:
     @lucaeats

     ─────────────────────────────────

              [ Cerrar sesión ]
```

Diseño limpio, mismo estilo que la app. Sin frustración — mensaje amable y claro.

---

## 9. FRONTEND — Mensaje de límite de IA alcanzado

Cuando el backend devuelve `error: 'ai_limit_reached'` en foto o texto, mostrar un bottom sheet:

```
⚡ Has usado tus 3 análisis de hoy

Se renuevan a las 00:00
Quedan X horas

─────────────────────────────────────

¿Quieres análisis ilimitados?

         ∞ Pro — 1.99€/mes
   Sin límites · Sin anuncios

[ Ver planes ]    [ Registrar manualmente ]
```

El botón "Registrar manualmente" siempre disponible — el usuario nunca queda completamente bloqueado.

El botón "Ver planes" de momento apunta a `/perfil` o muestra un mensaje "Próximamente" — hasta que Stripe esté implementado.

---

## 10. FRONTEND — Gestión de roles en el Admin

En `AdminOverlay.jsx`, tab **Usuarios**, actualizar cada fila de usuario para incluir un selector de rol:

### El dropdown de rol (dentro de la fila expandida):
```jsx
const ROLE_OPTIONS = [
  { value: 0,  label: '⏳ Waitlist' },
  { value: 3,  label: '○  Free' },
  { value: 1,  label: '🌱 Fundador' },
  { value: 2,  label: '∞  Pro' },
];

<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Rol:</span>
  <select
    value={user.access_level}
    onChange={(e) => handleRoleChange(user.id, parseInt(e.target.value))}
    style={{
      padding: '6px 12px',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      fontSize: '13px',
      cursor: 'pointer'
    }}
  >
    {ROLE_OPTIONS.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
  
  {/* Feedback visual al cambiar */}
  {savingRole === user.id && (
    <span style={{ fontSize: '12px', color: 'var(--accent)' }}>Guardando...</span>
  )}
  {savedRole === user.id && (
    <span style={{ fontSize: '12px', color: 'var(--accent)' }}>✓ Guardado</span>
  )}
</div>
```

### La función de cambio de rol:
```js
const handleRoleChange = async (userId, newLevel) => {
  setSavingRole(userId);
  
  try {
    await api.updateUserRole(userId, newLevel, token);
    // Actualizar estado local inmediatamente
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, access_level: newLevel } : u
    ));
    setSavedRole(userId);
    setTimeout(() => setSavedRole(null), 2000);
  } catch (err) {
    // Mostrar error inline
  } finally {
    setSavingRole(null);
  }
};
```

### En `api.js`:
```js
updateUserRole: (userId, accessLevel, token) =>
  request('PUT', `/api/admin/users/${userId}/role`, 
    { access_level: accessLevel }, token),
```

---

## 11. RESUMEN VISUAL — Cómo se ve en el admin

```
Tab Usuarios:

Nombre          Email              Último acceso    Rol              Racha
──────────────────────────────────────────────────────────────────────────
▼ Luca T.       luca@...           hace 2h          [👑 Admin    ▾]   8🔥
▼ Marc R.       marc@...           hace 1 día        [🌱 Fundador ▾]   3🔥
▼ Ana G.        ana@...            hace 5 días       [⏳ Waitlist ▾]   0
▼ Sara L.       sara@...           hace 3h           [🌱 Fundador ▾]   5🔥
```

Un dropdown por usuario. Cambio instantáneo. Sin confirmación extra — es reversible.

---

## 12. ORDEN DE IMPLEMENTACIÓN

1. SQL en D1 — las tres queries (columna, UPDATE usuarios, UPDATE admin)
2. Crear `worker/src/utils/levels.js`
3. Crear tabla `ai_usage_log` en D1
4. Actualizar middleware de auth con verificación de acceso
5. Añadir límite de IA en `analyze-photo` y `analyze-text`
6. Actualizar generación de JWT con `access_level`
7. Actualizar `POST /api/auth/refresh`
8. Añadir endpoint `PUT /api/admin/users/:id/role`
9. Desplegar Worker: `cd worker && npm run deploy`
10. Actualizar `AuthContext.jsx` con `access_level`
11. Crear `client/src/utils/levels.js` (mirror del Worker)
12. Añadir badge en `Dashboard.jsx`
13. Crear `WaitlistScreen.jsx`
14. Añadir mensaje de límite en `AddEntryForm.jsx`
15. Actualizar `AdminOverlay.jsx` con dropdown de roles

---

## 13. AL FINALIZAR

- Verificar que tú (admin) ves el badge 👑 Admin en el dashboard
- Verificar que tus beta testers ven 🌱 Fundador
- Verificar que cambiar un rol desde el admin se refleja al usuario en su próximo login
- Verificar que un usuario Free ve el mensaje de límite al 4º análisis
- Verificar que un usuario Waitlist ve la pantalla de espera
- `git add . && git commit -m "feat: sistema de niveles, insignias y gestión de roles" && git push`
