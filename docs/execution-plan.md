# Caliro — Plan de ejecución 2026-2027

> **Documento vivo**. Redactado 2026-04-19 tras sesión de estabilización Chef + audit completo.
> Se actualiza a medida que se cierran items. Consulta primero esto antes de añadir features.

---

## 0 · Estado hoy (2026-04-19)

### Producto
Caliro es una PWA (web + iOS Capacitor planificado) de seguimiento calórico con IA, enfocada en cocina española/mediterránea. Stack: React + Vite + CF Pages / CF Workers + D1. IA vía Anthropic directo (Haiku + Sonnet).

- **Features** estables: foto IA, texto IA, código barras, manual, historial, gráfica peso, Chef Caliro (chat + plan día + plan semanal), calibración personal, análisis profundo, Stripe subscription.
- **Calidad técnica**: 391/391 tests verdes, Lighthouse landing 100/93/100/100, arquitectura limpia.
- **Branding**: tono warm editorial (Instrument Serif + DM Sans), honesto, anti-hype.

### Usuarios
- 11 totales (5 amigos + 6 desconocidos irregulares).
- Pro pagando: ~0-1.
- Free activo: ~5-7.

### Finanzas actuales
- Ingresos recurrentes mensuales: ~0-2€.
- Coste variable estimado: 2-5€/mes (Anthropic, CF gratis).
- **Balance: -5€/mes netos ±**.

---

## 1 · Objetivo 18 meses

**150€/mes netos sostenidos** a partir del mes 18 (octubre 2027).

Con los ajustes de margen propuestos en Fase 1, esto requiere:
- ~250-300 Pro pagando simultáneamente (vs los ~400 sin ajustes).
- Ratio Free:Pro estable ~3:1 o mejor.
- Churn mensual <10%.

No es "rich-maker", es **side-project rentable sostenible**. Escalar más allá requeriría decisiones distintas (cofundador comercial, paid ads, funding).

---

## 2 · Supuestos críticos

Si alguno se rompe, re-evaluar todo el plan:

| Supuesto | Señal de ruptura | Impacto |
|---|---|---|
| Anthropic pricing estable | Subida >30% input/output | Margen evapora, subir precios |
| CF free tier cubre crecimiento | Workers o D1 salen de free | Coste fijo real aparece (~20€/mes) |
| MFP/Yazio no atacan España con IA | Lanzan "Spanish mode" en <12m | Acelerar diferenciación |
| Tu tiempo 8-12h/sem sostenible | Vida impide continuidad | Bajar fase a hobby puro |
| iOS App Store aprueba la app | Apple rechaza por categoría salud | Reenfoque 100% web |

---

## 3 · Fases del plan

### Fase 1 — Márgenes y fundamentos iOS (mes 0-3)

**Objetivo**: blindar economía unitaria + desbloquear iOS (45% del tráfico).

#### 1.1 Prompt Caching Anthropic 🔴
- **Qué**: habilitar `cache_control` en los system prompts largos (Chef day/week, analyze photo/text). Anthropic cachea y cobra 10% del coste de input cacheado.
- **Por qué**: input fijo (nutritionRules + chef system) son ~2000-3000 tokens. Con caching bajan a ~200-300 efectivos. **Reducción coste variable Pro ~25-35%**.
- **Esfuerzo**: 30-60 min.
- **Riesgo**: bajo (flag opcional, si falla vuelve al cobro normal).
- **Criterio éxito**: coste Pro medio <0,50€/mes tras 2 semanas de tráfico real.

#### 1.2 Revisión de precios 🔴
- **Qué**: subir anual de 14,99€ a **19,99€/año** (1,67€/mes efectivo). Mensual queda 1,99€.
- **Por qué**: anual actual pierde dinero en Pro intensivos. 19,99€ sigue siendo killer price vs MFP 50-120€. Margen anual sube de 0,60€ a 1,10€/mes.
- **Esfuerzo**: 30 min (cambiar Stripe price ID + UI + Schema.org).
- **Riesgo**: bajo con 0-1 usuarios Pro actuales. Grandfather a los existentes.
- **Criterio éxito**: conversion rate del pricing yearly no cae >30% respecto al 14,99€ (medible cuando haya tráfico).

#### 1.3 Bajar límite Free IA 🔴
- **Qué**: 3 análisis/día → **20 análisis/mes** (media ~0,66/día). O alternativa: 2/día + 10 créditos extra mensuales.
- **Por qué**: Free activo cuesta 0,35€/mes. Un Free muy activo cuesta casi lo que paga un Pro mensual. Mensualizar el límite trata a todos igual sin penalizar días de mucho uso.
- **Esfuerzo**: 1-2h (backend: cambiar `getAiLimit` + rate limit table schema a mensual). Tests.
- **Riesgo**: medio. Puede reducir conversion si los Free no ven el límite nunca. Medirlo.
- **Criterio éxito**: coste Free medio <0,15€/mes.

#### 1.4 iOS Capacitor + RevenueCat IAP 🟠
- **Qué**: empaquetar como app iOS con Capacitor, IAP via RevenueCat, publicar en App Store.
- **Por qué**: 45% tráfico caliro.dev es iOS y hoy NO puede pagar (ver `Upgrade.tsx:55-77` bloqueo `isNative()`). App Store = descubrimiento orgánico.
- **Esfuerzo**: 4-6 semanas incluyendo:
  - Capacitor setup + build pipeline.
  - RevenueCat config (productos mensual + anual).
  - Webhook RevenueCat → worker → actualiza `access_level=2`.
  - ASO básico (icon, screenshots, descripción).
  - App Store review (~7-14 días).
- **Coste**: Apple Developer 99$/año. RevenueCat free hasta 10k$/mes tracked revenue.
- **Criterio éxito**: app publicada, primer pago iOS en <2 semanas tras salida.

#### 1.5 Analytics de coste por user 🟡
- **Qué**: dashboard admin que muestra tokens/coste por user en los últimos 30 días. Señales de power users costosos.
- **Por qué**: sin esto, no sabemos si un user quema margen.
- **Esfuerzo**: 3-4h. Ya existe `ai_usage_logs` con input/output tokens; falta agregar queries + UI en AdminOverlay.
- **Criterio éxito**: se puede detectar un user con coste >2€/mes en <3 clicks.

---

### Fase 2 — Retención + primeras alianzas + SEO arranque (mes 3-6)

**Objetivo**: validar retención a 30 días y arrancar go-to-market con bajo presupuesto.

#### 2.1 Streak honesto 🔴
- **Qué**: contador de días consecutivos registrando al menos 1 comida. Sin shaming ("perdiste tu racha"); sí celebración sutil (7, 14, 30 días).
- **Por qué**: retention hook clásico de MFP. Sin esto, user olvida la app en 2 semanas.
- **Esfuerzo**: 1-2 días. Ya existe contador parcial en dashboard/progress; consolidar.
- **Criterio éxito**: ≥40% de users activos mes 1 siguen activos mes 2.

#### 2.2 Recordatorio push opt-in 🟠
- **Qué**: botón en onboarding + profile "Recuérdame registrar". 1 push/día a la hora típica de última comida (20h default, ajustable).
- **Por qué**: retention universal. Free y Pro.
- **Esfuerzo**: 2-3 días (Capacitor Push en iOS + Web Push en web).
- **Criterio éxito**: ≥30% opt-in rate, +15% registros/día en quienes lo activan.

#### 2.3 Email semanal digest Free 🟠
- **Qué**: email dominical opt-in para Free (el Pro ya tiene digest en app). Resumen de la semana + teaser de qué vería con Pro. Usando Resend o similar.
- **Por qué**: trae Free usuarios de vuelta a la app. Soft upsell al Pro digest.
- **Esfuerzo**: 2-3 días (template + cron worker + opt-in).
- **Coste**: Resend free hasta 3k emails/mes.
- **Criterio éxito**: >25% open rate, >5% click through.

#### 2.4 Programa referral 🟠
- **Qué**: "Invita 3 amigos que se registren → 1 mes Pro gratis para ti".
- **Esfuerzo**: 3-4 días. Link único por user + tracking en D1 + lógica de activación Pro temporal.
- **Criterio éxito**: viral coefficient K ≥ 0.3 (cada user trae 0.3 users en media).

#### 2.5 Primera alianza con nutricionista 🟠
- **Qué**: identificar 3-5 nutricionistas españoles con audiencia en Instagram/YT (10-50k followers). Ofrecerles:
  - Código de descuento (30% primer mes Pro para su audiencia).
  - Afiliación 30% recurring del primer año de cada Pro que traigan.
  - Acceso Pro gratis permanente para ellos.
- **Por qué**: distribución dirigida a audiencia ya caliente.
- **Esfuerzo**: 1 mes de outreach. Mucho "no" antes de 1 "sí".
- **Criterio éxito**: 1 alianza firmada y probada (aunque sea 10-20 nuevos users).

#### 2.6 SEO blog sostenido — semana 1 🟠
- **Qué**: 1 artículo/semana. 12 artículos en 3 meses de Fase 2.
- **Temas iniciales candidatos**:
  - "Cuántas kcal tiene realmente una tortilla de patatas"
  - "Cómo registrar el menú del día sin volverte loco"
  - "Déficit calórico y dieta mediterránea"
  - "Yazio vs MyFitnessPal vs Caliro 2026"
  - "Calculadora TDEE: qué número usar realmente" (ya existe, mejorar)
  - "Macros para mujeres vs hombres en dieta española"
- **Esfuerzo**: 3-4h/artículo (research + draft + imágenes + publish).
- **Criterio éxito**: 1 artículo en top 10 de Google España a los 3 meses de publicado.

---

### Fase 3 — SEO flywheel + ASO + revisión precios (mes 6-12)

**Objetivo**: crecer tráfico orgánico x3-x5, pasar de 50 a 200 Pro.

#### 3.1 SEO sostenido 🔴
- Continuar 1 artículo/semana. **52 artículos totales al final del año 1**.
- Reescribir los 5 más leídos cada 6 meses (content refresh).
- Link internal strategy (artículos enlazan entre sí + a la app).
- Considerar long-form guides (5-7k palabras) una vez por trimestre.

#### 3.2 ASO iOS 🟠
- **Qué**: optimizar ficha App Store: keywords, screenshots con anotaciones, descripción con beneficios concretos, ratings plea tras uso positivo (7 días registrados).
- **Esfuerzo**: 1 semana de trabajo + iteraciones.
- **Criterio éxito**: top 30 para "contador calorías" España iOS a mes 12.

#### 3.3 Revisión precios V2 🟡
- Si pasas de 200 Pro pagando: considerar **Pro Plus a 3,99€/mes** con extras (recetas curadas semanales, export avanzado PDF, soporte prioritario). Mantener Pro a 1,99/19,99 como entrada.
- **Esfuerzo**: 1 semana producto + 3-4 días dev.
- **Criterio éxito**: ≥15% de Pro nuevos eligen Plus.

#### 3.4 Widget iOS 🟡
- **Qué**: widget pequeño con kcal restantes hoy + macros ring. "Atajo mental" diario.
- **Esfuerzo**: 1 semana con Capacitor iOS widget APIs.
- **Criterio éxito**: >30% de usuarios iOS lo instalan.

---

### Fase 4 — Consolidación y decisión (mes 12-18)

**Objetivo**: evaluar si seguir en modo indie, escalar, o bajar a hobby.

A los 12 meses, métricas para decidir:

| Métrica | Escala (B) si | Mantiene indie (A) si | Baja a hobby si |
|---|---|---|---|
| Pro pagando | ≥300 | 80-300 | <80 |
| Tráfico orgánico mensual | ≥5k visitors | 1-5k | <1k |
| MRR neto | ≥150€ | 50-150€ | <50€ |
| Churn mensual | <8% | 8-15% | >15% |

Opciones a esa altura:
- **A**: mantener modo actual, 1 feature grande por trimestre, objetivo 500€/mes a 24 meses.
- **B**: buscar cofundador comercial, paid acquisition test 1k€, si CAC<LTV ir a pre-seed.
- **C**: bajar a mantenimiento (2h/semana), seguir cobrando a usuarios existentes, no añadir features.

---

## 4 · Pendientes sueltos (recogidos de sesiones anteriores)

### Contenido pendiente
- **Foto de Lucas** para landing (`/client/public/img/lucas.jpg`). Hoy hay placeholder "L".
- **Screenshots iOS reales** del Chef, Progress, Calculator — sustituir SVG mockups de la landing cuando sean representativos.
- **Testimonios reales** en la landing cuando haya 2-3 beta testers dispuestos a prestar nombre + frase.

### SEO / Schema.org
- Añadir `aggregateRating` al Schema `MobileApplication` cuando haya reviews reales (>20).
- Añadir `screenshot` al Schema cuando haya capturas iOS.
- Añadir `author` y `Organization` relationship (ya existe Organization schema).

### Funnel interno (medir en 4-6 semanas cuando haya datos)
Con el tracking Umami ya instrumentado (hero, nav, pricing, chef locks, etc.), revisar en junio 2026:
- Qué CTA convierte más a `/upgrade`.
- Impressions vs clicks de cada lock (distingue "enterrado" vs "no convence").
- Tasa de `checkout_start_monthly` vs `checkout_start_yearly`.
- Donde abandona el funnel: landing → register → app → primer lock → upgrade.

### Quality Roadmap (nice-to-haves pendientes en `PROMPTS/QUALITY_ROADMAP.md`)
Ninguno bloqueante. Agrupados por cuándo los atacaría:

**Antes de iOS release (Fase 1)**:
- 3.3 E2E tests para flujos críticos (checkout, onboarding, registro comida).
- 3.4 Lighthouse CI en cada push (alertas de regresión).

**Oportunistas (cuando toquen los archivos)**:
- 2.1 TypeScript migration del worker (actualmente JS).
- 4.3 Image optimization (fotos del blog, banners).
- 5.4 CSP headers (verificar que `worker-proxy` ya los aplica, sino endurecer).
- 6.2 `.env.example` file para onboarding de cofundador futuro.

**Postergar (no crítico)**:
- 5.3 HttpOnly Cookie Migration (actual localStorage funciona fine para 11 users).
- 6.1 Local dev guide (README actual cubre lo necesario).
- 6.3 API documentation (solo relevante si hay integraciones terceras).

### Funcional menor
- Reset de streak: qué pasa exactamente si el user salta 1 día. Decidir: ¿grace period de 24h? ¿Salta a 0? ¿"Pausa" opcional para vacaciones?
- iOS: bloqueo `isNative()` en `/upgrade` hoy muestra "próximamente". Confirmar que solo se activa en app Capacitor, no en Safari PWA.

---

## 5 · Decisiones recientes (bitácora, abril 2026)

Para no olvidar el "por qué" de cambios recientes:

- **2026-04-19** · Chef planner: orden por hora, match por nombre en vez de tipo, ventana horaria para no generar desayunos a las 22h, persistencia robusta de ediciones con banner retry, refresh cross-medianoche via visibilitychange.
- **2026-04-19** · Validator nutricional: reconocer modificador "seco/seca" en pasta/arroz/legumbres (además del "crudo/cruda" existente). Fix a falso positivo "kcal no cuadra".
- **2026-04-19** · Frequents abiertos a Free (eran Pro-only por error; se acumulaban para todos pero solo Pro leía).
- **2026-04-19** · Prompt Caching Anthropic — **pendiente** (Fase 1.1).
- **2026-04-19** · Landing v3 deployed con tono warm editorial, Lighthouse 100/93/100/100.
- **2026-04-19** · Upgrade checkout simplificado: subtexts con "chicha", anchoring con competencia inline, risk reversal visible, CTAs con verbo.
- **2026-04-19** · Tracking granular funnel Umami + 2 teasers Pro (onboarding step 4 + digest banner assistant).
- **2026-04-19** · Reglas nutricionales compartidas entre Chef + Calculator (`nutritionRules.js`). Antes divergían, mismo plato daba números distintos según endpoint.

---

## 6 · Señales de éxito / alarma

### A los 3 meses (julio 2026)
- ✅ Margen Pro medio <0,50€/mes tras Prompt Caching.
- ✅ iOS app publicada en App Store.
- ✅ ≥30 Pro pagando.
- ✅ ≥10 artículos blog publicados.
- 🚨 Si <15 Pro a los 3 meses: pivotar estrategia de distribución (alianzas más agresivas, reconsiderar precio).

### A los 6 meses (octubre 2026)
- ✅ ≥80 Pro pagando.
- ✅ Retention 30 días ≥40%.
- ✅ 1 alianza con nutricionista activa.
- ✅ Primer artículo blog en top 10 Google España.
- 🚨 Si <40 Pro a los 6 meses: considerar freeze features, foco exclusivo en distribución.

### A los 12 meses (abril 2027)
- ✅ ≥200 Pro pagando.
- ✅ MRR neto ≥80€/mes.
- ✅ Tráfico orgánico ≥2k visitors/mes.
- ✅ Churn mensual <10%.
- 🚨 Si <100 Pro o MRR <40€/mes: decisión honesta sobre mantener o reducir.

### A los 18 meses (octubre 2027)
- 🎯 **≥300 Pro, 150€/mes neto** → objetivo cumplido.

---

## 7 · Disciplina — lo que NO hacer

Las tentaciones a evitar durante los próximos 12-18 meses:

❌ **Rediseños cosméticos** del Chef o Calculator. Están bien.  
❌ **Nuevas features grandes** (meal plans colaborativos, integración wearables, etc.). Primero distribución.  
❌ **Paid ads sin CAC<LTV probado**. Quema dinero sin aprendizaje.  
❌ **Expansión a otros idiomas** (inglés, portugués). Consolida español primero (500M hispanohablantes > 400M angloparlantes en este nicho).  
❌ **B2B / API pública / integración con terceros**. Distrae foco del consumer.  
❌ **Chat Caliro con GPT-5 u otros modelos**. Cambio de proveedor sin razón clara.  
❌ **Features "que estaría guay"**. Revisar esta lista cada 2 semanas y eliminar las que sigan ahí sin avanzar.  

---

## 8 · Cadencia de revisión

- **Semanal** (15 min): revisar métricas Umami, D1 Pro count, bugs reportados.
- **Mensual** (1h): actualizar este doc marcando items cerrados, ajustando fases si hace falta.
- **Trimestral** (2-3h): re-evaluar supuestos críticos, pivotes si señales de alarma.

---

**Próxima acción recomendada**: arrancar Fase 1.1 (Prompt Caching) + 1.2 (precios) en una misma sesión de ~1h. Son los dos más rentables (ganan margen), bajo riesgo, y desbloquean el resto.
