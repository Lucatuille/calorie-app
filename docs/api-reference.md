# API Reference

Base URL: `https://calorie-app-api.lucatuille.workers.dev`

Todas las respuestas son JSON. Headers requeridos en endpoints protegidos:
- `Authorization: Bearer <JWT>`
- `X-Timezone: Europe/Madrid` (opcional, para calcular "hoy" del cliente)

---

## Auth (`/api/auth/*`) — Publico

### POST /api/auth/register
Registro de nuevo usuario.

| Campo | Tipo | Requerido | Validacion |
|-------|------|-----------|------------|
| name | string | si | - |
| email | string | si | formato email, unico |
| password | string | si | min 12 caracteres |
| age | number | no | min 17 |
| weight | number | no | - |
| height | number | no | - |
| gender | string | no | 'male' o 'female' |

**Rate limit**: 10/hora por IP
**Respuesta** (201): `{ token, user }`
**Side effect**: Envia email de bienvenida via Resend.

---

### POST /api/auth/login

| Campo | Tipo | Requerido |
|-------|------|-----------|
| email | string | si |
| password | string | si |

**Rate limit**: 20/15min por IP + 10/15min por email
**Respuesta** (200): `{ token, user }`
**Side effect**: Auto-upgrade de hash SHA-256 legacy a PBKDF2.

---

### POST /api/auth/refresh
Renueva el token JWT con datos actualizados de la BD.

**Auth**: Bearer JWT
**Respuesta** (200): `{ token, user }`

---

### POST /api/auth/forgot-password

| Campo | Tipo | Requerido |
|-------|------|-----------|
| email | string | si |

**Rate limit**: 3/hora por email (silencioso)
**Respuesta** (200): Siempre `{ message: "Si el email existe..." }` (proteccion contra enumeracion)
**Side effect**: Envia link con token de 1 hora via Resend.

---

### POST /api/auth/reset-password

| Campo | Tipo | Requerido | Validacion |
|-------|------|-----------|------------|
| token | string | si | token del email |
| newPassword | string | si | min 12 caracteres |

**Respuesta** (200): `{ message: "Contrasena actualizada" }`

---

## Entries (`/api/entries/*`) — Protegido

### POST /api/entries
Crear entrada de comida.

| Campo | Tipo | Requerido | Validacion |
|-------|------|-----------|------------|
| calories | number | si | 1-15000 |
| protein | number | no | - |
| carbs | number | no | - |
| fat | number | no | - |
| name | string | no | - |
| meal_type | string | no | breakfast/lunch/dinner/snack/other |
| date | string | no | YYYY-MM-DD (default: hoy) |
| notes | string | no | - |

**Rate limit**: 30/60s por usuario
**Respuesta** (201): entrada completa con ID

---

### GET /api/entries
Listar entradas con paginacion.

| Query | Tipo | Default | Max |
|-------|------|---------|-----|
| limit | number | 90 | 365 |
| offset | number | 0 | - |

**Respuesta** (200): `[{ id, name, calories, protein, carbs, fat, meal_type, date, created_at }, ...]`

---

### GET /api/entries/today
Entradas del dia (segun X-Timezone).

**Respuesta** (200): `[entries]`

---

### PUT /api/entries/:id
Actualizar entrada (solo si pertenece al usuario).

**Rate limit**: 30/60s
**Respuesta** (200): entrada actualizada

---

### DELETE /api/entries/:id
Eliminar entrada (solo si pertenece al usuario).

**Rate limit**: 30/60s
**Respuesta** (200): `{ message: "Deleted" }`

---

## Analisis IA (`/api/analyze`, `/api/entries/analyze-text`) — Protegido

### POST /api/analyze
Analisis de foto de comida con Claude Vision.

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| image | string (base64) | si | max ~2 MB |
| mediaType | string | no | tipo MIME |
| context | string | no | descripcion adicional |
| meal_type | string | no | - |
| photo_location | string | no | contexto visual |
| photo_plate_size | string | no | referencia tamano |
| date | string | no | YYYY-MM-DD |

**Rate limit**: 10/60s usuario + 60/60s IP
**Limite diario**: Free 3, Beta 15, Pro 30, Admin ilimitado
**Modelo**: Sonnet 4.6 (3 primeras fotos/dia Pro) → Haiku 4.5 (resto)

**Respuesta** (200):
```json
{
  "name": "Arroz con pollo",
  "calories": 520,
  "calories_min": 450,
  "calories_max": 600,
  "protein": 28.0,
  "carbs": 55.0,
  "fat": 18.0,
  "confidence": "media",
  "notes": "...",
  "categories": ["pollo", "arroz"],
  "ai_raw": 520,
  "ai_response_text": "...",
  "similar_meal": { "name": "...", "avg_kcal": 500, "times": 3 },
  "usage": { "used": 2, "limit": 30 }
}
```

---

### POST /api/entries/analyze-text
Analisis de texto describiendo comida.

| Campo | Tipo | Requerido | Validacion |
|-------|------|-----------|------------|
| text | string | si | max 500 chars |
| meal_type | string | no | - |
| date | string | no | - |

**Rate limit**: 15/60s usuario + 60/60s IP
**Modelo**: Haiku 4.5 (siempre)
**Calibracion**: Se aplica post-proceso si el usuario tiene perfil.

**Respuesta** (200):
```json
{
  "name": "...",
  "items": [{ "name": "...", "quantity": "...", "calories": 300 }],
  "total": { "calories": 520, "protein": 22, "carbs": 48, "fat": 18 },
  "categories": ["lentejas", "huevo"],
  "confidence": "medium",
  "ai_raw_calories": 500,
  "calibration_applied": true,
  "calibration_confidence": 0.72,
  "usage": { "used": 1, "limit": 3 }
}
```

---

## Progress (`/api/progress/*`) — Protegido

### GET /api/progress/summary
Resumen de los ultimos 30 dias.

**Respuesta** (200):
```json
{
  "entries": [{ "date": "2026-04-09", "calories": 1800, "protein": 120 }],
  "summary": {
    "avgCalories": 1950,
    "avgLast7": 1880,
    "adherence": 0.73,
    "weightTrend": -0.3,
    "streak": 12,
    "totalDaysLogged": 28
  }
}
```

---

### GET /api/progress/chart
Datos para graficas.

| Query | Valores | Default |
|-------|---------|---------|
| days | 7, 30, 90 | 7 |

**Respuesta** (200): `[{ date, calories, weight, protein, carbs, fat }]`

---

### GET /api/progress/advanced
Analytics avanzados. **Solo Pro** (requiere `requireProAccess`).

**Respuesta** (200): estadisticas detalladas, proyeccion de peso, distribucion de comidas, prediccion de plateau.

---

## Profile (`/api/profile*`) — Protegido

### GET /api/profile
Datos del perfil del usuario.

### PUT /api/profile
Actualizar perfil.

**Rate limit**: 10/60s

### GET /api/profile/export
**Export GDPR** — Descarga completa de todos los datos del usuario en JSON (9 secciones: perfil, entradas, peso, suplementos, correcciones IA, calibracion, uso IA, conversaciones asistente).

**Rate limit**: 5/hora

### DELETE /api/profile
**Eliminacion de cuenta** (GDPR Art. 17).

| Campo | Tipo | Requerido |
|-------|------|-----------|
| confirm | string | si, debe ser "ELIMINAR" |

**Rate limit**: 3/hora
Elimina el usuario y todos los datos asociados via CASCADE.

---

## Calibracion (`/api/calibration/*`) — Solo Pro

### POST /api/calibration/correction
Registrar correccion del usuario sobre estimacion IA.

| Campo | Tipo | Requerido |
|-------|------|-----------|
| ai_raw | number | si |
| user_final | number | si |
| food_categories | array | no |
| meal_type | string | no |
| input_text | string | no |
| input_type | string | no |
| ai_response_text | string | no |

**Rate limit**: 30/60s
Recalcula el perfil de calibracion automaticamente.

### GET /api/calibration/profile
Obtener perfil de calibracion del usuario.

### DELETE /api/calibration/profile
Resetear calibracion y todas las correcciones.

---

## Suplementos (`/api/supplements/*`) — Protegido

### GET /api/supplements/today?date=YYYY-MM-DD
Suplementos del dia con estado (tomado/no tomado).

### POST /api/supplements
Crear suplemento. Max 20 por usuario, nombre max 20 chars.

### DELETE /api/supplements/:id
Eliminar suplemento.

### POST /api/supplements/:id/toggle
Marcar/desmarcar suplemento como tomado.

### PUT /api/supplements/reorder
Reordenar suplementos. Body: `[{ id, order_index }]`

---

## Peso (`/api/weight/*`) — Protegido

### POST /api/weight
Registrar peso. Body: `{ weight_kg, date? }`. Rango: 20-300 kg.

### GET /api/weight/recent
Ultimas 30 entradas de peso.

### GET /api/weight/today
Peso de hoy, ayer, y ultimo registrado.

---

## Asistente (`/api/assistant/*`) — Solo Pro

### POST /api/assistant/conversations
Crear/obtener conversacion. Auto-carga contexto ligero.

### POST /api/assistant/send
Enviar mensaje. Limite diario: Beta 15, Pro 30, Admin ilimitado.

### GET /api/assistant/conversations/:id/messages
Historial de mensajes de una conversacion.

### POST /api/assistant/digest
Generar digest semanal. **Limite**: 1 cada 24 horas. Usa Sonnet 4.6.

### DELETE /api/assistant/conversations/:id
Eliminar conversacion y mensajes.

---

## Productos (`/api/products/*`) — Protegido

### GET /api/products/:barcode
Buscar producto en cache D1 por codigo de barras.

### POST /api/products/cache
Guardar producto en cache (desde Open Food Facts u otra fuente).

---

## Stripe (Pagos)

### POST /api/create-checkout-session
Crear sesion de pago Stripe.

| Campo | Tipo | Valores permitidos |
|-------|------|-------------------|
| priceId | string | `price_1TCSy8IDqPCl93zMZmrb0Mzg` (mensual), `price_1TCSydIDqPCl93zM6fMYoamR` (anual) |

**Respuesta**: `{ url }` (redirigir al usuario)

### POST /api/stripe-webhook
Webhook de Stripe. Verifica firma HMAC-SHA256 con tolerancia de 5 min.
- `checkout.session.completed` → access_level = 2
- `customer.subscription.deleted` → access_level = 3 (excepto Founders)

### GET /api/subscription-status
Estado de suscripcion. Respuesta: `{ access_level }`

### POST /api/create-portal-session
Portal de facturacion Stripe. Respuesta: `{ url }`

---

## Admin (`/api/admin/*`) — Solo Admin

### GET /api/admin/overview
Estadisticas de la plataforma: usuarios, actividad, alertas.

### GET /api/admin/users
Lista de usuarios con metricas (dias activos, calorias, etc.).

### GET /api/admin/engagement
Metricas de engagement: distribucion comidas, top foods, heatmap, retention.

### GET /api/admin/ai-stats
Estadisticas de uso IA: fotos, tokens, costes, por usuario.

### PUT /api/admin/users/:id/role
Cambiar nivel de acceso. Body: `{ access_level }` (0-3, no 99).

### DELETE /api/admin/users/:id
Eliminar usuario (con cascade). No permite auto-eliminacion ni eliminar admins.

### GET /api/admin/backups
Lista de backups en R2. Incluye health check (saludable si <30h desde ultimo).

### POST /api/admin/backups/run
Disparar backup manual. Respuesta: `{ ok, key, size_bytes, total_rows }`

---

## Utilidad

### OPTIONS *
Preflight CORS. Responde con headers apropiados.

### GET /api/health
Health check publico. Respuesta: `{ status: "ok", timestamp }`

### POST /api/track-upgrade-event
Tracking del funnel de upgrade. Body: `{ event }`.
Eventos validos: `ai_limit_shown`, `ai_limit_click_pro`, `assistant_lock_click`, `upgrade_page_view`.

---

## Codigos de Error Comunes

| Codigo | Significado |
|--------|-------------|
| 400 | Validacion fallida (campos requeridos, formato invalido) |
| 401 | Token JWT invalido, expirado o ausente |
| 403 | Acceso denegado (nivel insuficiente, waitlist, no Pro) |
| 404 | Recurso no encontrado |
| 422 | Claude trunco la respuesta (`stop_reason: max_tokens`) |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |
