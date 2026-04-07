# Polishing — Fixes antes de lanzamiento público

## Critical (usuarios lo ven cada día)

1. **Dark mode colores hardcodeados** — 1-2h
   - Dashboard: assistant preview card (#1c1c1c gradient)
   - Profile: calibration card (#111 background)
   - Upgrade: pricing card (gradient)
   - Assistant: message bubbles (#111)
   - Fix: reemplazar con CSS variables que adaptan a dark mode

2. **Página 404** — 30min
   - Ahora: redirect silencioso a Dashboard
   - Fix: página branded "No encontrado" con link a inicio

3. **Retry en error de IA** — 30min
   - Ahora: error sin opción de reintentar
   - Fix: botón "Reintentar" que re-ejecuta el análisis

## Rough edges (se notan)

4. **Onboarding sin indicador de progreso** — 1h
   - Dots o barra de progreso (paso 1/3, 2/3, 3/3)

5. **Historial sin búsqueda** — 2h
   - Filtro por fecha o búsqueda por nombre de comida
   - Mínimo: date range selector

6. **Títulos de página por ruta** — 1h
   - useEffect en cada página: document.title = "Historial — Caliro"
   - SEO + UX: usuario sabe en qué tab está

7. **Stripe checkout sin feedback** — 20min
   - Botón cambia a "Redirigiendo..." con spinner

8. **Fonts pequeños en móvil** — 1h
   - Labels de 9-10px → mínimo 11px
   - Revisión en viewport 320px

## Features esperadas

9. **Email de bienvenida** — 30min
   - Resend ya configurado, añadir en POST /api/auth/register
   - "Bienvenido a Caliro" + link al dashboard

10. **Página offline PWA** — 1h
    - SW sirve página branded cuando no hay red
    - "Sin conexión — tus datos se sincronizarán cuando vuelvas"

11. **Analytics de upgrade triggers** — 1h
    - Log cuando Free user ve el banner de límite IA
    - Log cuando toca "Ver Pro"
    - Dashboard admin: conversion funnel

12. **Links en respuestas del asistente** — 30min
    - Markdown parser no renderiza `[text](url)`
    - Fix: añadir regex para links en MarkdownText

## Orden recomendado
```
Semana 1: #1 (dark mode) + #2 (404) + #3 (retry) + #6 (títulos)
Semana 2: #7 (Stripe) + #9 (welcome email) + #4 (onboarding dots)
Semana 3: #5 (búsqueda historial) + #8 (fonts) + #12 (markdown links)
Semana 4: #10 (offline) + #11 (analytics)
```
