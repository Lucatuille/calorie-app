# Autenticacion y Seguridad

---

## Flujo de Autenticacion

### Registro
```
1. POST /api/auth/register { name, email, password }
2. Rate limit: 10/hora por IP
3. Validacion: email unico, password >= 12 chars, age >= 17
4. Hash: PBKDF2 (100k iteraciones, 16-byte salt)
5. INSERT user con access_level = 3 (Free)
6. Sign JWT (7 dias)
7. Email bienvenida via Resend
8. Return { token, user }
```

### Login
```
1. POST /api/auth/login { email, password }
2. Rate limit: 20/15min IP + 10/15min email
3. Lookup usuario (case-insensitive)
4. Verificar password (PBKDF2 o SHA-256 legacy)
5. Si legacy → auto-upgrade a PBKDF2
6. Sign JWT (7 dias)
7. Update last_login
8. Return { token, user }
```

### Refresh (cada carga de app)
```
1. POST /api/auth/refresh (Bearer JWT)
2. Verificar firma + expiracion
3. Lookup usuario en BD (access_level fresco)
4. Sign nuevo JWT
5. Return { token, user }
```

### Forgot/Reset Password
```
1. POST /api/auth/forgot-password { email }
   - Rate limit: 3/hora por email (silencioso)
   - Delay artificial 200ms (anti-timing)
   - Token: crypto.randomUUID() x2 (256-bit)
   - Hash del token: SHA-256 → almacenar
   - Expiracion: 1 hora
   - Email con link via Resend
   - Respuesta SIEMPRE identica (anti-enumeracion)

2. POST /api/auth/reset-password { token, newPassword }
   - SHA-256(token) → buscar en BD
   - Verificar: existe, no usado, no expirado
   - Hash nuevo password (PBKDF2)
   - Marcar token como usado
```

---

## JWT

- **Algoritmo**: HMAC-SHA256 (Web Crypto API, sin librerias externas)
- **Expiracion**: 7 dias desde emision
- **Payload**: `{ userId, email, name, is_admin, access_level, iat, exp }`
- **Almacenamiento cliente**: `localStorage`
- **Renovacion**: En cada carga de la app via `/api/auth/refresh`
- **Invalidacion**: No hay blacklist — la verificacion consulta BD para access_level actualizado

---

## Hashing de Passwords

### Formato nuevo (PBKDF2)
```
pbkdf2:{iterations}:{base64url_salt}:{base64url_hash}
```
- **Iteraciones**: 100,000
- **Salt**: 16 bytes aleatorios (`crypto.getRandomValues`)
- **Hash**: 256-bit derivado via `crypto.subtle.deriveBits`
- **Algoritmo base**: SHA-256

### Formato legacy (SHA-256)
```
{base64url_hash}  (sin prefijo, sin salt)
```
- Auto-detectado por ausencia del prefijo `pbkdf2:`
- **Auto-upgrade**: En login exitoso, se re-hashea con PBKDF2 inmediatamente
- `needsHashUpgrade(storedHash)` → `!storedHash.startsWith('pbkdf2:')`

---

## Rate Limiting

### Mecanismo: Ventana Deslizante en D1

Tabla `auth_attempts`:
```sql
key TEXT PRIMARY KEY,      -- "endpoint:tipo:identificador"
count INTEGER NOT NULL,
window_start INTEGER NOT NULL  -- Unix timestamp
```

**Logica** (`checkRateLimit(env, key, limit, windowSecs)`):
1. Si no existe registro o ventana expirada → resetear (count=1)
2. Si `count >= limit` → denegar (return false)
3. Si hay espacio → incrementar count (return true)
4. Si D1 falla → permitir (no bloquear usuarios legitimos)

### Limites por Endpoint

| Endpoint | Clave | Limite | Ventana |
|----------|-------|--------|---------|
| Register | `register:ip:{ip}` | 10 | 1 hora |
| Login (IP) | `login:ip:{ip}` | 20 | 15 min |
| Login (email) | `login:email:{email}` | 10 | 15 min |
| Forgot password | `reset:{email}` | 3 | 1 hora |
| Analyze foto (user) | `analyze:user:{userId}` | 10 | 60 seg |
| Analyze foto (IP) | `analyze:ip:{ip}` | 60 | 60 seg |
| Analyze texto (user) | `analyze-text:user:{userId}` | 15 | 60 seg |
| Entries write | `entries-write:{userId}` | 30 | 60 seg |
| Profile update | `profile:update:{userId}` | 10 | 60 seg |
| Profile delete | `profile:delete:{userId}` | 3 | 1 hora |
| Profile export | `profile:export:{userId}` | 5 | 1 hora |
| Assistant send | `assistant:send:{userId}` | 10 | 60 seg |

---

## CORS

### Origenes Permitidos
```javascript
'https://caliro.dev'          // dominio canonico
'https://calorie-app.pages.dev' // alias Pages
'https://lucaeats.org'        // legacy
'http://localhost:5173'        // desarrollo local
'capacitor://localhost'        // iOS (Capacitor)
'https://localhost'            // Android (Capacitor)
```

### Headers CORS
```
Access-Control-Allow-Origin: {origen dinamico}
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Timezone
Vary: Origin
```

### Proteccion CSRF
Las mutaciones (POST, PUT, DELETE, PATCH) validan el header `Origin` contra la lista de origenes permitidos. Requests sin Origin valido reciben 403.

---

## Headers de Seguridad (worker-proxy)

El proxy `caliro-proxy` inyecta estos headers en **todas** las respuestas:

```
Content-Security-Policy: [ver abajo]
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()
```

### Content Security Policy (CSP)

```
default-src 'self'
script-src 'self' 'unsafe-inline' https://cloud.umami.is
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com data:
img-src 'self' data: blob: https:
connect-src 'self'
            https://calorie-app-api.lucatuille.workers.dev
            https://*.sentry.io
            https://*.ingest.sentry.io
            https://cloud.umami.is
            https://api-gateway.umami.dev
            https://fonts.googleapis.com
            https://fonts.gstatic.com
worker-src 'self' blob:
frame-src 'none'
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none'
upgrade-insecure-requests
```

**Notas importantes**:
- `'unsafe-inline'` en script-src: necesario para scripts inline en `app.html` (JSON-LD, deteccion de tema, redirect)
- `worker-src blob:`: necesario para Sentry session replay
- `connect-src` incluye Google Fonts porque el Service Worker refetchea stylesheets con `fetch()`, y Chrome los trata como `connect-src`
- Los cambios de CSP se hacen en `worker-proxy/src/index.js`, **NO** en `client/public/_headers`

---

## Niveles de Acceso

| Nivel | Nombre | Descripcion | Limite IA/dia |
|-------|--------|-------------|---------------|
| 0 | Waitlist | Bloqueado en todo | 0 |
| 1 | Founder/Beta | Pro completo, de por vida | 15 |
| 2 | Pro | Pagado via Stripe | 30 |
| 3 | Free | Default nuevos usuarios | 3 |
| 99 | Admin | Acceso total, sin limites | ilimitado |

### Verificacion Pro
```javascript
// NUNCA confiar solo en el JWT — siempre verificar en BD
const result = await requireProAccess(request, env);
if (!result || result === 'waitlist') return proAccessDenied(result);
// result contiene usuario enriquecido (JWT + BD)
```

---

## GDPR

### Exportacion de Datos
`GET /api/profile/export` devuelve JSON con 9 secciones:
1. `profile` — datos del usuario (sin password)
2. `entries` — todas las comidas
3. `weight_logs` — historial de peso
4. `supplements` — suplementos configurados
5. `supplement_logs` — historial de tomas
6. `ai_corrections` — correcciones de IA
7. `calibration` — perfil de calibracion
8. `ai_usage` — uso diario de IA
9. `conversations` — conversaciones del asistente con mensajes

### Eliminacion de Cuenta
`DELETE /api/profile` con body `{ confirm: "ELIMINAR" }`:
- Elimina usuario y datos via CASCADE
- Tablas con CASCADE: entries, weight_logs, user_supplements, assistant_conversations
- Limpieza manual: ai_corrections, user_calibration, ai_usage_log, ai_usage_logs, assistant_usage, upgrade_events
- Proteccion: admins no pueden auto-eliminarse

### Retencion
- Backups automaticos en R2 retienen datos 30 dias
- Tras 30 dias, los backups se eliminan automaticamente
