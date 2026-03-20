# 🧮 Calculadora TDEE Avanzada — Wizard Conversacional

## Contexto
Reemplazar la calculadora TDEE actual por un wizard conversacional en bottom sheet. Mismo patrón visual que el análisis avanzado ya implementado. El objetivo es que cualquier usuario sin conocimientos de nutrición entienda su TDEE y sepa exactamente qué comer.

Base científica obligatoria:
- **Mifflin-St Jeor (1990)** — fórmula principal, gold standard clínico para población general
- **Katch-McArdle (Cunningham 1980)** — fórmula alternativa si el usuario conoce su % de grasa corporal, más precisa para personas atléticas
- Los multiplicadores de actividad se calculan desde preguntas concretas de comportamiento, no desde categorías abstractas

---

## 1. DÓNDE VIVE

- Acceso desde el botón "Calcular TDEE" en Acciones Rápidas del Dashboard (ya existe)
- También accesible desde Perfil → "Recalcular objetivo calórico"
- Se abre como **bottom sheet** (mismo componente que análisis avanzado), altura 90vh, scrollable

---

## 2. ESTRUCTURA DEL WIZARD

### Header del bottom sheet (fijo, no scrollea)
```
← Paso 2 de 4        Calculadora TDEE        ✕
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
●●○○  (progress bar con 4 puntos)
```

Botón "←" vuelve al paso anterior. Botón "✕" cierra con confirmación si hay datos introducidos.

---

## 3. PASO 1 — Tu cuerpo

**Título:** *"Cuéntanos sobre ti"*
**Subtítulo:** *"Estos datos son la base del cálculo — cuanto más precisos, mejor resultado"*

### Campos:

**Sexo biológico** — dos botones grandes:
```
[ 👨 Hombre ]    [ 👩 Mujer ]
```
Nota sutil debajo: *"Usamos sexo biológico porque afecta al metabolismo basal"*

**Edad** — input numérico grande con stepper +/-:
```
[  −  ]  [ 25 ]  [  +  ]
         años
```
Rango válido: 15-100. Error inline si fuera de rango.

**Altura** — toggle CM / FT con dos inputs:
```
[ CM ] [ FT ]

Si CM: [ 175 ] cm
Si FT: [ 5 ] ft  [ 10 ] in
```
Convertir internamente siempre a cm.

**Peso actual** — input con unidades KG/LB toggle:
```
[ KG ] [ LB ]
[ 70.5 ] kg
```

**% Grasa corporal (opcional)** — campo colapsable:
```
¿Conoces tu % de grasa corporal?  [ + Añadir ]
```
Si lo expande:
```
[ 18 ] %
ℹ️ Si lo añades, usaremos la fórmula
   Katch-McArdle (más precisa para atletas)
```
Rango válido: 3-60%. Si lo introduce, mostrar badge "🔬 Cálculo con composición corporal" en el resultado.

**Botón siguiente:** `[ Continuar →  ]` — deshabilitado hasta que edad, altura y peso estén rellenos.

---

## 4. PASO 2 — Tu día a día

**Título:** *"¿Cómo es tu día típico?"*
**Subtítulo:** *"No cuentes el ejercicio — eso va en el siguiente paso"*

### Pregunta A — Tipo de trabajo/ocupación:
```
¿Cuál describe mejor tu día a día?

┌─────────────────┐  ┌─────────────────┐
│       🪑        │  │       🚶        │
│   Escritorio    │  │  De pie o en    │
│   o estudio     │  │  movimiento     │
│                 │  │  (dependiente,  │
│  (oficina,      │  │   camarero...)  │
│   teletrabajo,  │  │                 │
│   estudiante)   │  │                 │
└─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐
│       💪        │  │       🏠        │
│  Trabajo físico │  │  En casa        │
│  intenso        │  │  (tareas del    │
│  (construcción, │  │   hogar,        │
│   agricultura)  │  │   cuidados)     │
└─────────────────┘  └─────────────────┘
```

### Pregunta B — Pasos diarios aproximados:
```
¿Cuánto caminas al día habitualmente?

[ 🐌 Poco ]        [ 🚶 Normal ]
< 5.000 pasos      5.000-10.000 pasos

[ 🏃 Bastante ]    [ ⚡ Mucho ]
10.000-15.000      > 15.000 pasos
```

### Lógica del multiplicador de actividad base:
Calcular PAL (Physical Activity Level) desde las respuestas, no desde categorías predefinidas:
```js
function calculatePAL(jobType, steps) {
  const jobFactors = {
    'desk':     0.0,
    'standing': 0.1,
    'physical': 0.3,
    'home':     0.05
  };
  const stepFactors = {
    'low':    0.0,   // <5k
    'medium': 0.1,   // 5-10k
    'high':   0.2,   // 10-15k
    'very':   0.3    // >15k
  };
  // Base sedentaria: 1.2
  // Máximo sin ejercicio: ~1.5
  const pal = 1.2 + jobFactors[jobType] + stepFactors[steps];
  return Math.min(pal, 1.5);
}
```

---

## 5. PASO 3 — Tu ejercicio

**Título:** *"¿Cuánto ejercicio haces?"*
**Subtítulo:** *"Solo ejercicio planificado — no cuentes caminar al trabajo"*

### Pregunta A — Frecuencia semanal:
```
¿Cuántos días a la semana entrenas?

[ 0 ]  [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ]  [ 7 ]

Botones en fila, el seleccionado en verde
```

### Pregunta B — Duración media por sesión (si días > 0):
```
¿Cuánto dura cada sesión habitualmente?

[ ⏱️ <30 min ]  [ 45 min ]  [ 1 hora ]  [ +90 min ]
```

### Pregunta C — Tipo de ejercicio (si días > 0):
```
¿Qué tipo de ejercicio predomina?

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│      🏋️      │  │      🏃      │  │      🤸      │
│   Pesas /    │  │  Cardio /    │  │  Deportes /  │
│ musculación  │  │  running /   │  │   clases /   │
│              │  │  ciclismo    │  │   mixto      │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Lógica del multiplicador de ejercicio:
```js
function calculateExercisePAL(days, duration, type) {
  if (days === 0) return 0;
  
  // METs aproximados por tipo
  const metByType = {
    'weights': 5.0,  // pesas: intensidad moderada-alta
    'cardio':  7.0,  // cardio: intensidad alta
    'mixed':   6.0   // mixto: media
  };
  
  // Duración en horas
  const durationHours = {
    'short':  0.4,  // <30 min
    'medium': 0.75, // 45 min
    'hour':   1.0,  // 1 hora
    'long':   1.5   // +90 min
  };
  
  const met = metByType[type];
  const hours = durationHours[duration];
  
  // Contribución al PAL semanal
  // PAL adicional = (MET * horas * días) / (24 * 7) * factor_conservador
  const additionalPAL = (met * hours * days) / 168 * 0.85;
  return Math.min(additionalPAL, 0.5); // cap conservador
}
```

### PAL final:
```js
const finalPAL = Math.min(basePAL + exercisePAL, 1.9);
```

---

## 6. PASO 4 — Tu objetivo

**Título:** *"¿Qué quieres conseguir?"*

### Selección de objetivo:
```
┌───────────────────┐  ┌───────────────────┐
│        📉         │  │        ⚖️         │
│   Perder peso     │  │   Mantener peso   │
│                   │  │                   │
└───────────────────┘  └───────────────────┘
┌───────────────────┐
│        📈         │
│  Ganar músculo /  │
│     volumen       │
└───────────────────┘
```

### Si elige "Perder peso" — selector de ritmo:
```
¿A qué velocidad quieres perder?

┌────────────────────────────────────────────┐
│  🐢 Suave       -0.25 kg/semana            │
│  Déficit ~275 kcal/día — muy sostenible    │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐  ← RECOMENDADO (seleccionado por defecto)
│  🚶 Moderado    -0.5 kg/semana             │
│  Déficit ~550 kcal/día — recomendado       │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│  🏃 Agresivo    -0.75 kg/semana            │
│  Déficit ~825 kcal/día — exigente          │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│  ⚡ Muy agresivo  -1 kg/semana              │
│  Déficit ~1.100 kcal/día  ⚠️ difícil       │
└────────────────────────────────────────────┘
```

### Si elige "Ganar músculo":
```
¿A qué ritmo quieres ganar?

[ 🐢 Limpio +0.25kg/sem ]   (superávit ~275 kcal)
[ 🚶 Moderado +0.5kg/sem ]  (superávit ~550 kcal) ← recomendado
```

---

## 7. PANTALLA DE RESULTADOS — La más importante

### Cálculo de BMR según fórmula:

```js
function calculateBMR(weight, height, age, gender, bodyFatPct = null) {
  if (bodyFatPct !== null) {
    // Katch-McArdle (Cunningham 1980) — más preciso con composición corporal
    const leanMass = weight * (1 - bodyFatPct / 100);
    const bmr = 370 + (21.6 * leanMass);
    return { bmr, formula: 'katch-mcardle', leanMass };
  } else {
    // Mifflin-St Jeor (1990) — gold standard sin composición corporal
    // Preciso dentro del 10% en 82% de personas
    let bmr;
    if (gender === 'male') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    return { bmr, formula: 'mifflin-st-jeor', leanMass: null };
  }
}

const tdee = Math.round(bmr * finalPAL);
```

### Diseño del resultado:

```
🎯 Tu metabolismo
──────────────────────────────────────────────

  [badge si Katch-McArdle: 🔬 Cálculo avanzado]
  [badge siempre: basado en Mifflin-St Jeor 1990]

  QUEMAS AL DÍA
  ┌────────────────────────────────────────┐
  │              2.340 kcal               │
  │                                       │
  │  🔥 Metabolismo basal    1.680 kcal   │
  │  🚶 Actividad diaria      +390 kcal   │
  │  🏋️ Ejercicio             +270 kcal   │
  └────────────────────────────────────────┘

  ⚠️ Margen de error estimado: ±150-200 kcal
  (inherente a cualquier fórmula sin medición clínica)

──────────────────────────────────────────────

  PARA TU OBJETIVO: Perder 0.5 kg/semana
  ──────────────────────────────────────────

  ┌────────────────────────────────────────┐
  │  OBJETIVO RECOMENDADO                  │
  │                                        │
  │         1.790 kcal / día               │
  │                                        │
  │  Déficit: 550 kcal/día                 │
  │  ≈ 0.5 kg menos por semana             │
  │  ≈ 2 kg menos en un mes               │
  │  ≈ 6 kg menos en 3 meses              │
  └────────────────────────────────────────┘

  OTRAS OPCIONES:
  ┌──────────┬────────────┬──────────────┐
  │  Suave   │  Moderado  │  Agresivo    │
  │ 2.065    │   1.790 ✓  │   1.515      │
  │ -1kg/mes │ -2kg/mes   │  -3kg/mes⚠️  │
  └──────────┴────────────┴──────────────┘

──────────────────────────────────────────────

  📊 Distribución de macros sugerida
  (basada en tu objetivo)

  Proteína  [ ████████░░ ]  30%  ~134g
  Carbos    [ ██████░░░░ ]  40%  ~179g
  Grasa     [ ████░░░░░░ ]  30%  ~60g

  ℹ️ La proteína alta protege músculo
     durante el déficit calórico

──────────────────────────────────────────────

  ⚠️ No se recomienda bajar de 1.500 kcal
  (hombres) o 1.200 kcal (mujeres) sin
  supervisión médica.

──────────────────────────────────────────────

  [ ✓ Guardar como mi objetivo ]
  [ ↩ Recalcular ]
```

### Si el resultado calculado está por debajo del mínimo:
Mostrar warning prominente en rojo/naranja y ajustar automáticamente al mínimo:
```
⚠️ Con tu ritmo elegido, el objetivo sería
1.100 kcal — por debajo del mínimo saludable.
Hemos ajustado a 1.500 kcal (mínimo recomendado).
Considera elegir un ritmo más suave.
```

### Distribución de macros — lógica de cálculo:
```js
function calculateMacros(calories, goal) {
  // Basado en evidencia para cada objetivo
  const macroRatios = {
    'lose':     { protein: 0.30, carbs: 0.40, fat: 0.30 }, // proteína alta para preservar músculo
    'maintain': { protein: 0.25, carbs: 0.45, fat: 0.30 },
    'gain':     { protein: 0.25, carbs: 0.50, fat: 0.25 }  // más carbos para energía en entreno
  };
  
  const ratio = macroRatios[goal];
  return {
    protein: Math.round((calories * ratio.protein) / 4), // 4 kcal/g
    carbs:   Math.round((calories * ratio.carbs)   / 4), // 4 kcal/g
    fat:     Math.round((calories * ratio.fat)     / 9)  // 9 kcal/g
  };
}
```

---

## 8. ACCIÓN "GUARDAR COMO MI OBJETIVO"

Al pulsar el botón:
1. Actualizar en el perfil del usuario: `target_calories`, `target_protein`, `target_carbs`, `target_fat`
2. Guardar también: `tdee`, `bmr`, `pal_factor`, `formula_used`, `calculated_at` en el perfil
3. Mostrar confirmación inline: *"✓ Objetivo actualizado — ahora tu app usará 1.790 kcal como referencia"*
4. Cerrar el bottom sheet después de 1.5 segundos
5. El dashboard debe reflejar el nuevo objetivo inmediatamente (refetch)

En el Worker, actualizar `PUT /api/profile` para aceptar los nuevos campos si no los acepta ya. Añadir a la tabla users si faltan:
```sql
-- Avisar para ejecutar manualmente en D1 si estas columnas no existen:
ALTER TABLE users ADD COLUMN tdee INTEGER;
ALTER TABLE users ADD COLUMN bmr INTEGER;
ALTER TABLE users ADD COLUMN pal_factor REAL;
ALTER TABLE users ADD COLUMN formula_used TEXT;
ALTER TABLE users ADD COLUMN tdee_calculated_at TEXT;
```

---

## 9. HISTORIAL DE CÁLCULOS

Guardar los últimos 3 cálculos en localStorage (no en D1 — no es crítico):
```js
const history = [
  { date: '2026-03-01', tdee: 2340, weight: 72.1, formula: 'mifflin-st-jeor' },
  { date: '2026-02-01', tdee: 2380, weight: 73.5, formula: 'mifflin-st-jeor' },
]
```

Mostrar en la pantalla de resultado una sección colapsable:
```
📅 Tus cálculos anteriores
  01 Feb — TDEE 2.380 kcal (peso: 73.5 kg)
  → Tu TDEE ha bajado 40 kcal al perder 1.4 kg ✓
```

Esto muestra al usuario que el TDEE cambia con el peso — muy educativo.

---

## 10. COMPONENTE — `TDEECalculator.jsx`

Crear `client/src/components/TDEECalculator.jsx`:
- Props: `{ isOpen, onClose, onSave }`
- Estado interno: `step` (1-4), `formData`, `result`
- Al hacer `onSave(result)`, el componente padre actualiza el perfil

Importar y usar desde:
- `Dashboard.jsx` — botón "Calcular TDEE" en Acciones Rápidas
- `Profile.jsx` — botón "Recalcular" junto al campo target_calories

---

## 11. DETALLES DE DISEÑO

- Transiciones entre pasos: slide horizontal (paso 1→2: slide izquierda, 2→1: slide derecha)
- Las tarjetas de selección (tipo trabajo, objetivo...) tienen borde verde y fondo ligeramente verde cuando están seleccionadas
- El resultado usa `Instrument Serif` para los números grandes (TDEE, kcal objetivo)
- Modo oscuro: todos los colores usando variables CSS existentes — cero colores hardcoded
- En móvil, el grid de opciones es 2 columnas; en desktop 3-4 columnas
- Animación de entrada del resultado: los números hacen count-up desde 0 (efecto "contador") al aparecer

---

## 12. ORDEN DE IMPLEMENTACIÓN

1. Crear `TDEECalculator.jsx` con los 4 pasos + pantalla resultado
2. Implementar funciones de cálculo (`calculateBMR`, `calculatePAL`, `calculateMacros`) en `client/src/utils/tdee.js`
3. Actualizar `PUT /api/profile` en el Worker para guardar tdee/bmr/pal si no los acepta
4. Avisarme del SQL para ejecutar en D1 si hacen falta columnas nuevas
5. Conectar desde `Dashboard.jsx` y `Profile.jsx`
6. Desplegar Worker si hubo cambios: `cd worker && npm run deploy`

---

## 13. AL FINALIZAR

- Verificar manualmente: hombre, 25 años, 175cm, 75kg, escritorio, 5k pasos, 4 días gym 1h pesas → TDEE debería estar entre 2.400-2.700 kcal
- Verificar que guardar actualiza el objetivo en el dashboard sin recargar
- `git add . && git commit -m "feat: calculadora TDEE avanzada con wizard y Mifflin-St Jeor" && git push`
- Marcar en ROADMAP.md
