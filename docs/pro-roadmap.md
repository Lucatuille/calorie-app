# Roadmap Caliro Pro

Documento vivo. Orden y estado de todas las mejoras planificadas para el plan Pro. Se actualiza segun avanzamos. Chef Caliro tiene su propio plan aparte (pendiente de sesion dedicada).

---

## Estado actual de Pro

Lo que ya aporta valor Pro real:
- **Proyeccion de peso** con 3 escenarios cientificos (`dynamic-adaptive-v2`)
- **Tu constancia** (adherencia + racha)
- **Semana vs Fin de Semana** con impacto en kg/mes
- **Tus macros** con sugerencias accionables en gramos
- **Patron calorico** (CV% + histograma)

Lo que se elimino por redundante o por bugs conceptuales:
- ~~Resumen rapido inflado~~ (dias/mejor dia/etc)
- ~~Calorias media/min/max~~ (ya visible en Progress basico)
- ~~Distribucion por tipo de comida~~ (el % solo no aporta)
- ~~Top 5 comidas~~ (ya en chips frecuentes)
- ~~Impacto por alimento~~ (logica conceptualmente erronea — comparar ratio de un plato con ratio target del dia)

---

## Sprint 1 — Fiabilidad del modelo (EN CURSO)

### Completado

- [x] **A2. Media movil 7 dias** — Backend calcula series suavizada
- [x] **A3. Peso ajustado (Hacker's Diet EMA alpha=0.1)** — Linea de tendencia en grafica
- [x] **E1. Tooltip interactivo** — Cursor vertical + valores con 1 decimal
- [x] **Jerarquia visual correcta** — Bascula protagonista, tendencia como contexto
- [x] **Anchor de proyeccion desde peso real** — No desde smoothed (rompia correlacion con Dashboard)
- [x] **TDEE calibrado con realidad** — Formula que infiere TDEE real desde cambio de peso observado

### Bugs detectados en audit

**Backend (`worker/src/routes/progress.js`):**

- [x] ~~**BUG 1: Signo invertido en TDEE calibration**~~ → **FALSO POSITIVO**
  - El audit decia que `inferredTdee = avg_cal - delta` estaba al reves
  - Verificado matematicamente: la formula es CORRECTA
  - Conservacion energia: `balance = comido - quemado` → si gana peso (delta>0) entonces TDEE < comido, formula `1800 - 410 = 1390` ✓
  - Solo se simplificaron los comentarios para evitar confusion futura

- [ ] **BUG 2: `daysToGoalRealistic` no soporta bulking** — Linea ~443-447
  - Solo calcula si `currentWeight > goalWeight` (perder peso)
  - Si `goalWeight > currentWeight` (ganar) devuelve null silenciosamente
  - Fix: añadir rama para caso bulking

- [ ] **BUG 3: `trendPerWeek` inestable con pocos dias** — Linea ~350
  - Minimo actual: 3 dias → con 3 dias extrapola a 1 kg/semana por un punto raro
  - Fix: subir minimo a 7 dias

**Frontend UI (`client/src/components/AdvancedAnalytics.tsx`):**

- [ ] **BUG 4: Legend del chart hardcoded** — Linea ~603
  - Actual: `background: 'rgba(255,255,255,0.92)'` → invisible en dark mode
  - Fix: `background: 'var(--surface)'`

- [ ] **BUG 5: Margin left negativo en chart** — Linea ~628
  - Actual: `margin={{ ..., left: -6 }}` → Y-axis cortado en mobile 375px
  - Fix: `left: 40` para dar espacio a los labels

- [ ] **BUG 6: Scenario cards textColor hardcoded** — Lineas ~788-789
  - `'#92400e'` y `'#475569'` → invisibles en dark mode
  - Fix: usar `var(--text-primary)` o `var(--text-secondary)`

- [ ] **BUG 7: KPI "Tasa semanal" color fijo** — Linea ~528
  - Siempre amber aunque sea bajada real
  - Fix: condicional — verde si bajada (objetivo cumpliendose), amber si va al reves del objetivo

### Mejoras UI medias (incluidas en Sprint 1 si da tiempo)

- [ ] **Empty state weekday/weekend** — actualmente desaparece silenciosamente con <2 dias
- [ ] **Empty state macros sin target** — actualmente seccion vacia
- [ ] **"Dias al objetivo: —"** sin explicacion cuando no hay goal_weight → tooltip
- [ ] **Confianza "baja" muy sutil** — texto gris 12px, deberia destacar mas
- [ ] **Plateau banner colores** — borderLeft `#f59e0b` + text `var(--color-carbs)` inconsistente → unificar a `var(--color-warning)`
- [ ] **Pill "+1.6 kg en periodo"** usa `var(--color-carbs)` (semantica de carbohidratos) → cambiar a `var(--color-warning)`

---

## Sprint 2 — Simulador "¿Y si...?" (PROXIMO)

La feature estrella. Transforma la seccion de informe pasivo a herramienta activa.
**Decision arquitectural confirmada:** hibrido — backend calcula parametros base una vez, frontend recalcula al instante.

### B1. Simulador de kcal (principal)

**Concepto:** Slider que el usuario mueve en tiempo real. Ajusta un `kcalAdjustment` de -500 a +500, y la grafica recalcula la linea "Realista" al instante.

**Por que el modelo cabe en el slider (decision tomada):**
- El modelo complejo (TDEE, adherence, CV, adaptacion metabolica) se calcula UNA vez en backend
- Frontend recibe parametros base como `tdee_effective`, `adherence_rate`, `calorie_variability_cv`, `metabolic_adaptation_factor`, `current_weight`, `weighted_avg_cal`
- La funcion de proyeccion en frontend es ~20 lineas matematicas
- Recalculo instantaneo (<1ms), sin llamadas API
- No hay duplicacion real de codigo: el backend calcula los 3 escenarios base, el frontend recalcula UN escenario sobre los parametros base

**Formula del frontend:**
```javascript
function projectWithAdjustment(base, kcalAdjustment, days) {
  const adjustedIntake = base.weighted_avg_cal + kcalAdjustment;
  const newDeficit = (base.tdee_effective - adjustedIntake) * base.adherence_rate;
  const kgPerDay = (newDeficit * base.metabolic_adaptation_factor) / 7700;
  return base.current_weight - (kgPerDay * days);
}
```

**UI:**
- Slider horizontal bajo la grafica de proyeccion
- Label dinamico: "¿Y si comes 200 kcal menos al día?"
- Range: -500 a +500 kcal, step 50
- Indicador del valor actual prominente: "−200 kcal/dia"
- La linea "Realista" del chart se anima en tiempo real al arrastrar
- Los 3 scenario cards (30d/60d/90d) tambien se actualizan
- Al soltar, mantiene el valor para ver el impacto consolidado

**Posible segundo eje:** toggle de adherencia objetivo (50% / 70% / 90% / 100%)
- Permite ver "¿Y si fuera mas consistente?"
- Dos parametros independientes: kcal × adherencia

**Tareas completadas (V1):**
- [x] Backend: exponer `projection_avg_cal` en projection response
- [x] Frontend: funcion `projectWithAdjustment()` pura en `utils/projection.ts`
- [x] Frontend: slider integrado en la seccion de proyeccion
- [x] Frontend: linea "Realista" del chart anima con el slider
- [x] Frontend: los 3 scenario cards (30/60/90) se actualizan
- [x] Frontend: estado del slider en React, efímero por sesion
- [x] Fix: los 3 escenarios se mueven juntos (no solo realista)
- [x] Fix: card "A tu objetivo" usa adjustedDaysToGoal
- [x] Fix: animacion sincronizada en las 3 lineas + area sombreada

### B1.5 (V2 del simulador) — Mejoras pendientes

Ideas para iterar sobre el simulador en una siguiente fase:

**Adoptar simulacion como objetivo** (prioritario)
- [ ] Boton "Adoptar este plan" que aparece cuando hay ajuste activo
- [ ] Al pulsar, PUT /api/profile con `target_calories = weighted_avg_cal + kcalAdjust`
- [ ] Toast de confirmacion
- [ ] Cambia el target del Dashboard y del asistente sin tener que ir a Perfil

**Comparaciones comestibles**
- [ ] "−175 kcal ≈ un yogur griego + una manzana menos al dia"
- [ ] "+200 kcal ≈ un aguacate + un puñado de nueces mas"
- [ ] Reutilizar logica de las sugerencias de macros (ya existen en Macros)
- [ ] Anclar el numero abstracto a comida real tangible

**Botones preset**
- [ ] Chips rapidos: "Deficit suave (−200)", "Deficit moderado (−400)", "Mantener (0)"
- [ ] Uso rapido sin arrastrar el slider

**Toggle de adherencia como segundo eje**
- [ ] Selector 70% / 85% / 100% junto al slider
- [ ] "¿Y si fuera mas consistente?"
- [ ] Recalcular con override de adherencia

**Mensaje de cambio minimo**
- [ ] Si el cambio proyectado a 90d es <0.3 kg, texto tipo:
      "Este ajuste no cambiara mucho. Prueba mover mas el slider."

**Highlight del plan apuntado**
- [ ] Cuando hay ajuste activo, la linea realista destaca (scale 1.1, glow)
- [ ] Los extremos pasan a 40% opacity para que el foco quede claro

### B2. Editar objetivo arrastrando

**Concepto:** El usuario puede arrastrar el `goal_weight` en la grafica para ver cuando lo alcanzaria con su ritmo actual.

**Por que es casi gratis:**
- B1 ya tiene la funcion de proyeccion en frontend
- Solo hay que añadir un drag handler sobre la `ReferenceLine` del goal
- Recalcular `daysToGoal` con la misma funcion

**Tareas:**
- [ ] Frontend: drag handler sobre la ReferenceLine del goal_weight
- [ ] Frontend: visualizacion de "nueva fecha objetivo" mientras arrastra
- [ ] Frontend: opcion de "guardar este objetivo" → llamada PUT /api/profile

### B3. Hitos intermedios automaticos

**Concepto:** En vez de solo "74 dias al objetivo", mostrar metas psicologicas mas cercanas.

**Ejemplo:**
```
Próximos hitos:
🎯 -1 kg en 12 días
🎯 -2 kg en 26 días
🎯 -5 kg en 65 días
🏆 Objetivo (65 kg) en 74 días
```

**Tareas:**
- [ ] Backend: calcular hitos derivados de la curva realistica (-1 kg, -2 kg, -3 kg, -5 kg si aplican)
- [ ] Backend: añadir `milestones: [{kg, days}]` al projection response
- [ ] Frontend: render de cards de hitos en grid de 2 columnas
- [ ] Frontend: animacion de aparicion en cascada (como los chips frecuentes)

### Mejoras UI a integrar en Sprint 2

Si toca el componente Analytics, aprovechar para arreglar:

- [ ] **Sistema de colores unificado** — eliminar todos los hardcoded `#16a34a`, `#f59e0b`, `#ef4444`. Usar `var(--color-success)`, `var(--color-warning)`, etc.
- [ ] **Tooltip touch support** — Recharts default es hover, en touch no funciona. Investigar `wrapperStyle` o handler custom
- [ ] **Empty state mejorados** — con icono + mensaje + CTA en vez de texto plano italic

---

## Sprint 3 — Auto-aprendizaje (FUTURO, post-Capacitor)

### A1. Auto-calibracion por error historico

**Concepto:** Guardar snapshots semanales de predicciones. Cada semana comparar prediccion vs realidad. Si el modelo consistentemente se equivoca, ajustar el factor de adaptacion metabolica automaticamente.

**Requiere:**
- Tabla nueva: `weight_predictions_log (user_id, week_start, predicted_30d, predicted_60d, generated_at)`
- Cron semanal para generar snapshots
- Logica de comparacion cuando llegan los 30/60 dias
- Ajuste del `metabolic_adaptation_factor` o del blending 70/30 segun error

**Esperar a:** que tengamos mas usuarios con datos de varias semanas (actualmente solo 5 usuarios reales)

### A4. Factor de confianza dinamico explicado

- [ ] Score 0-100 en vez de media/alta/baja
- [ ] Explicacion de QUE esta reduciendo la confianza: "Tu score es 62%. Subiria a 85% si registras peso 5 dias esta semana."
- [ ] Depende de A1 para datos historicos de fiabilidad

### E2. Comparacion con tu pasado

- [ ] "Hace 30 dias el modelo predijo X, la realidad fue Y"
- [ ] Valida el modelo retrospectivamente
- [ ] Depende de A1 (requiere snapshots guardados)

### E3. Grafica de adaptacion metabolica (educativa)

- [ ] Visualizar como tu TDEE estimado va bajando conforme pierdes peso
- [ ] Baja complejidad, valor educativo

---

## Chef Caliro (pendiente plan propio)

**Idea:** Planificador de comidas inteligente que usa historial real + BD de platos espanoles + IA.

**Posibles versiones:**
- V1: "Que como?" — 3 sugerencias basadas en presupuesto restante + frequent_meals + spanish_dishes
- V2: Plan semanal generado desde comidas reales del usuario
- V3: "Tengo estos ingredientes"
- V4: Lista de compra automatica
- V5: Modo restaurante

**Pendiente:** Sesion dedicada para diseñar a fondo. No mezclar con analytics.

---

## Ideas descartadas

- **Informe mensual IA (C1)** — redundante con el asistente actual que ya hace esto
- **Chat con la proyeccion (C2)** — redundante con asistente
- **Alertas predictivas (C3)** — redundante con tendencias del asistente
- **Correlacion con sueño/ejercicio (D1)** — demasiado ambicioso sin Apple Health
- **Ciclo menstrual (D2)** — requiere diseño sensible, V3+
- **Dias de desviacion intencional (D3)** — para V3

---

## Cola de mejoras tecnicas (no asignadas a sprint)

Detectadas en audit pero sin urgencia:

**Naming/refactor (Sprint 2 si toca el codigo):**
- [ ] `weeklyRateRealistic` mal nombrado (es projected, no real) → renombrar a `weeklyRateProjected`
- [ ] `lossIn30` mal nombrado (puede ser positivo o negativo) → `weightChange30`
- [ ] Uncertainty bands naming confuso para bulking

**Modelo (Sprint 3 cuando haya datos):**
- [ ] Blending TDEE no adaptativo (70/30 fijo) → dinamico segun calidad de datos
- [ ] `metabolicAdaptFactor` no se usa en calibration (inconsistencia menor)
- [ ] Dual penalties en projectWeightScenario (adaptation + tdeeReduction) — puede ser demasiado pesimista, revisar formula
- [ ] Cap ±30% del TDEE — investigar si ±40% captura mejor variacion real

**Accesibilidad/i18n (Post-Capacitor):**
- [ ] Emojis de confianza sin aria-labels (screen readers)
- [ ] Locale hardcoded 'es' en formateo de fechas → usar contexto i18n
- [ ] Tap targets <44px en algunos botones (chart legend especialmente)
- [ ] Typography mix serif+sans (decision pendiente: o todo serif en titulos modal o todo sans)

---

## Notas arquitecturales

- Todo Pro vive en `worker/src/routes/progress.js` endpoint `/api/progress/advanced` y `client/src/components/AdvancedAnalytics.tsx`
- El modelo de proyeccion es `dynamic-adaptive-v2`
- Formulas cientificas: 7700 kcal/kg, Mifflin-St Jeor para BMR, PAL 1.55 default
- Calibracion: blending 70% inferido + 30% teorico, cap ±30%, min 14 dias de peso
