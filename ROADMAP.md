# Caliro — Roadmap

---

## Built ✅

### Foundation
- Auth (register, login, JWT, refresh)
- Profile with TDEE wizard (Mifflin-St Jeor, activity levels, goal)
- Daily calorie + macro tracking (multiple meals per day)
- Dashboard with progress bar, macro rings, streak
- History grouped by date
- Weight chart, weekly summary, CSV export

### AI Features
- Photo analysis (Claude Haiku Vision) with calibration applied
- Text analysis ("pollo con arroz") with calibration applied
- Calibration engine: per-user bias correction from corrections, applied to all future estimates
- Barcode scanner (Open Food Facts)
- AI rate limits (3/day free, higher for Pro)

### Analytics
- Advanced analytics bottom sheet: adherence, macros, weight projection, streaks
- Progress chart (7/14/30 days)

### Monetization
- Access levels: Free (3), Pro (2), Founder (1), Admin (99), Waitlist (0)
- Stripe checkout + webhook
- Upgrade page (/app/upgrade)

### Supplements
- Daily supplement tracker with toggle
- Supplement manager (add/delete)

### Assistant (Pro)
- Conversation history with titles
- Complexity routing: Haiku (quick) vs Sonnet (analytical)
- Full user context: today, week, macros, meal-type patterns, weekday/weekend patterns, macro deficit profile
- Calibration integrated into assistant context
- Sonnet daily cap (1/user/day, silent downgrade)
- Weekly digest: proactive 3-point summary card, bottom sheet overlay, generated once/week per user

### UX & Infrastructure
- PWA (manifest, service worker, install prompt)
- Dark mode
- What's New modal (versioned, shows once per release)
- Onboarding wizard pre-fills registration data
- Admin overlay (usage stats, user management, AI costs)
- Welcome disclaimer

---



---

## Pricing & Conversion 💰

**Current state**
- Free: 3 AI analyses/day, no assistant
- Pro: $1.99/month — unlimited AI analyses, full assistant, weekly digest
- Founders: lifetime Pro access (early users)

**The conversion problem**
The app has strong features at $1.99 — arguably underpriced. But the Free→Pro moment
is unclear. What specific wall does a Free user hit that makes them want to upgrade?

- 3 AI analyses/day may be enough for casual users (they never hit the limit)
- The assistant is Pro-only but Free users may not know what they're missing
- There's no in-app demo or preview of the assistant for Free users

**Way to proceed**
1. Audit the upgrade trigger: add logging to see how often Free users hit the 3/day AI limit.
   That's the only natural upgrade moment today.
2. Consider a "taste" of the assistant for Free users — e.g. 1 assistant message/day.
   Let them see the pattern analysis, then hit a soft wall.
3. Consider raising price to $3.99 or $4.99. At $1.99 the LTV is very low and
   the calibration + assistant system is worth more. Underpricing signals low quality.
4. The weekly digest is a strong retention hook for Pro but invisible to Free users.
   Surface it: "Pro users get a weekly analysis of their patterns" with a sample in the upgrade page.




OG image — design task, not code
Calibration Engine V2 — waiting for more user data (~500 corrections)

iOS native app — blocked until everything above is solid



Fase 3 — Monetización suave
3.1 Touchpoint 1 — Límite foto IA
Cuando el Free usa su última foto del día, al guardar la comida mostrar un banner suave debajo:
Has usado tus 3 análisis de hoy.
Pro incluye foto IA ilimitada — 1,99€/mes
[Ver Pro]  [Registrar manualmente]
No bloquea, no interrumpe. Solo informa con alternativa.
3.2 Touchpoint 2 — Asistente visible con candado
El asistente no aparece en el Dashboard en usuarios free:

En lugar de nada, mostrar un preview del tipo de respuesta que daría
Texto en gris: "Todavía no has registrado nada hoy. Tienes X kcal para trabajar."
Encima un badge sutil "Pro" y candado
Al tocar: va a /app/upgrade

El usuario ve el valor antes de ver el precio.
3.3 Touchpoint 3 — Análisis profundo bloqueado
En la página de Progreso, debajo de las métricas normales, añadir una card bloqueada:
[Card con blur/opacidad reducida]
Análisis profundo             🔒
Patrones semanales, proyección
personalizada y recomendaciones
         [Desbloquear con Pro →]
Al tocar: va a /app/upgrade.

Fase 4 — Pulidos comerciales
4.1 Página 404
Ahora mismo si alguien llega a una ruta que no existe probablemente ve un error feo. Una página 404 simple con el Sistema C y un botón "Volver al inicio".
4.2 Loading states
Verificar que todas las acciones con tiempo de espera tienen un estado de carga visible — especialmente foto IA, el asistente y el checkout de Stripe.
4.3 Título del tab del navegador
Cada página debería tener un título específico:
Inicio — Caliro
Registrar — Caliro
Historial — Caliro
Progreso — Caliro
Perfil — Caliro
Asistente — Caliro
4.4 El nombre en Stripe
El portal de Stripe muestra "Entorno de prueba de Luca Eats". Cuando actives producción, actualiza el nombre del negocio a "Caliro" en la configuración de Stripe.
4.5 Email de bienvenida
Cuando alguien se registra, enviar un email automático via Resend:
Asunto: Bienvenido a Caliro, [nombre]
Cuerpo: simple, en texto, con el link a la app
        y un recordatorio de que puede instalarla

Fase 5 — Internacionalización (futuro)
5.1 Evaluación
El inglés no es prioritario ahora. El mercado hispanohablante tiene 500M de personas y está poco competido. Antes de expandir al inglés necesitas:

50+ usuarios activos en español
Al menos 10 usuarios Pro pagando
Validación de que el producto retiene

5.2 Si se hace — i18n correcto
Implementar con react-i18next. Archivos de traducción separados por idioma. El código nunca tiene strings hardcodeados — todo pasa por el sistema de traducción. Es un refactor considerable pero limpio si se hace bien.

Orden de ejecución
Semana 1:  Fase 1 completa — bugs y smoke testing
Semana 2:  Fase 2 — onboarding y estado vacío
Semana 3:  Fase 3 — touchpoints de monetización
Semana 4:  Fase 4 — pulidos comerciales
Cuando toque: Fase 5 — inglés

Bloque 8 — andaluz:
Ajoblanco, fritura andaluza, tortilla de camarones,
rabo de toro a la cordobesa, papas arrugadas con mojo,
torrijas, leche frita, pestiños, pipirrana, tumbet

Bloque 9 — castellano y del interior:
Cochinillo asado, callos a la madrileña, sopa de ajo,
migas manchegas, patatas revolconas, patatas a la riojana,
torrezno de Soria, morteruelo, pollo al chilindrón,
tarta de Santiago

Bloque 10 — norte y marinero:
Txangurro a la donostiarra, marmitako (ya en DB),
merluza en salsa verde, merluza a la gallega,
empanada gallega, pote gallego, filloas,
bacalao a la vizcaína, almejas a la marinera,
bonito con tomate

Bloque 11 — arroces y guisos específicos:
Arroz a banda, arroz al caldero, arroz con costra,
calamares en su tinta, canelones, bacalao ajoarriero,
potaje de vigilia, patatas a la importancia,
gallina en pepitoria, conejo al ajillo