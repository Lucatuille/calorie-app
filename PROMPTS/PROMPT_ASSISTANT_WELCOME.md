# 💬 Mensajes de Bienvenida del Asistente — Templates Hardcodeados

## Contexto
El asistente nutricional ya está implementado. El primer mensaje que ve el usuario al abrir el asistente está hardcodeado en el frontend — no consume tokens de Claude. Actualizar la lógica de generación de este mensaje con las plantillas que se describen a continuación. Todo ocurre en el cliente, sin llamadas a la API.

---

## 1. LÓGICA GENERAL

El mensaje se compone de dos partes calculadas en el frontend:

```
[SALUDO DEL DÍA] + [ESTADO CALÓRICO]
[CIERRE DEL DÍA]
```

Inputs necesarios (ya disponibles en el contexto de auth y el fetch del dashboard):
- `new Date().getDay()` → 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
- `user.name` — nombre del usuario
- `todayCalories` — calorías consumidas hoy (0 si no ha registrado nada)
- `todayProtein` — proteína consumida hoy en gramos
- `user.target_calories` — objetivo calórico diario
- `user.target_protein` — objetivo de proteína (puede ser null)

---

## 2. CREAR `client/src/utils/assistantMessages.js`

Nuevo archivo con toda la lógica de los mensajes:

```js
export function buildWelcomeMessage(userName, todayData, targetCalories, targetProtein) {
  const day = new Date().getDay();
  const saludo = getSaludo(day, userName);
  const estado = getEstadoCalorico(todayData, targetCalories, targetProtein);
  const cierre = getCierre(day);
  return `${saludo} ${estado}\n${cierre}`;
}

function getSaludo(day, name) {
  const saludos = {
    0: `¡Domingo, ${name}! 🌅`,
    1: `Nueva semana, ${name}.`,
    2: `¡Hola ${name}!`,
    3: `Mitad de semana, ${name}.`,
    4: `¡Casi viernes, ${name}!`,
    5: `¡Por fin viernes, ${name}!`,
    6: `¡Sábado, ${name}!`,
  };
  return saludos[day];
}

function getEstadoCalorico(todayData, targetCalories, targetProtein) {
  const { todayCalories = 0, todayProtein = 0 } = todayData;
  const remaining = targetCalories - todayCalories;
  const remainingProtein = (targetProtein && targetProtein > 0)
    ? Math.round(targetProtein - todayProtein)
    : null;
  const pct = todayCalories / targetCalories;

  const fmt = (n) => Math.round(n).toLocaleString('es');

  // ESTADO 1 — Sin registros
  if (todayCalories === 0) {
    return `Todavía no has registrado nada hoy. Tienes ${fmt(targetCalories)} kcal para trabajar.`;
  }

  // ESTADO 2 — Inicio del día, bien encaminado (< 70%)
  if (pct < 0.70) {
    const proteinText = (remainingProtein && remainingProtein > 0)
      ? ` y ${remainingProtein}g de proteína`
      : '';
    return `Llevas ${fmt(todayCalories)} kcal — te quedan ${fmt(remaining)} kcal${proteinText} para hoy.`;
  }

  // ESTADO 3 — Cerca del objetivo, ve pensando en la cena (70-95%)
  if (pct < 0.95) {
    const proteinText = (remainingProtein && remainingProtein > 0)
      ? ` Aún te faltan ${remainingProtein}g de proteína.`
      : '';
    return `Llevas ${fmt(todayCalories)} kcal, cerca del objetivo. Quedan ${fmt(remaining)} kcal — ve pensando en la cena.${proteinText}`;
  }

  // ESTADO 4 — Justo en objetivo (95-105%)
  if (pct <= 1.05) {
    return `${fmt(todayCalories)} kcal hoy — prácticamente en el objetivo. 🎯`;
  }

  // ESTADO 5 — Superado moderadamente (105-120%)
  if (pct <= 1.20) {
    const excess = fmt(todayCalories - targetCalories);
    return `Llevas ${fmt(todayCalories)} kcal, ${excess} por encima del objetivo. No pasa nada — la semana se valora en conjunto.`;
  }

  // ESTADO 6 — Superado bastante (> 120%)
  const excess = fmt(todayCalories - targetCalories);
  return `${fmt(todayCalories)} kcal hoy, ${excess} sobre el objetivo. Días así pasan. ¿Quieres que miremos la semana completa?`;
}

function getCierre(day) {
  const cierres = {
    0: `¿Hoy también cuidamos la alimentación?`,
    1: `Buen momento para empezar fuerte. ¿Qué necesitas?`,
    2: `¿En qué te ayudo hoy?`,
    3: `¿Cómo lo llevas?`,
    4: `¿Revisamos algo?`,
    5: `El finde se acerca — ¿alguna duda antes?`,
    6: `Los fines de semana también cuentan 😄`,
  };
  return cierres[day];
}
```

---

## 3. INTEGRAR EN `Assistant.jsx`

En el `useEffect` de carga inicial, reemplazar cualquier llamada a la API para el mensaje de bienvenida por:

```jsx
import { buildWelcomeMessage } from '../utils/assistantMessages';

useEffect(() => {
  const welcomeText = buildWelcomeMessage(
    user.name,
    {
      todayCalories: todayStats?.calories || 0,
      todayProtein: todayStats?.protein || 0,
    },
    user.target_calories,
    user.target_protein || null
  );

  setMessages([{
    role: 'assistant',
    content: welcomeText,
    isWelcome: true,
    timestamp: new Date().toISOString(),
  }]);
}, []);
```

`todayStats` debe venir del mismo fetch que ya usa el Dashboard.
NO hacer una llamada nueva a la API solo para este mensaje.
El mensaje de bienvenida NO se guarda en BD — es solo UI local.

---

## 4. EJEMPLOS DE OUTPUT ESPERADO

### Lunes, sin registros:
```
Nueva semana, Luca. Todavía no has registrado nada hoy. Tienes 1.812 kcal para trabajar.
Buen momento para empezar fuerte. ¿Qué necesitas?
```

### Miércoles, superado bastante (>120%):
```
Mitad de semana, Luca. 2.100 kcal hoy, 288 sobre el objetivo. Días así pasan. ¿Quieres que miremos la semana completa?
¿Cómo lo llevas?
```

### Viernes, bien encaminado (<70%):
```
¡Por fin viernes, Luca! Llevas 943 kcal — te quedan 869 kcal y 65g de proteína para hoy.
El finde se acerca — ¿alguna duda antes?
```

### Jueves, justo en objetivo (95-105%):
```
¡Casi viernes, Luca! 1.805 kcal hoy — prácticamente en el objetivo. 🎯
¿Revisamos algo?
```

### Sábado, cerca del objetivo (70-95%):
```
¡Sábado, Luca! Llevas 1.540 kcal, cerca del objetivo. Quedan 272 kcal — ve pensando en la cena. Aún te faltan 30g de proteína.
Los fines de semana también cuentan 😄
```

### Domingo, superado moderadamente (105-120%):
```
¡Domingo, Luca! 🌅 Llevas 2.050 kcal, 238 por encima del objetivo. No pasa nada — la semana se valora en conjunto.
¿Hoy también cuidamos la alimentación?
```

---

## 5. REGLAS IMPORTANTES

- Números con `.toLocaleString('es')` → "1.812" nunca "1812"
- Si `targetProtein` es null o 0 → no mencionar proteína en ningún estado
- Si `remainingProtein` es negativo → ya superó el objetivo de proteína, no mencionarlo
- El emoji 🎯 solo en estado 4 (justo en objetivo)
- El emoji 🌅 solo en domingo, 😄 solo en sábado (cierre)
- El mensaje de bienvenida no se envía a Claude ni se guarda en BD

---

## 6. AL FINALIZAR

Verificar los 6 estados cambiando `todayCalories` manualmente en desarrollo:
- 0 kcal → estado 1
- 500 kcal (objetivo 1.812) → estado 2 (pct 27%)
- 1.400 kcal → estado 3 (pct 77%)
- 1.780 kcal → estado 4 (pct 98%)
- 2.000 kcal → estado 5 (pct 110%)
- 2.500 kcal → estado 6 (pct 138%)

`git add . && git commit -m "feat: mensajes de bienvenida del asistente con plantillas dinámicas" && git push`
