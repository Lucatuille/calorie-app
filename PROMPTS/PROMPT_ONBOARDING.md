# 🚀 Onboarding Conversacional — kcal

## REGLA CRÍTICA
```bash
git checkout ui-experiments
git branch --show-current  # debe mostrar: ui-experiments
```

## REGLA IGUAL DE CRÍTICA
La calculadora TDEE en Perfil → "Calcular TDEE" NO se toca.
El onboarding es una capa NUEVA encima del registro.
El wizard del perfil sigue funcionando exactamente igual que ahora.
Son dos flujos independientes que comparten la misma lógica de cálculo.

---

## 1. BASE DE DATOS

```sql
-- Añadir a D1 Console:
ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0;

-- Todos los usuarios actuales ya tienen perfil configurado → marcar como completado
UPDATE users SET onboarding_completed = 1 WHERE target_calories IS NOT NULL AND target_calories > 0;
```

---

## 2. LÓGICA DE REDIRECCIÓN — `App.jsx`

Después del login o registro, antes de navegar al dashboard:

```jsx
// En el useEffect que maneja la autenticación:
if (user && !user.onboarding_completed) {
  navigate('/onboarding');
} else {
  navigate('/');
}
```

Si el usuario cierra la app a mitad del onboarding y vuelve a entrar → vuelve al onboarding hasta completarlo.

---

## 3. COMPONENTE `client/src/pages/Onboarding.jsx`

### Estado del componente:
```jsx
const [step, setStep] = useState(1); // 1, 2, 3, 4
const [data, setData] = useState({
  goal: null,        // 'lose' | 'maintain' | 'gain'
  gender: null,      // 'male' | 'female'
  age: '',
  weight: '',
  height: '',
  activity: null,    // 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal_weight: '',   // opcional
});
const [tdee, setTdee] = useState(null);
const [targetCalories, setTargetCalories] = useState(null);
const [monthsToGoal, setMonthsToGoal] = useState(null);
```

### Estructura de pasos:

---

#### PASO 1 — Objetivo

```
¿Qué quieres conseguir?

[📉 Perder peso]
[⚖️ Mantenerme]
[💪 Ganar músculo]
```

UI: tres cards grandes, una por línea, con icono y texto. Al tocar uno → avanza al paso 2 automáticamente sin botón.

```jsx
const GOALS = [
  { key: 'lose',     icon: '📉', label: 'Perder peso' },
  { key: 'maintain', icon: '⚖️', label: 'Mantenerme' },
  { key: 'gain',     icon: '💪', label: 'Ganar músculo' },
];
```

---

#### PASO 2 — Datos personales

Título según el objetivo:
- lose → "Cuéntanos sobre ti para calcular tu déficit"
- maintain → "Cuéntanos sobre ti para calcular tu objetivo"
- gain → "Cuéntanos sobre ti para calcular tu superávit"

Campos en orden:
```
Sexo:      [Hombre] [Mujer]  ← toggle igual que en Perfil
Edad:      [input número]
Peso (kg): [input número]
Altura (cm): [input número]

Si goal === 'lose':
  Peso objetivo (kg): [input número] (opcional pero recomendado)

Actividad:
  [🪑 Sedentario]
  [🚶 Ligero (1-2 días/semana)]
  [🏃 Moderado (3-5 días/semana)]
  [💪 Activo (6-7 días/semana)]
  [🔥 Muy activo (atleta)]
```

Botón "Calcular mi objetivo →" al fondo, desactivado hasta que todos los campos obligatorios estén rellenos.

---

#### Cálculo TDEE — función compartida

IMPORTANTE: Usar la MISMA función de cálculo que ya existe en el wizard del perfil. No duplicar lógica. Extraerla a `client/src/utils/tdeeCalculator.js` si no existe ya, e importarla tanto en el onboarding como en el wizard del perfil.

```js
// client/src/utils/tdeeCalculator.js
export function calculateTDEE({ gender, age, weight, height, activity }) {
  // Mifflin-St Jeor
  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const factors = {
    sedentary:    1.2,
    light:        1.375,
    moderate:     1.55,
    active:       1.725,
    very_active:  1.9,
  };

  return Math.round(bmr * (factors[activity] || 1.55));
}

export function calculateTargetCalories(tdee, goal) {
  switch (goal) {
    case 'lose':     return Math.round(tdee - 400); // déficit moderado
    case 'gain':     return Math.round(tdee + 300); // superávit moderado
    case 'maintain': return tdee;
    default:         return tdee;
  }
}

export function calculateMonthsToGoal(currentWeight, goalWeight, dailyDeficit) {
  if (!goalWeight || dailyDeficit <= 0) return null;
  const kgToLose = currentWeight - goalWeight;
  if (kgToLose <= 0) return null;
  // 7.700 kcal ≈ 1kg de grasa
  const daysNeeded = (kgToLose * 7700) / dailyDeficit;
  return Math.ceil(daysNeeded / 30);
}
```

---

#### PASO 3 — Proyección (solo lectura, no editable)

Este paso no existe en el wizard del perfil — es exclusivo del onboarding.

Calcular en tiempo real al entrar a este paso:
```js
const tdeeValue = calculateTDEE(data);
const targetCal = calculateTargetCalories(tdeeValue, data.goal);
const deficit = tdeeValue - targetCal;
const months = calculateMonthsToGoal(data.weight, data.goal_weight, deficit);

setTdee(tdeeValue);
setTargetCalories(targetCal);
setMonthsToGoal(months);
```

UI de la pantalla:

```
[número grande — Instrument Serif itálica]
1.812
kcal/día es tu objetivo

────────────────────────────────

Tu TDEE estimado: 2.212 kcal/día

[Si goal === 'lose' y hay goal_weight:]
Con este déficit de 400 kcal/día,
podrías llegar a 65kg en
aproximadamente 4 meses

[Si goal === 'lose' y NO hay goal_weight:]
Con este déficit de 400 kcal/día
perderás ~0.5kg por semana de forma sostenible

[Si goal === 'maintain':]
Comer alrededor de 1.812 kcal/día
mantendrá tu peso actual

[Si goal === 'gain':]
Con este superávit de 300 kcal/día
ganarás músculo de forma progresiva

────────────────────────────────

ⓘ Calculado con la fórmula Mifflin-St Jeor,
   el estándar clínico más preciso.
   Puedes ajustarlo en tu perfil en cualquier momento.

[ Empezar a registrar → ]
```

El número grande en Instrument Serif itálica.
El botón "Empezar a registrar →" guarda todo y va al dashboard.

---

#### PASO 4 — Guardado y redirección

Al pulsar "Empezar a registrar →":

```js
// 1. Guardar todo en el backend de una vez
await api.updateProfile({
  age: data.age,
  weight: data.weight,
  height: data.height,
  gender: data.gender,
  goal_weight: data.goal_weight || null,
  target_calories: targetCalories,
  tdee: tdee,
  formula_used: 'mifflin',
  onboarding_completed: 1,
}, token);

// 2. Actualizar el contexto de auth local
updateUser({ ...user, target_calories: targetCalories, onboarding_completed: 1 });

// 3. Marcar What's New como visto (no mostrar el popup justo después)
localStorage.setItem('lucaeats_whats_new_seen', CURRENT_VERSION);

// 4. Navegar al dashboard
navigate('/');
```

---

## 4. INDICADOR DE PROGRESO

En la parte superior del onboarding, barra de progreso discreta:

```jsx
// 4 puntos o una barra de 4 segmentos
<div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
  {[1,2,3].map(i => (
    <div key={i} style={{
      flex: 1,
      height: '2px',
      borderRadius: '100px',
      background: i <= step ? 'var(--accent)' : 'var(--surface-3)',
      transition: 'background 0.3s',
    }} />
  ))}
</div>
```

3 segmentos (objetivo → datos → proyección). Simple, discreto.

---

## 5. BOTÓN ATRÁS

En los pasos 2 y 3, mostrar un botón "← Volver" en la parte superior izquierda que regresa al paso anterior. En el paso 1 no hay botón atrás.

```jsx
{step > 1 && (
  <button
    onClick={() => setStep(step - 1)}
    style={{
      background: 'none', border: 'none',
      fontSize: '13px', color: 'var(--text-secondary)',
      cursor: 'pointer', padding: '0 0 16px',
      fontFamily: 'var(--font-sans)',
    }}
  >
    ← Volver
  </button>
)}
```

---

## 6. RUTA EN APP.JSX

```jsx
// Añadir la ruta — accesible solo si está autenticado
<Route path="/onboarding" element={
  <ProtectedRoute>
    <Onboarding />
  </ProtectedRoute>
} />
```

Si el usuario intenta acceder a `/onboarding` estando ya con `onboarding_completed = 1` → redirigir a `/`.

---

## 7. LO QUE NO SE TOCA

- `Profile.jsx` → sin cambios. El botón "Calcular TDEE" sigue ahí igual.
- El wizard TDEE existente → sin cambios.
- La lógica de cálculo → se extrae a `tdeeCalculator.js` y se importa en ambos sitios.
- Ningún usuario existente ve el onboarding → `onboarding_completed = 1` para todos los que ya tienen `target_calories`.

---

## 8. AL FINALIZAR

```bash
git add .
git commit -m "feat: onboarding conversacional con proyección de objetivo"
git push origin ui-experiments
```

Verificar:
- Usuario nuevo (sin target_calories) → ve el onboarding al registrarse
- Usuario existente → no ve el onboarding, va directo al dashboard
- Paso 1 → al tocar objetivo avanza automáticamente
- Paso 3 → muestra el número calculado en Instrument Serif grande
- Al terminar → dashboard con target_calories configurado
- Perfil → "Calcular TDEE" sigue funcionando exactamente igual
- `onboarding_completed = 1` en D1 después de completar el flujo
