# Landing v3 — Plan de migración

> Migración desde `client/public/landing.html` actual → propuesta v3 del user (`Caliro Landing (3).html`).
> Fecha inicio: 2026-04-19. Base: audit + datos de Umami + propuesta v3 del user.
> Documento vivo: marcamos con `[x]` a medida que se cierra cada item.

---

## 0 · Contexto rápido

- **Landing actual**: HTML estático en `client/public/landing.html`, sirve `caliro.dev/`. Tiene SEO bien montado (Schema.org `MobileApplication` + `FAQPage`, OG, Twitter, canonical, hreflang) pero copy con **bugs factuales** (Free promete "2 sugerencias Chef/semana" — feature descartada).
- **Propuesta v3**: bundle SPA React+Babel-in-browser con sistema de diseño warm coherente con Chef. Mejor hero, mejor narrativa (ContextBanner con adquisición de Cal AI), comparativa 4-col, motor de calibración visual, FAQ accesible. Bugs factuales nuevos en Free card.
- **Datos Umami** (mes actual, 76 visitors):
  - Landing → /register conversión ~19%, visit duration 2m 20s → el copy que entra engancha.
  - Mobile iOS 45% → landing debe brillar en iPhone.
  - `/app/upgrade` 1 visita en todo el mes → funnel interno a Pro muerto (**issue separado, no de landing**).
  - Blog 1 visita, invisible desde la landing.
  - SEO empezando a funcionar (Bing 7 + Google 6 + 1 visita desde chatgpt.com).

---

## 1 · Decisiones ya tomadas

- [x] **Migramos a la propuesta v3** como base. Es mejor que la landing actual y vale la pena.
- [x] **Arreglar bugs factuales antes de publicar** (no negociable).
- [x] **Re-incrustar SEO** (Schema.org, OG, Twitter, canonical, hreflang) de la landing actual en la v3.
- [x] **Sustituir anchors hash** (`#signup`, `#login`…) por rutas reales (`/app/register`, `/app/login`).
- [x] **Añadir eventos Umami** (`data-umami-event`) en los CTAs clave antes del deploy para poder medir qué convierte.
- [x] **Funnel interno a Pro es un issue separado**. No mezclar con el trabajo de landing.

---

## 2 · Decisiones cerradas (votadas 2026-04-19)

### 2.1 Paleta → **Mantener verde brand `#22C55E` (fosforito)** ✅ _[revisado 2026-04-19]_
- Corrección: el brand real es el Tailwind green-500 `#22C55E` / green-600 `#16A34A` (coincide con `--accent` de la app en light, `#22c55e` en dark). El `#2d6a4f` que planteé inicialmente NO está en el CSS global — lo confundí con la paleta warm del Chef (que solo usa warm en fondos, no en acentos).
- Tokens finales:
  - `--green: #22C55E` (brand)
  - `--green-deep: #16A34A` (hover/active)
  - `--green-soft: #DCF5E4` (tint)
  - `--green-ink: #15803D` (green-700, AA sobre cream)

### 2.2 Técnica → **A: HTML estático vanilla** ✅
- JSX → HTML + CSS + JS sin React.
- Typewriter, counters, scroll reveal, nav toggle en ~80 líneas vanilla.
- Core Web Vitals excelentes + SEO perfecto + carga instantánea.

### 2.3 Copy Free card → **Cambiar copy, no cambiar producto** ✅
- "5 análisis por foto con IA al día" → **"3 análisis por foto con IA al día"**.
- **Quitar "Motor de calibración básico"** de Free. Es Pro-only, dejarlo como palanca Pro.
- **Quitar "Planes del día"** de Free. Chef planner es Pro-only.
- Reemplazar las 2 líneas vacías con features reales Free: "Histórico semanal", "Gráfico de peso y racha", "Exportar CSV" (verificar cuáles son realmente Free).

### 2.4 Contenido extra → **Sé creativo, adopta las recomendaciones** ✅
- [ ] Sección "Sobre Lucas" con foto + 2 líneas — **sí, ahora**.
- [ ] Testimonio real si disponible / placeholder honesto si no — **pendiente confirmar con user**.
- [ ] TDEE calculator como card dedicada — **sí**.
- [ ] Blog: linkar artículos concretos en contexto + 2-3 cards "Desde el blog" — **sí**.
- [ ] Disclaimer médico en footer — **sí**.

### 2.5 Despliegue → **Reemplazo directo + backup** ✅
- Razón: A/B con 2 URLs genera duplicate content penalizable por Google. Canonical/noindex invalidan la medición.
- Backup: copia `client/public/landing.html` → `client/public/landing.v2.backup.html` (sin linkar desde nada, sólo safety-net en git).
- Medición before/after con Umami, split por fecha de deploy.

### 2.6 Fuentes → **User tiene los archivos, self-host desde `/fonts/`** ✅
- Pendiente confirmar formato (.woff2 ideal vs .ttf) y si DM Sans es variable.
- Si sólo tiene .ttf, convertir a .woff2 con fonttools (cero pérdida).
- Destino: `client/public/fonts/`.

---

## 3 · Ejecución — checklist por fase

### Fase 1 · Bugs factuales y claims (~30 min) ✅ aplicada en draft
Prioridad 🔴. Sin esto no se publica.
- [x] Free card: "5 análisis" → `3 análisis por foto con IA al día`.
- [x] Free card: quitado "Motor de calibración básico".
- [x] Free card: quitado "Planes del día".
- [x] Free card: añadido `Histórico completo y gráfico de peso` + `Racha y adherencia semanal`.
- [x] Pro card: añadido explícito `Planes del día y de la semana por el Chef`.
- [x] Comparativa: "IA que aprende de ti" → "Aprende de tus correcciones".
- [ ] Verificar precio actual Cal AI en España (pendiente confirmación user).
- [ ] Verificar precio Yazio 9,99€/mes (pendiente confirmación user).

### Fase 2 · SEO y tracking (~45 min) ✅ aplicada en draft
Prioridad 🔴.
- [x] `<link rel="canonical" href="https://caliro.dev/">`.
- [x] Schema.org `MobileApplication` (JSON-LD).
- [x] Schema.org `FAQPage` (JSON-LD) regenerado desde las 5 FAQ nuevas de la propuesta.
- [x] OpenGraph completo.
- [x] Twitter Card completo.
- [x] `hreflang="es"`.
- [x] `<meta name="theme-color" content="#F5F2EE">`.
- [x] `<meta name="description">` ajustado.
- [x] Google Search Console verification meta.
- [x] PWA manifest + apple-touch-icon + standalone redirect a /app.
- [x] Umami script con `data-website-id`.
- [x] `data-umami-event` en: nav-cta, nav-cta-mobile, hero-cta-free, hero-cta-ver, tdee-cta, pricing-free, pricing-pro, final-cta, blog-cal-ai, blog-contar-calorias, blog-mfp.
- [x] `href="/app/register"` (4 instancias), `href="/app/login"` (2).
- [x] Anchors internos mantenidos: #como #motor #compara #precios #faq + nuevos #tdee #sobre #beta #blog #progreso #chef.

### Fase 3 · Paleta y contenido (parcial en draft, resto pendiente de user)
Prioridad 🟠.
- [x] Paleta unificada `#2d6a4f` aplicada en `--green` + todos los literales inline.
- [x] Sobre Lucas: sección con copy redactado por Claude + placeholder para foto. **User aprueba/edita copy**.
- [x] Beta privada: sustituye SocialProof con "9 personas comiendo con Caliro" (placeholder honesto).
- [x] TDEE card: sección dedicada con CTA a `/blog/calculadora-tdee`.
- [x] Blog: sección con 3 cards (cal-ai, contar-calorias, alternativa-mfp).
- [x] Disclaimer médico en footer.
- [ ] Añadir foto Lucas cuando esté (`/img/lucas.jpg`) y reemplazar placeholder "L" por `<img>`.
- [ ] Revisar contraste WCAG del nuevo verde `#2d6a4f` con cream (debe pasar AA en body copy).

### Fase 4 · Conversión técnica y deploy (~3-4h, depende de 2.2 y 2.5)
Prioridad 🟠.
- [ ] Convertir JSX a HTML estático (si decisión 2.2 = A) — Typewriter, counters, reveal IntersectionObserver, nav mobile toggle en ~80 líneas vanilla.
- [ ] O bien: montar como ruta Vite compilada (si decisión 2.2 = B).
- [ ] Configurar fuentes (decisión 2.6): servir desde `/fonts/` o Fontsource.
- [ ] Verificar `client/public/_redirects` — que `/` siga sirviendo la landing nueva. **No tocar las reglas de `/app/*` → `/index.html` 200**.
- [ ] Test local: cargar en Chrome, iPhone (DevTools), Android (DevTools). Verificar:
  - [ ] Hero legible en iPhone SE (320px).
  - [ ] Nav burger funciona.
  - [ ] Typewriter arranca al scroll.
  - [ ] Counters animan al scroll.
  - [ ] FAQ abre/cierra con teclado (Tab + Enter).
  - [ ] `prefers-reduced-motion` respetado.
  - [ ] Sin errores en consola.
  - [ ] Lighthouse desktop: Performance ≥90, SEO 100, Accessibility ≥95.
  - [ ] Lighthouse mobile: Performance ≥80.
- [ ] Deploy (decisión 2.5):
  - Opción X: reemplazar `client/public/landing.html` → push → Cloudflare Pages auto-build.
  - Opción Y: servir como `/landing-v3.html` + regla `_redirects` para A/B (ej: cookie o hash).
- [ ] Verificación post-deploy:
  - [ ] caliro.dev carga la nueva landing.
  - [ ] CSP del proxy (`worker-proxy/`) no bloquea fuentes, Umami, scripts inline.
  - [ ] Preview en móvil real (iPhone + Android).
  - [ ] Probar todos los CTAs → llegan a `/app/register`.

### Fase 5 · Medir (7 días después de publicar)
Prioridad 🟡.
- [ ] Revisar Umami:
  - [ ] Eventos de CTA: qué botón convierte más (hero vs pricing vs final).
  - [ ] Bounce rate vs landing anterior.
  - [ ] Visit duration vs landing anterior.
  - [ ] Conversión a /register vs baseline 19%.
- [ ] Decidir iteración 2 con datos en mano.

---

## 4 · Fuera de scope de este plan (issues separados)

- **Funnel interno a Pro**: `/app/upgrade` 1 visita/mes. Investigar por qué los Free no llegan a upgrade dentro de la app. CTA enterrado? Feature-gates suaves? Requiere auditoría del Profile/Dashboard, no de la landing.
- **Blog**: plantilla funciona, falta volumen de contenido. Decisión editorial aparte.
- **Roadmap público + changelog**: señal de producto vivo para early adopters. Nice-to-have tras estabilizar landing.
- **Screenshots reales iOS**: los mockups SVG actuales de la propuesta son buenos. Screenshots reales se pueden hacer cuando Chef V1 esté visualmente estable y merezca capturas "de producto".

---

## 5 · Pendientes de input del user para desbloquear Fase 3

- [ ] **Fuentes — formato**: ¿`.woff2` o `.ttf`? (ideal `.woff2`, si sólo `.ttf` los convierto yo).
- [ ] **Fuentes — DM Sans**: ¿variable font (1 archivo) o estáticos (varios archivos)? Si estáticos, confirmar pesos 400+500.
- [ ] **Fuentes — ubicación**: subir a `client/public/fonts/` y darme nombres exactos de archivo.
- [ ] **Sobre Lucas — foto**: ruta al archivo o subirla a `client/public/img/` (ej: `lucas.jpg`).
- [ ] **Sobre Lucas — 2 líneas**: quién eres profesionalmente + por qué hiciste Caliro. Si prefieres, redacto propuesta y apruebas.
- [ ] **Testimonio**: ¿algún beta tester que haya dado feedback positivo por WhatsApp/email y aceptaría prestar nombre+inicial? Si no hay, uso placeholder honesto "Caliro está en beta privada con 9 usuarios en España".
- [ ] **Artículos blog**: lista de los 4 artículos actuales (títulos + URL), para linkar los que encajen contextualmente.
