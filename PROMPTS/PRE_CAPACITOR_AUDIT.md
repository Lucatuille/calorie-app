# Pre-Capacitor Audit — checklist completo antes de iOS

**Fecha:** 2026-05-11
**Contexto:** Caliro tiene tracción modesta pero real (~800 visitas/7 días, 20 usuarios activos no-amigos, ChatGPT refiriendo). Antes de invertir 4-6 semanas en Capacitor + IAP + StoreKit, hacer una pasada exhaustiva a infra, legal, seguridad y producto.

**Filosofía:** los sprints están priorizados por **urgencia × impacto**. Sprint 0 es lo que está sangrando dinero o credibilidad HOY. Cada sprint es independiente — se pueden paralelizar parcialmente, pero respetar dependencias críticas (ej. Stripe live antes de empujar conversión).

**Bloqueantes para Apple App Store** están marcados con 🍎.
**Sin esto se pierde dinero/users** con ⚠️.
**Quick wins (<30 min)** con ⚡.

---

## SPRINT 0 — URGENTE HOY (esta sesión o mañana)

**Estado: 4/5 completados** — solo Stripe live pendiente (esperando gestor).
**Fecha de cierre parcial: 2026-05-11**

Cinco items que están sangrando ahora mismo. Hacerlos en orden, todos hoy si es posible.

### 0.1 ⏳ ⚠️ Activar Stripe en modo live — PENDIENTE (gestor)

- **Qué:** cambiar claves test por live en código + Cloudflare Workers secrets
- **Por qué:** 5 personas intentaron pagar hoy y no pudieron. Cada día = ingresos reales perdidos
- **Cómo:**
  1. Conversar con padre / gestor (lo dejaste apuntado tú)
  2. Obtener claves live de Stripe Dashboard
  3. `wrangler secret put STRIPE_SECRET_KEY` con la nueva clave live
  4. `wrangler secret put STRIPE_WEBHOOK_SECRET` con el nuevo webhook secret de production
  5. Actualizar el priceId en el frontend si es distinto entre test/live
  6. Test end-to-end con tarjeta real (importe pequeño + reembolso si quieres)
  7. Verificar que el webhook de production está apuntando al worker URL
- **Coste:** 1-2h (depende de gestor)
- **Riesgo:** alto — un error y pagos siguen fallando o se cobran mal. Validar test con compra real
- **Bloqueante iOS:** sí (para IAP via StoreKit necesitas Stripe customer migration)

### 0.2 ✅ Landing: "Hoy somos 9 personas" → 52 (commit `85e8f5a`, 2026-05-11)

- **Qué:** actualizar la sección de la landing al número real, o reformular
- **Por qué:** cualquier visitante nuevo lo lee, ve "9 personas" para una app real, desconfía
- **Cómo:**
  - Opción A (rápida): cambiar "9" → "47" o número actual
  - Opción B (mejor): hacer la sección dinámica con `count(*)` de users del backend
  - Opción C (más estética): reformular sin número específico ("Una comunidad creciente de personas que cuentan calorías sin obsesionarse")
- **Coste:** A=5 min, B=2-3h, C=10 min
- **Decisión:** A o C ahora, B en otro sprint
- **Bloqueante iOS:** no, pero credibilidad cuenta para reviews

### 0.3 ✅ Tu nombre: "Lucas" → "Luca" (commit `85e8f5a`, 2026-05-11)

- **Qué:** sección "Quién está detrás" en la landing
- **Por qué:** error factual visible para cualquiera que te busque
- **Cómo:** find/replace en `client/public/landing.html` (o equivalente)
- **Coste:** 2 min
- **Bloqueante iOS:** no, pero es trivial

### 0.4 ✅ Configurar DMARC en Cloudflare DNS (2026-05-11)
**Configurado:** `v=DMARC1; p=none; rua=mailto:contacto@caliro.dev`. Verificado vía Google DNS. Setup completo de email: SPF (CF + Amazon SES), DKIM (CF + Resend), DMARC. Próximo paso a futuro: subir a `p=quarantine` tras 1-2 meses de monitoring si reportes están limpios.

- **Qué:** registro TXT en Cloudflare DNS
- **Por qué:** sin DMARC los emails de "Bienvenido a Caliro" caen en spam → users registrados no llegan a confirmarse
- **Cómo:**
  1. CF Dashboard → caliro.dev → DNS → Records → Add record
  2. Type: TXT, Name: `_dmarc`, Content: `v=DMARC1; p=none; rua=mailto:contacto@caliro.dev`
  3. TTL: Auto, Proxy: DNS only (TXT siempre DNS only)
- **Coste:** 5 min
- **Bonus relacionado:** verificar también que SPF y DKIM están bien configurados para Resend
- **Bloqueante iOS:** no

### 0.5 ✅ Email día 3 automatizado (commit `cb546ed`, 2026-05-11)

**Implementación:** descubierto que Resend NO tiene "Automations" de drip nativo. Reimplementado como worker scheduled cron (cohabita con backup daily 03:00 UTC). Migración D1 ejecutada (`day3_email_sent_at`), helper HTML (`day3EmailHTML(name)` en auth.js), runner (`runDay3Emails(env)` en scheduled.js) con manejo de errores 4xx/5xx, anti-mass-send guard (`DAY3_MIN_REGISTRATION_DATE = '2026-05-08'`). Próximo cron: 03:00 UTC mañana. Preview HTML del email guardado en `previews/email-day3-preview.html`.

---

## SPRINT 1 — Cloudflare / infra (días 1-2)

Lo crítico de infra antes de cualquier otra cosa. Hay fallos documentados + un patrón de incidentes.

### 1.1 ⚡ Activar HSTS + Always Use HTTPS

- **Qué:** dos toggles en Cloudflare SSL/TLS
- **Por qué:** resuelve 6 de los 13 security insights de CF que tienes pendientes
- **Cómo:** CF Dashboard → SSL/TLS → Edge Certificates → activar:
  - "Always Use HTTPS" (toggle simple)
  - "HSTS" (toggle + configurar valores: max-age 6 meses inicialmente, después 1 año si todo va bien; subdomains incluidos sí; preload no en primer mes)
- **Coste:** 5 min cada uno + 24h de monitoreo HSTS antes de subir max-age
- **Bloqueante iOS:** no, pero refuerza el security perfil

### 1.2 Revisar los otros security insights de Cloudflare

- **Qué:** los 7 restantes que no resolvieron HSTS+HTTPS
- **Por qué:** auditar cada uno, decidir cuáles aplican
- **Cómo:** CF Dashboard → Security → Overview → Recommendations. Lista cada insight, decidir
- **Coste:** 30 min revisión + variable según fixes
- **Bloqueante iOS:** depende del insight

### 1.3 Pool pinning — mitigación permanente

- **Qué:** decidir estrategia ante recurrencia (3 incidentes documentados ayer)
- **Por qué:** cada deploy puede disparar pool pinning regional. No escala con más users
- **Opciones:**
  - **(a) UptimeRobot free** — alerta cuando latency >X. 5 min setup. No previene, pero notifica
  - **(b) Subdomain `app.caliro.dev`** con DNS distinto al apex. Free, puede caer en otro pool
  - **(c) CF Pro $25/mes con Argo Smart Routing** — previene activamente el bug
  - **(d) Load Balancer $5/mes** — health checks + failover
- **Recomendación:** (a) ya + considerar (b) o (c) si vuelve a pasar tras el primer mes de iOS users
- **Coste:** (a) 5 min, (b) 30 min, (c) instantáneo + $25/mes
- **Bloqueante iOS:** no estrictamente, pero impacta UX en lanzamiento iOS si pasa

### 1.4 Verificar worker-proxy y security headers

- **Qué:** auditar que `worker-proxy/` aplica CSP, HSTS, X-Frame-Options correctamente
- **Por qué:** crítico per CLAUDE.md, es el sitio donde se sobrescriben headers
- **Cómo:**
  ```
  curl -I https://caliro.dev/app/
  ```
  Verificar headers: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- **Coste:** 30 min audit + tiempo de fixes si los hay
- **Bloqueante iOS:** no

### 1.5 Verificar backups D1 a R2

- **Qué:** confirmar que el cron daily 03:00 UTC funciona y sube backups
- **Por qué:** sin backups, un fallo de D1 = pérdida de datos completa
- **Cómo:**
  - CF Workers logs del scheduled handler
  - R2 bucket → listar objetos → confirmar fecha de último backup
  - Test de restore con un backup viejo a una D1 dev
- **Coste:** 30 min audit + variable según test
- **Bloqueante iOS:** no, pero crítico para survival

### 1.6 Rate limiting audit

- **Qué:** revisar todos los endpoints sensibles tienen rate limit razonable
- **Por qué:** spam/abuso/scraping potencial a medida que crece tráfico
- **Cómo:** grep `rateLimit(` en `worker/src/routes/*` y validar:
  - `/api/auth/login`: 10/15min por email, 20/15min por IP — OK
  - `/api/auth/register`: 10/h por IP — OK
  - `/api/analyze`: 10/60s user, 60/60s IP — OK
  - `/api/profile/onboarding-state`: 30/60s — quizá demasiado generoso
  - `/api/bedca/data` PUT: 30/60s — OK
  - `/api/calibration/*`: 30/60s — OK
- **Coste:** 1h
- **Bloqueante iOS:** no

### 1.7 Logs y observabilidad

- **Qué:** confirmar que Sentry está funcionando + logging consistente
- **Por qué:** con más users, errores se multiplican; necesitas visibility
- **Cómo:** verificar SENTRY_DSN, revisar Sentry dashboard, asegurar que errores se capturan
- **Coste:** 30 min
- **Bloqueante iOS:** no, pero recomendable

---

## SPRINT 2 — SEO / contenido (días 3-4)

Los items 6-9 de tu lista + complementos.

### 2.1 Publicar artículo de ensaladilla rusa

- **Qué:** subir el HTML ya redactado a `client/public/blog/calorias-ensaladilla-rusa.html`
- **Por qué:** Google no indexa lo que no está publicado. Cada semana cuesta visitas
- **Cómo:**
  1. Mover el HTML de raíz a `client/public/blog/`
  2. Verificar paleta wide sobrio (debe ser igual que canelones/croquetas)
  3. Auditar matemática (tu rule #2)
  4. Schemas JSON-LD (BlogPosting + Recipe + FAQPage)
  5. Añadir a `client/public/sitemap.xml`
  6. Actualizar blog index (`client/public/blog/index.html`) en sección Datos
  7. Push
- **Coste:** 2-3h (siguiendo tu workflow regla #1-2)
- **Bloqueante iOS:** no

### 2.2 Schema markup JSON-LD en los 4 artículos

- **Qué:** validar que cada artículo de receta tiene Article + Recipe + FAQPage schemas correctos
- **Por qué:** rich snippets en SERPs (preguntas expandidas, foto plato, calorías visible)
- **Cómo:**
  - Audit cada uno: tortilla, croquetas, canelones, ensaladilla
  - Test cada uno con `https://search.google.com/test/rich-results`
  - Asegurar que falta nothing (image, author, datePublished, nutrition)
- **Coste:** 30 min × 4 = 2h
- **Bloqueante iOS:** no

### 2.3 Actualizar sección blog en la landing

- **Qué:** la landing muestra los 3 opinión, los 4 de recetas (los que traen tráfico) están ocultos
- **Por qué:** conversión — visitantes que llegaron por el blog deben ver más blog
- **Cómo:**
  - Cambiar la sección blog del landing a featured los 4 de recetas
  - Mover los de opinión a un "Ver más artículos" o footer
  - O hacer 2 columnas: Datos + Opinión
- **Coste:** 1h
- **Bloqueante iOS:** no

### 2.4 Activar entradas BD de tortilla, croquetas, canelones

- **Qué:** cambiar `activado: false` → `true` en BD `spanish_dishes` para esos 3 platos
- **Por qué:** coherencia blog-app. Un user que llega del artículo de tortilla y registra "tortilla" en la app debe matchear
- **Cómo:**
  ```sql
  UPDATE spanish_dishes SET activado = 1 WHERE nombre IN ('tortilla española', 'croquetas', 'canelones')
  ```
  (verificar exactamente los nombres en tu BD)
- **Coste:** 15 min audit + execute
- **Bloqueante iOS:** no

### 2.5 SEO básico complementario

- **Qué:** verificar robots.txt, sitemap.xml, meta tags, OG images, twitter cards
- **Por qué:** higiene SEO antes del push iOS (Apple también indexa)
- **Cómo:** audit manual de:
  - `client/public/robots.txt` (debe permitir crawl de blog, bloquear `/bedca/`)
  - `client/public/sitemap.xml` (todos los blog articles)
  - Meta description en cada página
  - OG image (`og-image.png`)
- **Coste:** 1h
- **Bloqueante iOS:** no

---

## SPRINT 3 — Apple compliance / legal (días 5-7)

CRÍTICO antes de submit a App Store. Cualquier item faltante = rechazo automático.

### 3.1 🍎 Account deletion in-app

- **Qué:** botón visible y funcional para que el user borre su cuenta DESDE la app
- **Por qué:** Apple lo exige desde 2022. Sin esto, rechazo automático en review
- **Estado actual:** el endpoint `DELETE /api/profile` existe. Falta UI accesible
- **Cómo:**
  1. En Profile.tsx, sección "Cuenta" o "Peligro"
  2. Botón "Eliminar cuenta"
  3. Modal de confirmación con typing "ELIMINAR"
  4. Llamada al endpoint, logout, redirect
- **Coste:** 2h
- **Bloqueante iOS:** SÍ ABSOLUTAMENTE

### 3.2 🍎 Privacy Policy completa y actualizada

- **Qué:** documento que cumpla App Privacy declarations de App Store Connect
- **Por qué:** Apple lo exige + GDPR + accessibility desde la app
- **Estado actual:** existe `/app/privacy` pero hay que auditarla
- **Cómo:**
  1. Audit el documento actual
  2. Asegurar cobertura de TODO: datos recogidos (entries, weight, photos→Claude, AI responses, conversations, calibration data), uso, retención, terceros (Cloudflare, Anthropic, Stripe, Resend), derechos GDPR, contacto
  3. Mencionar específicamente: Anthropic procesa fotos para análisis, no las guarda. Datos médicos potenciales (peso, calorías, suplementos) son sensibles
  4. Linkar desde el footer y desde Profile
- **Coste:** 3-4h
- **Bloqueante iOS:** SÍ

### 3.3 🍎 Disclaimers de salud presentes

- **Qué:** "No soy profesional sanitario" en chat, planner, digest, calibración
- **Por qué:** Apple es estricto con health-adjacent. Sin disclaimer claro, riesgo de rechazo
- **Estado actual:** parcial — assistant.js tiene disclaimer en system prompt. Verificar UI
- **Cómo:**
  - Footer del chat con disclaimer fijo
  - Footer del digest con disclaimer
  - Onboarding/first run con "Caliro no es app médica"
  - Profile: aviso si introduce datos extremos (BMI < 16, etc.)
- **Coste:** 1h
- **Bloqueante iOS:** SÍ (puede ser razón de rechazo si falta)

### 3.4 🍎 Sign in with Apple — DECISIÓN

- **Qué:** decidir si añadir Sign in with Apple
- **Por qué:** Apple lo exige SI tienes social login (Google, Facebook). Si solo email/password, NO es obligatorio
- **Estado actual:** Caliro tiene email/password. NO tiene social login. Sign in with Apple NO obligatorio
- **Decisión:** NO añadir por ahora. Si en el futuro añades Google/Facebook login, entonces obligatorio
- **Coste:** 0 ahora
- **Bloqueante iOS:** no (porque no tienes social login)

### 3.5 🍎 StoreKit IAP — NO Stripe en iOS

- **Qué:** las subscripciones in-app en iOS DEBEN ir por StoreKit (Apple toma 15-30%)
- **Por qué:** App Store Review Guidelines 3.1.1. Usar Stripe directo = rechazo
- **Estado actual:** Caliro web usa Stripe. En iOS app debe ser StoreKit
- **Cómo:** este es parte del sprint Capacitor, pero hay que planificarlo:
  - Crear productos en App Store Connect (mensual, anual)
  - Capacitor plugin `@capacitor-community/in-app-purchases` o similar
  - Backend webhook para sync StoreKit transactions → Stripe customer
  - O backend separado para suscripciones iOS (más limpio)
- **Coste:** 2-3 días dentro del sprint iOS
- **Bloqueante iOS:** SÍ

### 3.6 🍎 App Privacy Declarations

- **Qué:** declarar en App Store Connect qué datos recoges
- **Por qué:** Obligatorio. Apple muestra esto en App Store
- **Cómo:** preparar lista de:
  - Health & Fitness data (entries, calorías, peso)
  - Identifiers (email, user ID)
  - Diagnostics (Sentry crashes)
  - Usage Data (Umami events)
  - Contact info (email)
  - Photos (transitoriamente para Claude, no guardadas)
- **Coste:** 1h setup
- **Bloqueante iOS:** SÍ

### 3.7 🍎 Health-related content guidelines

- **Qué:** verificar que el contenido de la app cumple guidelines de salud
- **Por qué:** Apple revisa apps de health/fitness con extra cuidado
- **Atención especial:** suplementos (creatina, omega 3, etc.) son OK como tracking, pero NO recomendar dosis/marcas
- **Coste:** 30 min audit
- **Bloqueante iOS:** SÍ

### 3.8 Terms of Service

- **Qué:** documento legal de ToS
- **Por qué:** GDPR + buena práctica + Apple lo pide
- **Estado actual:** verificar si existe
- **Cómo:** crear si no existe; incluir limitations of liability, terminación, jurisdicción
- **Coste:** 2-3h (o pagar a abogado)
- **Bloqueante iOS:** no estrictamente pero recomendable

---

## SPRINT 4 — Security audit (días 8-9)

### 4.1 JWT secret rotation policy

- **Qué:** documentar y planificar rotación del JWT_SECRET
- **Por qué:** un secret comprometido = todos los tokens válidos. Mejor rotar periódicamente
- **Cómo:**
  - Documentar política (ej. cada 6 meses + tras cualquier sospecha)
  - Estrategia de rotación sin invalidar todas las sesiones (key versioning o overlap window)
- **Coste:** 2-3h
- **Bloqueante iOS:** no

### 4.2 Stripe webhook validation

- **Qué:** confirmar que webhook valida la firma con STRIPE_WEBHOOK_SECRET
- **Por qué:** sin validación, alguien puede forjar eventos de Stripe
- **Cómo:** revisar `worker/src/routes/stripe.js`, asegurar `constructEvent` con signature
- **Coste:** 30 min audit
- **Bloqueante iOS:** SÍ (porque también vale para receipt validation de IAP)

### 4.3 SQL injection audit

- **Qué:** confirmar que todas las queries usan prepared statements (`.prepare().bind()`)
- **Por qué:** D1 expone una superficie pequeña pero hay que confirmar
- **Cómo:** grep en `worker/src/` por `env.DB.prepare` y verificar uso correcto. Buscar concatenación de strings en SQL (no debe haber)
- **Coste:** 1h
- **Bloqueante iOS:** no (pero crítico)

### 4.4 Password policies

- **Qué:** auditar políticas de password (mínimo length, hashing)
- **Por qué:** hashing está OK (PBKDF2 100k), pero validar resto
- **Cómo:**
  - Min length: actualmente 12. OK
  - Max length: ¿cap razonable (128)? prevenir DoS
  - Common passwords: ¿check contra lista? bajo prioridad
  - Forgot password: token de 2 UUIDs concatenados, 1h TTL. OK
- **Coste:** 30 min audit
- **Bloqueante iOS:** no

### 4.5 Email enumeration prevention

- **Qué:** que `/api/auth/forgot-password` NO revele si el email existe
- **Por qué:** prevenir scrapping de users
- **Estado actual:** `auth.js:151` devuelve `okResponse()` siempre. OK
- **Coste:** 0, ya está
- **Bloqueante iOS:** no

### 4.6 Worker secrets audit

- **Qué:** confirmar que todos los secrets están en `wrangler secret` y no en código
- **Por qué:** secrets en código = pérdida si repo se vuelve público o se clona mal
- **Cómo:**
  - `npx wrangler secret list`
  - Esperado: JWT_SECRET, ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, SENTRY_DSN
  - Grep código por keys hardcodeadas — no debe haber
- **Coste:** 30 min
- **Bloqueante iOS:** no

### 4.7 CORS audit

- **Qué:** los allowed origins son los correctos, no demasiado permisivos
- **Estado actual:** ALLOWED_ORIGINS en `utils.js`. Verificar contenido
- **Coste:** 15 min
- **Bloqueante iOS:** no (con iOS hay otro origin: `capacitor://localhost`)

### 4.8 CSP audit

- **Qué:** Content-Security-Policy del worker-proxy es estricto?
- **Por qué:** previene XSS
- **Cómo:** revisar `worker-proxy/`, validar CSP devuelta. Recomendado:
  - default-src 'self'
  - script-src 'self' (sin 'unsafe-inline' si posible)
  - img-src 'self' data: blob:
  - connect-src 'self' https://calorie-app-api.lucatuille.workers.dev https://api.anthropic.com (si aplica)
- **Coste:** 1h
- **Bloqueante iOS:** no, pero crítico

---

## SPRINT 5 — Performance / PWA (días 10-11)

### 5.1 Lighthouse audit

- **Qué:** correr Lighthouse en caliro.dev/app/ y en blog
- **Métricas objetivo:**
  - Performance ≥85
  - Accessibility ≥90
  - Best Practices ≥90
  - SEO ≥95
  - PWA: instalable
- **Coste:** 30 min audit + variable según fixes
- **Bloqueante iOS:** no (pero indirectamente sí porque iOS WebView usa el mismo bundle)

### 5.2 Bundle size audit

- **Qué:** verificar que el bundle no es excesivo
- **Cómo:**
  - Vite build → ver chunks
  - Probablemente HelpModal lazy ya, AdminOverlay lazy. Confirmar otros lazy candidates
  - Tree-shaking funciona
- **Coste:** 1h
- **Bloqueante iOS:** no, pero crítico para UX iOS

### 5.3 Service Worker audit

- **Qué:** verificar que el SW no cachea agresivamente bundle stale
- **Por qué:** explicó al menos un caso de pantalla blanca tras deploy
- **Cómo:**
  - Revisar generate-pwa o equivalente en config
  - Estrategia: network-first para HTML, stale-while-revalidate para assets
  - Versionado del SW (cuando cambia bundle, SW se actualiza, cache se invalida)
- **Coste:** 2-3h
- **Bloqueante iOS:** no (iOS Capacitor usa WebView, no SW)

### 5.4 API performance

- **Qué:** medir P95 de cada endpoint
- **Cómo:** logs CF Workers o herramienta de monitoring
- **Endpoints críticos:**
  - `/api/auth/refresh` — se llama en cada carga
  - `/api/profile` — dashboard depende
  - `/api/analyze` y `/api/entries/analyze-text` — pueden ser lentos (Claude)
  - `/api/planner/day` y `/week` — Sonnet, lentos por diseño
- **Coste:** 1-2h
- **Bloqueante iOS:** no

### 5.5 Image optimization audit

- **Qué:** imágenes del blog y landing optimizadas
- **Cómo:** check tamaños, formatos (WebP), lazy loading
- **Coste:** 1-2h
- **Bloqueante iOS:** no

---

## SPRINT 6 — GDPR / Legal completas (días 12-13)

### 6.1 Export GDPR audit

- **Qué:** confirmar `GET /api/profile/export` exporta TODO
- **Estado actual:** ya existe, exporta user + entries + weight_logs + supplements + ai_corrections + calibration + ai_usage + assistant
- **Falta:** ¿onboarding_state? ¿user_bedca_data (admin only pero está)? ¿planner_history? ¿upgrade_events?
- **Cómo:** audit profile.js export, añadir tablas missing
- **Coste:** 1h
- **Bloqueante iOS:** no (pero legal sí)

### 6.2 Delete account flow audit

- **Qué:** confirmar que CASCADE limpia TODO correctamente
- **Estado actual:** `DELETE /api/profile` hace batch delete + cascade. Tablas: password_reset_tokens, upgrade_events, weight_logs, ai_usage_logs, assistant_digests. Cascadas: entries, user_supplements, supplement_logs, ai_corrections, user_calibration, ai_usage_log, assistant_conversations, assistant_messages, assistant_usage
- **Falta:** ¿user_bedca_data CASCADE? Sí (FK con CASCADE)
- **Verificar:** confirma con SQL test
- **Coste:** 1h
- **Bloqueante iOS:** sí (junto con 3.1)

### 6.3 Cookie banner / consent

- **Qué:** decidir si necesitamos cookie banner
- **Estado actual:** Umami es self-hosted o privacy-friendly (no usa cookies por defecto). Caliro no usa cookies de tracking aparte de la sesión JWT
- **Decisión:** Si Umami no usa cookies, no necesitas banner. Verificar setup Umami
- **Coste:** 30 min audit
- **Bloqueante iOS:** no

### 6.4 Privacy Policy (de Sprint 3.2) — versión final

- Ya cubierto arriba

### 6.5 Terms of Service (de Sprint 3.8) — versión final

- Ya cubierto arriba

---

## SPRINT 7 — UX / Conversion (días 14-15)

### 7.1 Onboarding flow para users post-ChatGPT

- **Qué:** revisar el onboarding actual (`onboarding_completed` flag)
- **Por qué:** users llegan ahora desde ChatGPT con expectativa concreta, no desde anuncio
- **Cómo:** entrar como user nuevo y ver el flow completo. Optimizar para "soy un user que ya sabe qué busca"
- **Coste:** 2-3h
- **Bloqueante iOS:** no, pero crítico para retention

### 7.2 Empty states

- **Qué:** auditar todas las pantallas con datos vacíos (0 entries, 0 días, 0 weight logs, 0 conversaciones)
- **Por qué:** un user nuevo ve estos primero
- **Cómo:** test exhaustivo desde cuenta nueva
- **Coste:** 2h
- **Bloqueante iOS:** no

### 7.3 Error states

- **Qué:** auditar mensajes de error (red caída, AI límite, auth fallido, etc.)
- **Por qué:** errores mal manejados destruyen confianza
- **Coste:** 1-2h
- **Bloqueante iOS:** no

### 7.4 Free → Pro funnel audit

- **Qué:** analizar `upgrade_events` para entender drop-off
- **Cómo:** SQL aggregations en upgrade_events
- **Coste:** 1h analysis + iterations
- **Bloqueante iOS:** no

### 7.5 Welcome email content audit

- **Qué:** revisar el welcome email actual (ya está en código en auth.js)
- **Cómo:** que sea concreto, accionable, con tu voz personal
- **Coste:** 30 min
- **Bloqueante iOS:** no

---

## SPRINT 8 — Monetization (días 16-17)

### 8.1 Pricing review (anual a 19,99€)

- **Qué:** decidir y aplicar nueva pricing
- **Estado actual:** en MEMORY.md como prioridad
- **Cómo:**
  - Decidir mensual y anual
  - Crear products en Stripe live
  - Actualizar checkout
- **Coste:** 2-3h
- **Bloqueante iOS:** no (pero coordinable con StoreKit pricing)

### 8.2 Free AI limit a base mensual

- **Qué:** cambiar de límite diario (3/día) a mensual (X/mes)
- **Por qué:** más generoso, mejor para conversion
- **Cómo:** cambiar lógica de `getAiLimit` + tabla counter
- **Coste:** 2-3h
- **Bloqueante iOS:** no

### 8.3 Upgrade page audit

- **Qué:** revisar `/upgrade` para conversion
- **Coste:** 1h
- **Bloqueante iOS:** no

---

## SPRINT 9 — Code quality (días 18-19)

### 9.1 Consolidar .tsx / .jsx

- **Qué:** mezcla actual. Decidir migración completa a .tsx
- **Por qué:** type safety, mejor IDE
- **Coste:** 1-2 días (gradual)
- **Bloqueante iOS:** no

### 9.2 Tests coverage

- **Qué:** revisar test coverage (existe `worker/src/utils/__tests__/`)
- **Cómo:** correr coverage report, priorizar tests críticos (auth, payments, calibration)
- **Coste:** variable
- **Bloqueante iOS:** no

### 9.3 Dead code

- **Qué:** componentes/utils no referenciados
- **Cómo:** herramienta tipo `unimported` o manual
- **Coste:** 1-2h
- **Bloqueante iOS:** no

### 9.4 Error boundaries

- **Qué:** verificar que `RouteErrorBoundary` cubre todo
- **Coste:** 30 min
- **Bloqueante iOS:** no

---

## SPRINT 10 — iOS Capacitor (semanas 4-6)

### 10.1 Setup técnico Capacitor

- Init capacitor en el proyecto, target iOS
- Configurar `capacitor.config.ts`
- Test que la app carga en Xcode simulator

### 10.2 Plugins críticos

- **Camera** — para análisis de fotos
- **Push notifications** — para digest semanal y reminders
- **In-App Purchases** (StoreKit wrapper)
- **Biometric auth** (opcional pero deseable)
- **Status bar / Splash screen**
- **Keyboard** (handling de inputs)

### 10.3 Assets

- App icons (10+ sizes)
- Launch screen
- App Store screenshots (3 sizes iPhone, opcional iPad)
- App preview video (opcional)

### 10.4 App Store Connect setup

- Create app entry
- Bundle ID
- Pricing (free with IAP)
- Categories: Health & Fitness
- Privacy declarations (de Sprint 3.6)
- Submit for review

### 10.5 Testing

- TestFlight beta con 5-10 users
- Iteración antes de submit producción

---

## Resumen de bloqueantes Apple (Sprint 3)

Cosas SIN las cuales Apple rechaza:

| Item | Estado | Coste |
|------|--------|-------|
| Account deletion in-app | ⚠️ Falta UI | 2h |
| Privacy Policy completa | ⚠️ Auditar | 3-4h |
| Health disclaimers en UI | ⚠️ Verificar | 1h |
| StoreKit IAP (no Stripe iOS) | Plan en sprint iOS | 2-3 días |
| App Privacy Declarations | Pendiente | 1h |
| Health content guidelines | Auditar suplementos | 30 min |

Sin estos, ni intentar submit. Con ellos completos, ratio aprobación primer intento ~80%.

---

## Timeline estimado

Asumiendo trabajo focused y un solo dev:

| Sprint | Días | Acumulado |
|--------|------|-----------|
| 0 — Urgente HOY | 1 | 1 |
| 1 — CF / infra | 2 | 3 |
| 2 — SEO / contenido | 2 | 5 |
| 3 — Apple compliance | 3 | 8 |
| 4 — Security | 2 | 10 |
| 5 — Performance / PWA | 2 | 12 |
| 6 — GDPR / Legal | 2 | 14 |
| 7 — UX / Conversion | 2 | 16 |
| 8 — Monetization | 2 | 18 |
| 9 — Code quality | 2 | 20 |
| 10 — iOS Capacitor | 15-20 | 35-40 |

**~6-7 semanas total hasta submit App Store.**

Si paralelizas o saltas algún sprint no-bloqueante: **4-5 semanas viables.**

---

## Reglas durante el audit

1. **Validar antes de pasar al siguiente sprint** — no acumular trabajo a medias.
2. **Cada commit pequeño y revertible** — no PRs gigantes.
3. **Actualizar este doc con hallazgos** — los items que descubras a media auditoría se añaden aquí, no en mensajes sueltos.
4. **Crear sub-docs en `PROMPTS/` si un item se hace grande** — ej. `PROMPTS/APPLE_COMPLIANCE.md` si Sprint 3 crece.
5. **Cuando un sprint termine, marcar con ✅** y mover a sección "Cerrado" al final del doc.

---

## Decisiones tomadas

- Sprint 0 va primero (urgencia económica/credibilidad)
- Apple compliance es bloqueante absoluto — no submit sin Sprint 3 completo
- Sign in with Apple: NO (porque solo email/password, no obligatorio)
- StoreKit IAP: necesario para iOS — planificar dentro del sprint Capacitor
- Stripe live: hoy o mañana, no esperar
- Code quality (Sprint 9): aplazar si presiona el tiempo, no bloqueante
- Pricing review (Sprint 8.1): hacer ANTES de Capacitor para no rediseñar

---

## Cerrado

### 2026-05-11 — Sprint 0 (4 de 5)

- ✅ **0.2** Landing "9 → 52" — commit `85e8f5a`
- ✅ **0.3** "Lucas → Luca" — commit `85e8f5a`
- ✅ **0.4** DMARC configurado y propagado — `p=none; rua=mailto:contacto@caliro.dev`
- ✅ **0.5** Email día 3 vía worker scheduled — commit `cb546ed`. Verificado: emails enviándose desde Resend.
- ⏳ **0.1** Stripe live mode — pendiente (esperando gestor)

**Hallazgo del Sprint 0:** Resend NO tiene "Automations" como drip campaigns nativas. Reimplementado como worker scheduled cron. Patrón documentado para futuras automations (welcome day N, etc.).

### 2026-05-14 — Sprint 1 (Cloudflare/infra) — 100%

- ✅ **1.1** HSTS + Always Use HTTPS — ambos activos (HSTS preloaded, redirect HTTP→HTTPS confirmed)
- ✅ **1.2** Security insights CF — 2 de 5 resueltos vía configuración (DMARC, security.txt). 3 restantes (anti-AI-bots) NO archivados por decisión estratégica: dependemos de crawlers AI (ChatGPT/Bard) para tráfico SEO. security.txt en commit `0c50e43`.
- ✅ **1.3** Pool pinning mitigación permanente — apex `caliro.dev` en DNS only. Funcional, estable >24h, security headers preservados vía `_headers` de Pages. **Solución definitiva sin coste $$$.**
- ✅ **1.4** Worker-proxy security headers — sincronizados con `_headers` (interest-cohort=() añadido). Commit `15d38e7`.
- ✅ **1.5** Backups D1 → R2 — cron `0 3 * * *` confirmed active, R2 bucket `caliro-backups` con backups diarios `backup-YYYY-MM-DD.json` verificados.
- ✅ **1.6** Rate limiting audit — cobertura confirmada en endpoints sensibles (auth, analyze, profile, entries, bedca, calibration, planner, weight). 20 usos de `rateLimit(env, ...)` con configuraciones razonables.
- ✅ **1.7** Observability — Sentry activo server-side (`Sentry.captureException` en `worker/src/index.js`). Workers Logs disabled pero no urgente (Sentry cubre lo crítico).

**Hallazgos del Sprint 1:**
- Pool pinning NO causado por código ni configuración del user. Pool `188.114.96.0/23` crónicamente degradado en algunos PoPs CF.
- DNS only del apex es solución funcional permanente. Worker-proxy queda inactivo pero los headers son idénticos vía `_headers`.
- Endpoint admin `POST /api/admin/day3-emails/run` añadido (commit `15d38e7`) para test manual del cron.
- Export GDPR ampliado a format_version 1.1 (commit `15d38e7`) — incluye onboarding_state, day3_email_sent_at, dietary_preferences, ai_usage_logs, assistant_digests, assistant_usage, planner_history, upgrade_events, bedca_data.
- security.txt RFC 9116 implementado — buena práctica para apps health-related.
