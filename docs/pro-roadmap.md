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

## Sprint 1 — Fiabilidad del modelo ✅ COMPLETADO

### Completado

- [x] **A2. Media movil 7 dias** — Backend calcula series suavizada
- [x] **A3. Peso ajustado (Hacker's Diet EMA alpha=0.1)** — Linea de tendencia en grafica
- [x] **E1. Tooltip interactivo** — Cursor vertical + valores con 1 decimal
- [x] **Jerarquia visual correcta** — Bascula protagonista, tendencia como contexto
- [x] **Anchor de proyeccion desde peso real** — No desde smoothed (rompia correlacion con Dashboard)
- [x] **TDEE calibrado con realidad** — Formula que infiere TDEE real desde cambio de peso observado
- [x] **Proyeccion independiente del filtro** — Siempre usa últimos 30 días, el selector 7/30/90 solo afecta histórico
- [x] **Mensaje contextual honesto** — Sin prescribir kcal absurdas, lista posibles causas
- [x] **Modelo matematico refactorizado** — Doble penalización eliminada, simétrico loss/bulking, densidad gradual
- [x] **Escenarios coherentes con UI** — Optimista=adh 1.0, Realista=actual, Conservador=actual×0.8 (no bandas arbitrarias)

### Bugs del audit (todos arreglados)

- [x] ~~**BUG 1: Signo invertido en TDEE calibration**~~ → **FALSO POSITIVO** (verificado matemáticamente)
- [x] **BUG 2: `daysToGoalRealistic` no soportaba bulking** — Añadida rama para `currentWeight < goalWeight`
- [x] **BUG 3: `trendPerWeek` inestable con pocos dias** — Mínimo subido de 3 a 7 días
- [x] **BUG 4: Legend del chart hardcoded** — `background: var(--surface)` + border, dark mode safe
- [x] **BUG 5: Margin left negativo en chart** — `left: 0` (Y-axis visible en mobile)
- [x] **BUG 6: Scenario cards textColor hardcoded** — Usando CSS vars, dark mode safe
- [x] **BUG 7: KPI "Tasa semanal" color fijo** — Condicional según objetivo del usuario
- [x] **Leyenda horizontal sobre chart** — No tapa líneas (antes era absolute en esquina)
- [x] **Rango sombreado entre optimista/conservador** — Area sutil opacity 0.07, simétrico loss/bulking
- [x] **Líneas más diferenciadas** — Realista 2.5px sólida protagonista, extremos 1.25px dashed
- [x] **Animación sincronizada** — 200ms ease-out en las 3 líneas + area band

### Audit final de las 3 secciones consolidadas (todos arreglados)

- [x] **Streak contaba días con 0 calorias** — `daily.filter(d => d.calories > 0)` antes de calcular rachas
- [x] **Empty state macros sin target** — Detección `allNoTarget` + mensaje amigable
- [x] **Color weekday adherence siempre verde** — Condicional con umbral 60% igual que weekend
- [x] **"Racha más larga" sin contexto periodo** — Sub-text "en este período" / "días en racha actual"
- [x] **"Pechuga = +30g" ambiguo sin porción** — Contexto "(150g) ≈ +32g", atún en vez de aguacate

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

## Chef Caliro — pendiente sesion dedicada

> **NOTA AL CLAUDE QUE LEA ESTO TRAS COMPACT:** Este es el feature mas importante pendiente. El usuario quiere hacer una sesion dedicada de planning + diseño + implementacion. NO empieces a codificar sin antes tener el plan claro y aprobado. Lee primero todas las ideas, decisiones tomadas, y preguntas abiertas. Despues haz preguntas al usuario, no asumas.

### Vision general

**Idea central:** Caliro deja de ser un "tracker que registra lo que comiste" y se convierte en un "asistente de cocina personal que te dice que comer". Es un cambio de categoria de producto, no solo una feature.

Comparacion con competidores:
- **MyFitnessPal / Yazio / Lose It**: registras lo que comiste (pasado)
- **Caliro con Chef**: registras + recibes sugerencias inteligentes (futuro)

**Por que Caliro puede hacerlo bien (ventaja competitiva):**
1. Tiene un **motor de calibracion** que ya conoce las comidas reales del usuario (top 20 frequent_meals con macros aprendidos)
2. Tiene una **BD de platos espanoles** (tabla `spanish_dishes`, ~500 platos con macros verificados, porciones, categorias)
3. Tiene **Claude IA** ya integrado para analisis de texto/foto
4. Es **especifico para cocina mediterranea/espanola** — los competidores son anglosajones genericos

### Conversaciones previas con el usuario (decisiones tomadas)

**Sesion 1 — Brainstorming inicial:**
- Usuario propuso "menu-maker teniendo en cuenta los ingredientes del usuario, platos inteligentes"
- Llegamos a la conclusion de que Chef Caliro tiene "potencial infinito" como producto entero, no solo feature
- Decision: NO mezclarlo con el refactor de analytics, merecia plan propio
- Usuario dijo "tengo que sleep on it"

**Sesion 2 — Confirmacion:**
- Usuario confirmo que quiere hacer Chef Caliro antes de Capacitor / App Store launch
- Razon: prefiere lanzar con producto completo que ir parcheando con updates de App Store
- Tiempo estimado: ~1 mes de sprint dedicado
- Usuario tiene 9 usuarios reales (5 amigos + 4 randoms) — momento de validar antes de añadir mas complejidad

**Sesion 3 — Sobre el alcance V1:**
- Usuario propuso V1 mas simple ("Que como?") y construir incrementalmente
- Yo (Claude) propuse V1 ambicioso (plan semanal completo)
- **Decision pendiente** — esperar a la sesion dedicada

### Posibles versiones (a discutir el alcance)

**V1 Minima — "Que como?"**
- Usuario en cualquier momento del dia toca un boton "¿Que como?"
- Recibe 3 sugerencias concretas adaptadas a su presupuesto restante (kcal y macros que le quedan hoy)
- Cada sugerencia: nombre del plato, calorias, macros, porcion estimada en gramos, breve razon ("cubre tu deficit de proteina")
- Tap en una sugerencia → pre-rellena el form de Calculator → usuario revisa y guarda
- Opcional: input de texto para contexto ("algo rapido", "tengo pollo", "estoy en restaurante")

**V2 — Plan semanal**
- Usuario solicita plan para la semana
- Claude genera un menu para 7 dias (desayuno + comida + cena + snacks) que cumple sus targets
- Basado en sus comidas frecuentes (lo que ya come) + variedad de spanish_dishes
- Editable: usuario puede cambiar comidas individuales o regenerar dias
- Opcional: generar lista de compra agregando ingredientes

**V3 — "Tengo estos ingredientes"**
- Usuario escribe o fotografia los ingredientes que tiene en casa
- Claude sugiere recetas que puede hacer con eso + cuanto le aporta a su dia
- Util para evitar desperdicio y reducir trips al super

**V4 — Lista de compra inteligente**
- Genera lista de la compra a partir del plan semanal o de los frecuentes
- Opcional: integrar con supermercados (futuro lejano, bloqueado por APIs)

**V5 — Modo restaurante**
- Usuario indica "estoy en italiano / japones / mcdonalds"
- Sugerencias tipicas de ese tipo de restaurante ajustadas a su presupuesto
- "En un italiano: pasta al pomodoro 80g (450 kcal) cubre tu deficit de carbs"

**V6 — Comparador de platos** (idea de sesion anterior)
- Usuario duda entre 2 platos en un menu
- Escribe los dos, ve comparacion lado a lado con macros y "fit score" (cual encaja mejor con su presupuesto)
- Esto se planteo originalmente como feature separada, podria absorberse en Chef Caliro

### Datos disponibles para alimentar el sistema

**Del usuario (calculados en tiempo real):**
- `entries` de hoy → `consumed_kcal`, `consumed_protein`, `consumed_carbs`, `consumed_fat`
- `target_calories`, `target_protein`, `target_carbs`, `target_fat` del perfil
- `remaining = target - consumed` por cada macro
- `meal_type` actual segun la hora del dia (breakfast/lunch/dinner/snack)

**Del historial del usuario:**
- `user_calibration.frequent_meals` (JSON) — top 20 comidas con `name, avg_kcal, times, last_seen, avg_protein, avg_carbs, avg_fat`
- `entries` ultimos 90 dias agrupadas por nombre — top foods
- `meal_type` patterns — que tipo de comida hace en cada hora
- `weekday_weekend` patterns — que come entre semana vs finde

**Tabla spanish_dishes (~500 platos):**
- `nombre, categoria, kcal_ref, kcal_min, kcal_max`
- `proteina_g, carbos_g, grasa_g` por porcion
- `kcal_per_100g, proteina_per_100g, carbos_per_100g, grasa_per_100g`
- `porcion_g, porcion_desc` (porcion estandar)
- `aliases, token_principal, tokens_secundarios` (para fuzzy match)
- `referencias_visuales` (descripcion visual del plato)
- `notas_claude` (notas para el modelo)
- `confianza` (alta/media/baja)

**Ya implementadas en `worker/src/utils/spanishDishes.js`:**
- `matchDish(userInput, env)` — busqueda fuzzy por aliases/tokens
- `formatDishContext(match)` — formatea el dish para inyectar en prompt de Claude
- **NO existe aun:** `findDishesByCalorieRange(env, minKcal, maxKcal, limit)` — necesario para Chef Caliro V1

### Arquitectura tecnica propuesta (V1)

**Backend nuevo: `worker/src/routes/planner.js`**

```
POST /api/planner/suggest
  Body: {
    context?: string,           // texto libre opcional ("algo rapido", "tengo pollo", "estoy en italiano")
    meal_type?: string,         // override del meal_type auto
    constraint?: string,        // opcional: "vegetariano", "sin gluten" (V2)
  }

  Logica:
  1. requireProAccess (posible: o disponible para todos? decision pendiente)
  2. rateLimit: ej 10/dia
  3. Calcular presupuesto restante de hoy
  4. Determinar meal_type por hora si no viene en body
  5. Query frequent_meals del usuario filtrados por rango calorico (~30% ±)
  6. Query spanish_dishes por rango calorico
  7. Construir prompt para Claude Haiku con:
     - Presupuesto restante (kcal + macros)
     - 3-5 platos frecuentes del usuario que encajan
     - 3-5 platos de spanish_dishes que encajan
     - Contexto del usuario si lo dio
     - Meal type
  8. Claude devuelve JSON con 3 sugerencias
  9. Return: { budget: {...}, suggestions: [{name, calories, protein, carbs, fat, portion_g, reason}] }
```

**System prompt (borrador):**
```
Eres el chef personal de Caliro. El usuario tiene un presupuesto nutricional
restante para hoy. Debes sugerir EXACTAMENTE 3 opciones de comida que:
1. Encajen en su presupuesto sin pasarse
2. Prioricen platos que ya come (lista de frecuentes proporcionada)
3. Cubran macros donde tiene deficit
4. Sean realistas en cocina espanola/mediterranea

Reglas:
- Cada sugerencia: nombre corto y claro, calorias enteras, proteina/carbs/grasa en gramos, porcion en gramos
- "reason": una frase corta explicando por que esta opcion es buena ahora
- Responde en espanol
- Si presupuesto < 200 kcal: snacks ligeros
- Si presupuesto > 800 kcal: comida completa
- Si el usuario da contexto, respetalo (ingredientes, tipo de cocina, restaurante)
- NO inventes datos nutricionales — usa los frecuentes o spanish_dishes como referencia
```

**Frontend nuevo: `client/src/components/ChefCaliro.tsx`**
- Bottom sheet (reutilizar patron de TextAnalyzer / AdvancedAnalytics)
- Header: presupuesto restante con barras de macros
- Input opcional de contexto
- Boton "Sugerir"
- Estado: idle → loading → results
- 3 cards de sugerencia con animacion cascada (estilo chips frecuentes)
- Cada card: nombre serif, macros pills, porcion, razon italic, boton "Registrar"
- Tap "Registrar" → navigate a Calculator con state pre-rellenado

**Modificaciones a archivos existentes:**
- `worker/src/utils/spanishDishes.js` → añadir `findDishesByCalorieRange()`
- `worker/src/index.js` → registrar ruta `/api/planner/*`
- `client/src/api.js` → añadir `suggestMeal(body, token)`
- `client/src/pages/Dashboard.tsx` → boton "¿Que como?" visible para Pro (o todos)
- `client/src/pages/Calculator.tsx` → leer `location.state` para pre-rellenar form

### Decisiones pendientes (preguntar al usuario en sesion dedicada)

**1. ¿Free o Pro?**
- Si Pro: justifica la suscripcion, valor diferenciador claro
- Si Free: mas usuarios lo descubren, viralidad
- Si Pro pero "limitado en Free": ej 3 sugerencias/dia gratis, ilimitado en Pro
- Mi voto: Pro completo o Free limitado, no Free completo

**2. ¿V1 minimo o V1 ambicioso?**
- V1 minimo = solo "Que como?" (1 sesion para construir, validable rapido)
- V1 ambicioso = "Que como?" + Plan semanal + Lista compra (~1 mes)
- Mi voto: empezar minimo, validar uso, despues expandir

**3. ¿Donde vive el boton de entrada?**
- Dashboard (boton grande prominente)
- Calculator (boton al lado de los metodos)
- Bottom nav (nuevo tab "Chef")
- Mi voto: Dashboard, mas visibilidad

**4. ¿Sustituye al Asistente de chat o complementa?**
- Sustituye: el chat actual de IA queda obsoleto
- Complementa: el chat sigue para preguntas abiertas, Chef es estructurado
- Mi voto: complementa, son casos de uso distintos

**5. ¿Fotos de los platos?**
- Sin fotos: simple, rapido
- Con fotos generadas por DALL-E o Midjourney: caro
- Con fotos pre-cargadas de spanish_dishes: requiere construir un dataset visual
- Mi voto: sin fotos en V1, podria añadirse despues

**6. ¿Cuantas sugerencias por peticion?**
- 3 (mi propuesta inicial) — manejable, da opciones
- 5 — mas variedad, mas overwhelm
- 1 — demasiado restrictivo
- Mi voto: 3

**7. ¿Limite de uso?**
- Free: ej 3/dia
- Pro: ilimitado (o 30/dia)
- Coste por llamada: ~$0.001 con Haiku, asequible
- Mi voto: 5/dia Free, 30/dia Pro

**8. ¿Personalizacion por preferencias?**
- Setup inicial: usuario marca alergias, preferencias (vegetariano, sin gluten, etc.)
- Cada sugerencia respeta esas preferencias
- Implica nuevo schema en `users` table o nueva tabla `user_preferences`
- Mi voto: V2, no V1

### Inspiracion de competidores (lo que han hecho mal o bien)

**Fitia (lider en meal planning):**
- Bueno: genera plan semanal con lista de compra
- Malo: planes muy genericos, no adaptados al usuario real
- Aprender: lista de compra es valiosa, planes genericos no diferencian

**Cal AI:**
- Bueno: foto de comida con IA (rapido)
- Malo: no sugiere nada, solo registra
- Aprender: la velocidad es clave, no overcomplicar

**Strongr Fastr:**
- Bueno: genera planes basados en macros target
- Malo: catalogo generico, sin contexto cultural
- Aprender: el contexto cultural (mediterraneo/espanol) es nuestra ventaja

**MyFitnessPal:**
- Bueno: enorme base de datos de comidas
- Malo: nunca te dice que comer, solo te deja registrar
- Aprender: la pregunta "¿que como?" es un hueco gigante en el mercado

### Riesgos y mitigaciones

**Riesgo 1: Sugerencias mediocres porque la BD de spanish_dishes es limitada**
- Mitigacion: combinar siempre con frequent_meals del usuario (lo que ya come). Si la BD esta limitada, los frecuentes la complementan.

**Riesgo 2: Coste de Claude por usuario activo**
- Mitigacion: rate limit estricto (5/dia Free, 30/dia Pro). Con Haiku, ~$0.001 por sugerencia × 30 = $0.03/usuario/dia maximo. Asumible.

**Riesgo 3: Sugerencias no factibles ("hazte un risotto en 5 min")**
- Mitigacion: prompt explicito sobre tiempo de preparacion + categoria del plato (rapido/elaborado)

**Riesgo 4: El usuario no entiende como usar la feature**
- Mitigacion: empty state claro, ejemplo en el primer uso, micro-onboarding

**Riesgo 5: Las sugerencias se sienten genericas a pesar del esfuerzo**
- Mitigacion: priorizar fuerte los frequent_meals del usuario en el prompt, no solo spanish_dishes

### Metricas de exito (V1)

- **Adopcion**: % de usuarios Pro que usan el boton "¿Que como?" al menos 1 vez en su primera semana
- **Retencion del feature**: % de usuarios que vuelven a usarlo en la 2da semana
- **Conversion**: % de sugerencias que el usuario tappea para registrar
- **Satisfaccion**: feedback cualitativo via mensaje en la app despues de N usos

### Trabajo previo necesario antes de empezar

1. **Auditar `spanish_dishes` actual** — ¿realmente tiene ~500 platos? ¿que campos? ¿cobertura de categorias?
2. **Diseñar el system prompt completo** con varias iteraciones
3. **Mockup visual** del bottom sheet (puede ser un HTML preview como hicimos con tooltip onboarding)
4. **Decidir las preguntas pendientes** (puntos 1-8 arriba)

### Estimacion de tiempo

- **Planning + diseño UI**: 2-3 sesiones (incluye preview en HTML y validacion del prompt)
- **Implementacion V1 minima**: 1-2 sesiones
- **Iteracion sobre feedback de los 5 amigos**: 1-2 semanas
- **V1 → V2 plan semanal**: otro sprint dedicado de 1-2 semanas

**Total realista para V1 estable: 3-4 semanas calendar.**

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
