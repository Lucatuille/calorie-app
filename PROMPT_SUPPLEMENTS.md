# 💊 Feature: Sistema de Suplementos

## Contexto visual de la app
La app usa tarjetas con fondo `var(--surface)` (claro en modo día, oscuro en modo noche), bordes redondeados, tipografía DM Sans. En el dashboard hay una sección "Últimos 30 días" con 4 tarjetas en grid 2x2. Los suplementos deben seguir EXACTAMENTE este mismo patrón visual de tarjetas.

---

## 1. DÓNDE VIVE EN EL DASHBOARD

Insertar la sección **entre** "Esta semana" y "Últimos 30 días". Así el flujo visual queda:

```
HOY — resumen calórico
ESTA SEMANA — media
SUPLEMENTOS ← nueva sección aquí
ÚLTIMOS 30 DÍAS — stats
ACCIONES RÁPIDAS
```

---

## 2. ESTADOS DE LA SECCIÓN

### Estado A — Sin suplementos configurados (primer uso)

```
SUPLEMENTOS
──────────────────────────────────────
  ┌─────────────────────────────────┐
  │  +  Añadir suplementos          │
  └─────────────────────────────────┘
```

- Una sola tarjeta ancha (100% width) con borde punteado, icono + y texto
- Misma altura que una tarjeta normal
- Al tocar: abre el bottom sheet de gestión

### Estado B — Con suplementos, ninguno tomado hoy

```
SUPLEMENTOS                    0/4
──────────────────────────────────────
┌─────────┐ ┌─────────┐ ┌─────────┐
│         │ │         │ │         │
│   💪    │ │   🐟    │ │   ☀️    │
│Creatina │ │ Omega 3 │ │Vit. D   │
└─────────┘ └─────────┘ └─────────┘
┌─────────┐
│         │
│   😴    │
│Magnesio │
└─────────┘
```

Fondo claro, texto normal — estado "pendiente"

### Estado C — Con algunos tomados

Los tomados: fondo oscuro `#2d6a4f` (modo claro) o `#1a1a2e` (modo oscuro), texto blanco, checkmark ✓ sutil en esquina superior derecha.
Los pendientes: fondo claro como siempre.

```
SUPLEMENTOS                    2/4 ✓
──────────────────────────────────────
┌─────────┐ ┌─────────┐ ┌─────────┐
│▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓│ │         │
│  💪  ✓  │ │  🐟  ✓  │ │   ☀️    │
│Creatina │ │ Omega 3 │ │Vit. D   │
└─────────┘ └─────────┘ └─────────┘
```

### Estado D — Todos tomados

Contador muestra `4/4 ✓` en verde. Pequeña animación de celebración (confetti ligero o pulso verde en el contador) — igual que cuando completas las calorías del día.

---

## 3. ANIMACIÓN AL TOGGLEAR

Al tocar una tarjeta pendiente → tomada:
- Transición de fondo claro a oscuro: `transition: background-color 0.25s ease, color 0.2s ease`
- El emoji hace un pequeño "bounce" (scale 1 → 1.2 → 1) en 200ms
- El ✓ aparece con fadeIn

Al desmarcar (tomada → pendiente):
- Transición inversa, sin bounce

---

## 4. GRID RESPONSIVE

- **1-2 suplementos:** grid de 2 columnas, tarjetas más anchas
- **3-6 suplementos:** grid de 3 columnas (igual que "Últimos 30 días")
- **7+ suplementos:** grid de 4 columnas en desktop, 3 en móvil
- Cada tarjeta: altura fija ~80px, emoji grande centrado, nombre debajo en texto pequeño

```jsx
const columns = supplements.length <= 2 ? 2 : supplements.length <= 6 ? 3 : 4;
```

---

## 5. BOTTOM SHEET — GESTIÓN DE SUPLEMENTOS

Se abre al tocar "+ Añadir suplementos" o un botón de edición en el header de la sección.
Mismo estilo bottom sheet que el análisis avanzado (ya implementado).

### Estructura del bottom sheet:

```
─────── (handle bar) ───────

  Mis suplementos        [+ Nuevo]

  ┌─────────────────────────────┐
  │ 💪 Creatina          [🗑️]  │
  │ 🐟 Omega 3           [🗑️]  │  
  │ ☀️ Vitamina D        [🗑️]  │
  └─────────────────────────────┘

  Suplementos frecuentes:
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ 💊 B12   │ │ 🍊 Vit.C │ │ ⚡ Zinc  │
  └──────────┘ └──────────┘ └──────────┘
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ 🥛 Whey  │ │ 🌙 Melat.│ │ 💧 Hierro│
  └──────────┘ └──────────┘ └──────────┘

  ── O añade uno personalizado ──

  Emoji  Nombre
  [ 💊 ] [________________]  [Añadir]

  ─────────────────────────────────
              [ Listo ]
```

### Detalles del formulario personalizado:

**Campo emoji:**
- Botón que muestra el emoji actual (default: 💊)
- Al tocarlo abre un mini picker con ~20 emojis relevantes para salud:
  `💊 💉 🧪 🫀 🧬 💪 🐟 ☀️ 🍊 😴 ⚡ 🌿 🥛 💧 🫁 🧠 ❤️ 🔋 🌙 🍋`
- El picker se muestra como un popover pequeño de 4 columnas encima del botón

**Campo nombre:**
- Input de texto, máx 20 caracteres
- Placeholder: "Ej: Creatina, Proteína..."
- Validaciones:
  - No puede estar vacío
  - No puede duplicar un nombre ya existente (case insensitive)
  - Máx 20 caracteres
  - Mostrar error inline si falla la validación, nunca alert()

**Suplementos frecuentes (chips):**
- Al tocar uno, se añade directamente a la lista del usuario con su emoji predefinido
- Si ya lo tiene, aparece con fondo verde y no se puede añadir de nuevo (o desaparece de la lista)
- Los que ya tiene el usuario no aparecen en los frecuentes

**Eliminar suplemento:**
- Botón 🗑️ a la derecha de cada suplemento en la lista
- Al tocar: pide confirmación con un dialog pequeño inline (no browser alert):
  `"¿Eliminar Creatina? Se perderá el historial de este suplemento." [Cancelar] [Eliminar]`
- Si confirma: animación de slide-out hacia la derecha antes de desaparecer

---

## 6. BASE DE DATOS — SQL PARA D1

**IMPORTANTE: Generar exactamente este SQL y avisarme para ejecutarlo manualmente en D1 Console.**

```sql
CREATE TABLE user_supplements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '💊',
  order_index INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE supplement_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES user_supplements(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  taken         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(supplement_id, date)
);

CREATE INDEX idx_supplements_user ON user_supplements(user_id, active);
CREATE INDEX idx_supplement_logs_user_date ON supplement_logs(user_id, date);
```

---

## 7. BACKEND — Rutas nuevas en Worker

Crear `worker/src/routes/supplements.js` con:

### GET /api/supplements/today
Devuelve suplementos del usuario + estado de hoy:
```json
[
  { "id": 1, "name": "Creatina", "emoji": "💪", "taken": true,  "order_index": 0 },
  { "id": 2, "name": "Omega 3",  "emoji": "🐟", "taken": false, "order_index": 1 }
]
```
Usar la fecha local del cliente: aceptar `?date=YYYY-MM-DD` como query param (mismo patrón timezone que las entries).

### POST /api/supplements
Crear suplemento nuevo:
- Body: `{ name, emoji, order_index }`
- Validar UNIQUE(user_id, name) — devolver error 409 con mensaje claro si ya existe
- Máx 20 suplementos por usuario (devolver error 400 si se supera)

### DELETE /api/supplements/:id
- Verificar que el suplemento pertenece al usuario antes de borrar
- ON DELETE CASCADE borrará los logs automáticamente

### POST /api/supplements/:id/toggle
- Body: `{ date: "YYYY-MM-DD", taken: true|false }`
- Usar INSERT OR REPLACE para el upsert en supplement_logs
- Devolver el nuevo estado

### PUT /api/supplements/reorder
- Body: `[{ id, order_index }, ...]`
- Actualizar order_index de múltiples suplementos en una transacción

Registrar todas las rutas en `worker/src/index.js`.

---

## 8. FRONTEND — Componentes nuevos

### `client/src/components/SupplementTracker.jsx` — Componente principal

Props: ninguna (obtiene datos del contexto auth)

Responsabilidades:
- Fetch de `/api/supplements/today?date=YYYY-MM-DD` al montar
- Mostrar grid de tarjetas según estado
- Manejar el toggle con optimistic update:
  - Actualizar estado local INMEDIATAMENTE al tocar (sin esperar la API)
  - Hacer la llamada a la API en background
  - Si la API falla, revertir el estado local y mostrar toast de error
- Abrir/cerrar el bottom sheet de gestión

### `client/src/components/SupplementManager.jsx` — Bottom sheet de gestión

Props: `{ isOpen, onClose, onUpdate }`

Responsabilidades:
- Lista de suplementos actuales con botón eliminar
- Grid de suplementos frecuentes
- Formulario para añadir personalizado con emoji picker
- Tras cualquier cambio (añadir/eliminar), llamar `onUpdate()` para que el tracker se refresque

### `client/src/api.js` — Nuevos métodos

```js
getSupplementsToday: (date, token) => 
  request('GET', `/api/supplements/today?date=${date}`, null, token),
addSupplement: (body, token) => 
  request('POST', '/api/supplements', body, token),
deleteSupplement: (id, token) => 
  request('DELETE', `/api/supplements/${id}`, null, token),
toggleSupplement: (id, body, token) => 
  request('POST', `/api/supplements/${id}/toggle`, body, token),
```

---

## 9. PROBLEMAS CONOCIDOS A ABORDAR

### Problema 1 — Timezone
Mismo problema que con las entries: la fecha del toggle debe venir del cliente, no calcularse en el servidor. Siempre pasar `date: new Date().toLocaleDateString('en-CA')` desde el frontend.

### Problema 2 — Optimistic updates
Al tocar una tarjeta, NO esperar la respuesta de la API para actualizar la UI. Actualizar primero, llamar a la API después. Si falla, revertir. Esto hace la interacción sentirse instantánea.

```js
const handleToggle = async (supplement) => {
  // 1. Actualizar estado local inmediatamente
  setSupplements(prev => prev.map(s => 
    s.id === supplement.id ? { ...s, taken: !s.taken } : s
  ));
  
  // 2. Llamar a la API
  try {
    await api.toggleSupplement(supplement.id, {
      date: new Date().toLocaleDateString('en-CA'),
      taken: !supplement.taken
    }, token);
  } catch (err) {
    // 3. Revertir si falla
    setSupplements(prev => prev.map(s =>
      s.id === supplement.id ? { ...s, taken: supplement.taken } : s
    ));
    // Mostrar toast de error
  }
};
```

### Problema 3 — Nombre duplicado
La BD tiene UNIQUE(user_id, name) pero el error hay que comunicarlo bien en la UI. Si el usuario intenta añadir "Creatina" cuando ya tiene "creatina", mostrar debajo del input: *"Ya tienes un suplemento con este nombre"*. Nunca dejar que llegue a un error 500 sin manejar.

### Problema 4 — Máximo de suplementos
Limitar a 20 suplementos por usuario en el backend. En el frontend, si el usuario ya tiene 20, ocultar el formulario de añadir y mostrar: *"Has alcanzado el máximo de 20 suplementos"*.

### Problema 5 — Estado al cambiar de día
Si el usuario deja la app abierta y pasa la medianoche, los toggles del día anterior siguen visibles. Solucionar con un check al volver a foreground (evento `visibilitychange`) que refresca los datos si la fecha local ha cambiado.

```js
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      const today = new Date().toLocaleDateString('en-CA');
      if (today !== lastFetchDate) {
        fetchSupplements();
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [lastFetchDate]);
```

### Problema 6 — Eliminar suplemento con historial
Al eliminar un suplemento, ON DELETE CASCADE borra todos sus logs históricos. Comunicarlo claramente en el dialog de confirmación: *"Se perderá el historial de este suplemento."* Es el comportamiento correcto para simplicidad — no implementar soft delete por ahora.

### Problema 7 — Loading state
Al cargar los suplementos por primera vez, mostrar skeletons del mismo tamaño que las tarjetas (no un spinner genérico) para evitar el layout shift.

---

## 10. SUPLEMENTOS FRECUENTES PRE-CARGADOS

```js
export const COMMON_SUPPLEMENTS = [
  { name: 'Creatina',     emoji: '💪' },
  { name: 'Omega 3',      emoji: '🐟' },
  { name: 'Vitamina D',   emoji: '☀️' },
  { name: 'Magnesio',     emoji: '😴' },
  { name: 'Vitamina C',   emoji: '🍊' },
  { name: 'Zinc',         emoji: '⚡' },
  { name: 'Proteína',     emoji: '🥛' },
  { name: 'Melatonina',   emoji: '🌙' },
  { name: 'B12',          emoji: '💊' },
  { name: 'Hierro',       emoji: '💧' },
  { name: 'Colágeno',     emoji: '🧬' },
  { name: 'Ashwagandha',  emoji: '🌿' },
]
```

---

## 11. ORDEN DE IMPLEMENTACIÓN

1. Generar el SQL y avisarme para ejecutarlo en D1 Console
2. Crear `worker/src/routes/supplements.js` con las 5 rutas
3. Registrar rutas en `worker/src/index.js`
4. Desplegar Worker: `cd worker && npm run deploy`
5. Crear `client/src/utils/supplements.js` con COMMON_SUPPLEMENTS
6. Crear `SupplementManager.jsx` (bottom sheet de gestión)
7. Crear `SupplementTracker.jsx` (grid de tarjetas con toggles)
8. Importar `SupplementTracker` en `Dashboard.jsx` en la posición correcta
9. Actualizar `api.js` con los nuevos métodos

---

## 12. AL FINALIZAR

- Verificar que el toggle funciona offline (optimistic update) y se sincroniza al recuperar conexión
- Verificar que cambiar de día a medianoche resetea el estado correctamente
- `git add . && git commit -m "feat: sistema de suplementos con tracking diario" && git push`
- Avisarme del SQL para ejecutar en D1
- Marcar en ROADMAP.md
