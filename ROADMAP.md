# 🗺️ Calorie App — Roadmap

> Archivo de seguimiento del proyecto. Marca cada tarea con `[x]` cuando esté completada.
> Úsalo con Claude Code: *"Implementa el siguiente ítem sin completar del roadmap"*

---

## 🎨 Fase A — UI/UX
> Objetivo: que la app se vea y sienta profesional en todos los dispositivos

- [x] Renovar tipografía — buscar combinación más distintiva (Google Fonts)
- [ ] Nueva paleta de colores — definir variables CSS coherentes
- [x] Mejorar dashboard — más visual, datos más prominentes
- [x] Navbar responsive — menú hamburguesa en móvil
- [ ] Animaciones de entrada en cada página (fadeUp escalonado)
- [ ] Loading skeletons — reemplazar spinner genérico
- [ ] Estados vacíos cuidados — ilustración o mensaje cuando no hay datos
- [x] Modo oscuro — toggle en navbar, guardar preferencia en localStorage

---

## 📊 Fase B — Funcionalidades core
> Objetivo: que la app sea útil día a día para cualquier usuario

- [x] **Streak** — racha de días consecutivos registrados, mostrar en dashboard
- [x] **Historial** — página para ver, editar y eliminar entradas pasadas
- [x] **Objetivos por macros** — definir meta de proteína, carbos y grasa por separado
- [x] **Gráfico de macros** — donut chart diario con distribución proteína/carbos/grasa
- [x] **Peso corporal** — gráfico dedicado con línea de tendencia e IMC
- [x] **Exportar datos** — botón en perfil para descargar historial en CSV
- [x] **Resumen semanal** — tarjeta en dashboard con media y comparativa semana anterior

---

## 📸 Fase C — IA con foto
> Objetivo: registrar comidas con una foto en lugar de escribir manualmente

- [ ] Botón "Analizar foto" en página Registrar
- [ ] Componente de subida de imagen con preview
- [ ] Endpoint en Worker — recibe imagen en base64
- [ ] Integración Claude Vision API — prompt para estimar calorías y macros
- [ ] Parser de respuesta — extraer valores numéricos del texto de Claude
- [ ] Pre-relleno automático del formulario con los resultados estimados
- [ ] Indicador de confianza — mostrar que son estimaciones aproximadas
- [ ] Historial de fotos — thumbnail vinculado a cada entrada del día

---

## 👥 Fase D — Social y comunidad
> Objetivo: añadir motivación social y retención

- [ ] Perfil público — URL compartible con progreso del usuario
- [ ] Sistema de logros — primer registro, racha 7 días, racha 30 días, -5kg, etc.
- [ ] Ranking semanal — tabla opt-in entre usuarios por adherencia
- [ ] Seguir usuarios — feed de progreso de personas que sigues

---

## ⚙️ Fase E — Pulido técnico
> Objetivo: app sólida, instalable y con dominio propio

- [ ] Dominio personalizado — configurar en Cloudflare Pages
- [ ] PWA — manifest.json + service worker, instalable en móvil
- [ ] Notificaciones push — recordatorio diario configurable
- [ ] Panel de admin — ruta protegida `/admin` con lista de usuarios y stats globales
- [ ] Tests básicos — verificar que rutas principales devuelven 200

---

## ✅ Completado

- [x] Setup inicial — Node.js, Wrangler, GitHub
- [x] Backend — Cloudflare Worker con rutas auth, entries, progress, profile
- [x] Base de datos — D1 SQLite con esquema users + entries
- [x] Autenticación — registro, login, JWT
- [x] Frontend — React + Vite con 5 páginas (Dashboard, Registrar, Progreso, Perfil, Login)
- [x] Despliegue — Cloudflare Pages conectado a GitHub con CI/CD automático
- [x] URL pública — calorie-app.pages.dev

---

## 📝 Notas para Claude Code

**Stack:**
- Frontend: React + Vite en `/client`
- Backend: Cloudflare Workers en `/worker`
- DB: Cloudflare D1 (SQLite) — esquema en `/worker/schema.sql`
- Estilos: CSS puro en `/client/src/styles/global.css` + estilos inline en JSX
- Deploy: `git push` → Cloudflare Pages redespliega automáticamente

**Variables de entorno:**
- `VITE_API_URL` — URL del Worker (en Cloudflare Pages settings)
- `JWT_SECRET` — secret para tokens (en Cloudflare Worker secrets)

**Para desplegar cambios en el Worker:**
```bash
cd worker && npm run deploy
```

**Para desplegar cambios en el frontend:**
```bash
git add . && git commit -m "descripción" && git push
```
