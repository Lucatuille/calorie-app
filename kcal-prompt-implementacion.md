# PROMPT DE IMPLEMENTACIÓN — kcal Sistema C
## Instrucciones completas para refactorizar la UI en el branch ui-experiments

---

## CONTEXTO

Estás trabajando en una PWA React 18 + Vite llamada **kcal**, branch `ui-experiments`.
El objetivo es aplicar el sistema de diseño "C" de forma consistente en todas las pantallas.
El sistema ya tiene la estructura de componentes, routing y lógica funcionando.
**Solo tocas CSS, layout y componentes visuales. No tocas lógica de negocio, auth, ni llamadas a la API.**

Antes de empezar, pide ver estos archivos:
- `src/App.jsx` o el layout raíz
- `src/index.css` o el archivo de variables CSS global
- Los componentes de cada pantalla: Dashboard, Calculator/Registrar, History, Progress, Assistant
- El componente de navegación actual (Navbar o similar)

---

## SISTEMA DE DISEÑO — VARIABLES Y TOKENS

Asegúrate de que estas variables CSS están definidas globalmente (en `index.css` o `:root`):

```css
:root {
  /* Superficies */
  --color-bg:        #F5F2EE;   /* crema — fondo base de toda la app */
  --color-surface:   #FFFFFF;   /* blanco — fondo de cards elevadas */
  --color-surface-2: #F0EDE9;   /* crema oscuro — fondo de elementos dentro de cards */
  --color-dark:      #111111;   /* negro — cards oscuras, botón primario */
  --color-border:    #E8E4DE;   /* borde sutil entre elementos */

  /* Texto */
  --color-text-primary:   #111111;
  --color-text-secondary: #888888;
  --color-text-disabled:  #BBBBBB;

  /* Acentos */
  --color-green:      #22c55e;
  --color-green-soft: #dcfce7;
  --color-green-text: #166534;
  --color-amber:      #f59e0b;
  --color-blue:       #3b82f6;

  /* Sombras — el corazón del sistema C */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);

  /* Tipografía */
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-sans:  'DM Sans', sans-serif;

  /* Espaciado base */
  --page-px: 14px;   /* padding horizontal de página */
  --card-p:  16px;   /* padding interno de cards */
  --gap:     10px;   /* gap entre cards */
}
```

---

## REGLA MAESTRA DEL SISTEMA C

Cada pantalla sigue exactamente estas tres reglas, sin excepción:

1. **Fondo crema (`--color-bg`), contenido en cards blancas con sombra.**
   El contraste viene de la elevación (sombra), no de colores de fondo distintos.

2. **Un elemento oscuro (`--color-dark`) por pantalla.**
   Puede ser una card dark, un botón primario, o una celda de stat. Ancla la composición.
   Nunca más de dos elementos dark en la misma pantalla visible.

3. **Un solo acento de color: el verde.**
   Amber y azul solo se usan en barras de macros (carbos y grasa respectivamente).
   El rojo solo para estados de error. Nunca para decoración.

---

## COMPONENTE 1 — BOTTOM NAVIGATION BAR

Crea `src/components/BottomNav.jsx`.
Este componente es **solo para móvil** (< 768px). En desktop no se renderiza.

### Estructura de items (orden exacto, no cambiar):
| Pos | Label | Ruta |
|-----|-------|------|
| 1 | Inicio | `/` |
| 2 | Registrar | `/calculator` |
| 3 | Asistente | `/asistente` |
| 4 | Progreso | `/progress` |
| 5 | Perfil | `/profile` |

### Código de referencia:

```jsx
// src/components/BottomNav.jsx
import { NavLink, useLocation } from 'react-router-dom';
import './BottomNav.css';

const NAV_ITEMS = [
  { label: 'Inicio',     path: '/',           icon: '⌂'  },
  { label: 'Registrar',  path: '/calculator', icon: '+'  },
  { label: 'Asistente',  path: '/asistente',  icon: '✦'  },
  { label: 'Progreso',   path: '/progress',   icon: '↗'  },
  { label: 'Perfil',     path: '/profile',    icon: '○'  },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`
          }
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

### CSS crítico — `src/components/BottomNav.css`:

```css
/* SOLO visible en móvil */
.bottom-nav {
  display: none;
}

@media (max-width: 767px) {
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);

    /* iOS safe area — CRÍTICO, sin esto los botones quedan
       bajo el home indicator en iPhone */
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-bottom: max(env(safe-area-inset-bottom), 8px);

    /* Altura total incluyendo safe area */
    min-height: calc(56px + env(safe-area-inset-bottom, 0px));
  }
}

.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 4px 4px;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
  -webkit-tap-highlight-color: transparent; /* quita flash azul en iOS */
}

.bottom-nav__item:active {
  opacity: 0.6;
  transform: scale(0.95);
  transition: transform 0.08s ease, opacity 0.08s ease;
}

.bottom-nav__icon {
  font-size: 20px;
  color: var(--color-text-disabled);
  line-height: 1;
}

.bottom-nav__label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 400;
  color: var(--color-text-disabled);
  line-height: 1;
}

.bottom-nav__item--active .bottom-nav__icon,
.bottom-nav__item--active .bottom-nav__label {
  color: var(--color-green);
  font-weight: 500;
}
```

### Meta tag en `index.html` — OBLIGATORIO para iOS:

```html
<!-- Reemplaza el viewport meta existente por este -->
<meta name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

Sin `viewport-fit=cover`, el `env(safe-area-inset-bottom)` no funciona en iOS Safari.

---

## COMPONENTE 2 — LAYOUT PRINCIPAL

En el layout raíz (`App.jsx` o el componente que envuelve todas las rutas),
añade el BottomNav y el padding-bottom del contenido:

```jsx
// Dentro del layout principal
import BottomNav from './components/BottomNav';

// En el JSX:
<div className="app-layout">
  <TopNavbar />           {/* navbar existente — no tocar */}
  <main className="app-main">
    <Outlet />            {/* o {children} según tu setup */}
  </main>
  <BottomNav />
</div>
```

```css
/* En el CSS del layout */
.app-main {
  /* En móvil, el contenido no queda tapado por el bottom nav */
  /* 56px = altura base del bottom nav */
  /* env() = altura del home indicator de iOS */
}

@media (max-width: 767px) {
  .app-main {
    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
    padding-bottom: calc(56px + max(env(safe-area-inset-bottom), 8px));
  }
}
```

### Ocultar el hamburguesa en móvil:
El botón del menú hamburguesa existente debe ocultarse en móvil
ya que el bottom nav reemplaza su función:

```css
@media (max-width: 767px) {
  .hamburger-btn,       /* ajusta el selector al nombre real */
  .mobile-menu-toggle {
    display: none;
  }
}
```

---

## COMPONENTE 3 — CARD SYSTEM

Crea estos helpers reutilizables en `src/components/Card.jsx`
o aplica las clases directamente si prefieres no crear el componente:

```css
/* Cards — el corazón visual del sistema C */

.card {
  background: var(--color-surface);
  border-radius: 18px;
  box-shadow: var(--shadow-md);
  padding: var(--card-p);
  /* Sin margin — lo gestiona el padre con gap o padding */
}

.card--dark {
  background: var(--color-dark);
  border-radius: 18px;
  padding: var(--card-p);
  color: white;
}

.card--inner {
  /* Para elementos dentro de una card — sin sombra propia */
  background: var(--color-bg);  /* crema */
  border-radius: 12px;
  padding: 10px;
}

/* Accent bar superior de macros */
.card--macro-green { position: relative; overflow: hidden; }
.card--macro-green::before,
.card--macro-amber::before,
.card--macro-blue::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
}
.card--macro-green::before { background: var(--color-green); }
.card--macro-amber::before { background: var(--color-amber); }
.card--macro-blue::before  { background: var(--color-blue);  }
```

---

## PANTALLA 1 — DASHBOARD

El dashboard ya funciona bien. Los cambios son mínimos:

1. **Wrapper de contenido:** añade `display: flex; flex-direction: column; gap: var(--gap);`
   con `padding: 12px var(--page-px) 0;` para espaciado consistente.

2. **Card hero (kcal libres + macros):** ya tiene el estilo correcto.
   Asegúrate de que usa `class="card"` con `var(--shadow-md)`.

3. **Card de comidas del día:** igual, `class="card"`.

4. **Card de suplementos:** igual, `class="card"`.

5. **Card del Asistente:** `class="card--dark"` — este es el elemento oscuro de la pantalla.

---

## PANTALLA 2 — REGISTRAR

### Cambios respecto a la versión actual:

**A. Meal selector como tabs unificados (no chips sueltos):**

```jsx
<div className="meal-selector">
  {['Desayuno', 'Comida', 'Cena', 'Snack', 'Otro'].map(meal => (
    <button
      key={meal}
      className={`meal-selector__tab ${selectedMeal === meal ? 'meal-selector__tab--active' : ''}`}
      onClick={() => setSelectedMeal(meal)}
    >
      {meal}
    </button>
  ))}
</div>
```

```css
.meal-selector {
  display: flex;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 3px;
  box-shadow: var(--shadow-sm);
  margin: 10px var(--page-px) 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.meal-selector::-webkit-scrollbar { display: none; }

.meal-selector__tab {
  flex: 1;
  min-width: fit-content;
  padding: 7px 10px;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-secondary);
  border-radius: 9px;
  cursor: pointer;
  background: transparent;
  border: none;
  white-space: nowrap;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.meal-selector__tab--active {
  background: var(--color-dark);
  color: white;
  font-weight: 500;
}
```

**B. Method cards (Foto IA / Escanear / Describir):**

```css
.method-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin: 10px var(--page-px) 0;
}

.method-card {
  background: var(--color-surface);
  border: 1.5px solid transparent;
  border-radius: 14px;
  padding: 14px 8px;
  text-align: center;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.method-card--active {
  background: var(--color-green-soft);
  border-color: var(--color-green);
}

.method-card__icon { font-size: 20px; margin-bottom: 4px; }
.method-card__label { font-size: 10px; color: var(--color-text-secondary); }
.method-card--active .method-card__label {
  color: var(--color-green-text);
  font-weight: 500;
}
```

**C. Input card (contenedor unificado nombre + kcal + macros):**

```css
.input-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  padding: var(--card-p);
  margin: 10px var(--page-px) 0;
}

.input-card__field {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-text-disabled);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
  width: 100%;
  background: transparent;
  border-top: none;
  border-left: none;
  border-right: none;
  outline: none;
}
.input-card__field::placeholder { color: var(--color-text-disabled); }

.input-card__kcal {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 10px 0;
}
.input-card__kcal-num {
  font-family: var(--font-serif);
  font-size: 42px;
  color: var(--color-text-primary);
  line-height: 1;
}
.input-card__kcal-unit {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.macro-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.macro-input {
  background: var(--color-bg);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.macro-input::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
}
.macro-input--protein::before { background: var(--color-green); }
.macro-input--carbs::before   { background: var(--color-amber); }
.macro-input--fat::before     { background: var(--color-blue);  }

.macro-input input {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  text-align: center;
  font-family: var(--font-sans);
}
.macro-input__label {
  font-size: 9px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
```

**D. Botón guardar:**

```css
.save-btn {
  background: var(--color-dark);
  color: white;
  border-radius: 14px;
  padding: 14px;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  margin: 10px var(--page-px) 0;
  cursor: pointer;
  border: none;
  width: calc(100% - 2 * var(--page-px));
  box-shadow: var(--shadow-sm);
  transition: opacity 0.2s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent;
}

.save-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.save-btn:active:not(:disabled) {
  transform: scale(0.98);
  opacity: 0.85;
}
```

---

## PANTALLA 3 — HISTORIAL

### Cambios estructurales:

Cada grupo de día pasa a ser una **card elevada** que contiene todos los items de ese día.
El título del día va FUERA de la card (como header de sección).

```jsx
{groupedByDay.map(({ date, label, isToday, totalKcal, items }) => (
  <div key={date} className="hist-day-group">
    <div className="hist-day-header">
      <div className="hist-day-header__left">
        <span className={`hist-day-name ${isToday ? 'hist-day-name--today' : ''}`}>
          {label}
        </span>
        {!isToday && (
          <span className="hist-day-date">{formatDate(date)}</span>
        )}
      </div>
      <span className="hist-day-total">{totalKcal} kcal</span>
    </div>

    <div className="card" style={{ padding: '12px 14px' }}>
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`hist-item ${i < items.length - 1 ? 'hist-item--bordered' : ''}`}
        >
          <div className="hist-item__left">
            <div className="hist-item__name">{item.name}</div>
            <div className="hist-item__meta">
              <span className="hist-item__meal">{item.meal}</span>
              <div className="macro-dots">
                <span className="macro-dot macro-dot--green"></span>
                <span className="macro-dot macro-dot--amber"></span>
                <span className="macro-dot macro-dot--blue"></span>
              </div>
            </div>
          </div>
          <div className="hist-item__right">
            <span className="hist-item__kcal">{item.kcal}</span>
            <button className="hist-item__edit" aria-label="Editar">✎</button>
            <button className="hist-item__delete" aria-label="Eliminar">×</button>
          </div>
        </div>
      ))}
    </div>
  </div>
))}
```

```css
.hist-day-group {
  padding: 0 var(--page-px);
  margin-bottom: 14px;
}

.hist-day-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 2px;
  margin-bottom: 8px;
}

.hist-day-name {
  font-family: var(--font-serif);
  font-size: 20px;
  color: var(--color-text-primary);
}
.hist-day-name--today { color: var(--color-green); }
.hist-day-date {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-left: 6px;
}
.hist-day-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.hist-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
}
.hist-item--bordered {
  border-bottom: 1px solid var(--color-border);
}

.hist-item__left { flex: 1; min-width: 0; }
.hist-item__name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 190px;
}
.hist-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.hist-item__meal {
  font-size: 10px;
  color: var(--color-text-secondary);
}

.hist-item__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.hist-item__kcal {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-green);
}
.hist-item__edit,
.hist-item__delete {
  background: none;
  border: none;
  font-size: 13px;
  color: var(--color-border);
  cursor: pointer;
  padding: 4px;
  -webkit-tap-highlight-color: transparent;
}
.hist-item__delete:hover { color: #ef4444; }

/* Macro dots */
.macro-dots { display: flex; gap: 3px; }
.macro-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
}
.macro-dot--green { background: var(--color-green); }
.macro-dot--amber { background: var(--color-amber); }
.macro-dot--blue  { background: var(--color-blue);  }
```

---

## PANTALLA 4 — PROGRESO

### Grid de stats con una celda dark:

```css
.progress-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 12px var(--page-px) 0;
}

.stat-cell {
  background: var(--color-surface);
  border-radius: 14px;
  padding: 14px;
  box-shadow: var(--shadow-md);
}

/* La celda de Media es la dark — ancla la composición */
.stat-cell--dark {
  background: var(--color-dark);
  color: white;
}

.stat-cell__label {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}
.stat-cell--dark .stat-cell__label { color: #555; }

.stat-cell__num {
  font-family: var(--font-serif);
  font-size: 26px;
  color: var(--color-text-primary);
}
.stat-cell--dark .stat-cell__num { color: white; }
.stat-cell__num--green { color: var(--color-green); }

.stat-cell__unit {
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
.stat-cell--dark .stat-cell__unit { color: #555; }
```

### Card de Análisis profundo (dark al fondo):

Igual que en Dashboard: `class="card--dark"`.
Es el segundo elemento dark de la pantalla y refuerza el sistema.

---

## PANTALLA 5 — ASISTENTE

Esta pantalla tiene requerimientos específicos por el teclado virtual y el chat scroll.

### Estructura JSX:

```jsx
<div className="asist-screen">
  {/* Header fijo */}
  <div className="asist-header">
    <div className="asist-title">
      Asistente
      {isPro && <span className="asist-infinity">∞</span>}
    </div>
    <button className="asist-hist-btn" onClick={openHistory}>
      Historial
    </button>
  </div>

  {/* Context strip — SIEMPRE visible, no hace scroll */}
  <div className="context-strip">
    <div className="ctx-pill">
      <span className="ctx-pill__num ctx-pill__num--green">
        {kcalLibres.toLocaleString()}
      </span>
      <span className="ctx-pill__label">kcal libres</span>
    </div>
    <div className="ctx-pill">
      <span className="ctx-pill__num">{proteinaRestante}g</span>
      <span className="ctx-pill__label">proteína</span>
    </div>
    <div className="ctx-pill">
      <span className="ctx-pill__num">🔥{racha}</span>
      <span className="ctx-pill__label">días racha</span>
    </div>
  </div>

  {/* Chat — hace scroll */}
  <div className="chat-scroll" ref={chatRef}>
    {messages.map(msg => (
      <div
        key={msg.id}
        className={`bubble ${msg.role === 'user' ? 'bubble--user' : 'bubble--ai'}`}
      >
        {msg.content}
      </div>
    ))}
    {isLoading && (
      <div className="bubble bubble--ai bubble--loading">
        <span className="loading-dots">···</span>
      </div>
    )}
    {/* Anchor para auto-scroll */}
    <div ref={bottomRef} style={{ height: 1 }} />
  </div>

  {/* Suggestions — fijas sobre el input */}
  {messages.length < 3 && (
    <div className="chat-suggestions">
      {SUGGESTIONS.map(s => (
        <button key={s} className="sug-chip" onClick={() => sendMessage(s)}>
          {s}
        </button>
      ))}
    </div>
  )}

  {/* Input bar — fija al fondo */}
  <div className="chat-input-wrap">
    <div className="chat-input-bar">
      <input
        className="chat-input"
        placeholder="Pregúntame sobre tus datos..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
      />
      <button
        className="chat-send-btn"
        onClick={() => sendMessage(input)}
        disabled={!input.trim() || isLoading}
        aria-label="Enviar"
      >
        ↑
      </button>
    </div>
    <p className="chat-disclaimer">
      No es un profesional sanitario · Respuestas orientativas
    </p>
  </div>
</div>
```

### CSS del Asistente — especialmente el layout de chat:

```css
/* CRÍTICO: la pantalla del asistente usa un layout de columna flex
   donde el chat scroll es el único elemento que crece */

.asist-screen {
  display: flex;
  flex-direction: column;
  /* En móvil: altura = viewport menos top navbar menos bottom nav */
  height: calc(100vh - 60px); /* ajusta 60px a la altura de tu top navbar */
  background: var(--color-bg);
  overflow: hidden; /* evita double scroll */
}

@media (max-width: 767px) {
  .asist-screen {
    /* Resta también el bottom nav + safe area */
    height: calc(
      100vh
      - 60px  /* top navbar */
      - 56px  /* bottom nav */
      - env(safe-area-inset-bottom, 0px)
    );
  }
}

.asist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px var(--page-px) 10px;
  flex-shrink: 0; /* no se encoge */
}
.asist-title {
  font-family: var(--font-serif);
  font-size: 28px;
  color: var(--color-text-primary);
}
.asist-infinity {
  font-family: var(--font-sans);
  font-size: 16px;
  color: var(--color-text-secondary);
  font-weight: 300;
  margin-left: 4px;
}
.asist-hist-btn {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: none;
  padding: 6px 14px;
  border-radius: 100px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  -webkit-tap-highlight-color: transparent;
}

/* Context strip */
.context-strip {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  padding: 0 var(--page-px) 10px;
  flex-shrink: 0;
}
.ctx-pill {
  background: var(--color-surface);
  border-radius: 10px;
  padding: 8px;
  text-align: center;
  box-shadow: var(--shadow-sm);
}
.ctx-pill__num {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.2;
}
.ctx-pill__num--green { color: var(--color-green); }
.ctx-pill__label {
  display: block;
  font-size: 9px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

/* Chat scroll area — FLEX GROW, el único elemento que crece */
.chat-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px var(--page-px) 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  -webkit-overflow-scrolling: touch; /* scroll momentum en iOS */
  overscroll-behavior: contain;      /* evita que el scroll pase al body */
  scroll-behavior: smooth;
}

/* Burbujas */
.bubble {
  max-width: 88%;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}
.bubble--ai {
  background: var(--color-surface);
  border-radius: 14px 14px 14px 4px;
  padding: 13px 14px;
  box-shadow: var(--shadow-sm);
  align-self: flex-start;
}
.bubble--user {
  background: var(--color-dark);
  border-radius: 14px 14px 4px 14px;
  padding: 11px 14px;
  color: white;
  align-self: flex-end;
  max-width: 80%;
}
.bubble--loading {
  opacity: 0.5;
}
.loading-dots {
  letter-spacing: 3px;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* Suggestions */
.chat-suggestions {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px var(--page-px) 8px;
  scrollbar-width: none;
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}
.chat-suggestions::-webkit-scrollbar { display: none; }

.sug-chip {
  white-space: nowrap;
  background: var(--color-surface);
  border: none;
  border-radius: 100px;
  padding: 7px 14px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-primary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s;
}
.sug-chip:active { opacity: 0.6; }

/* Input bar fija al fondo del asistente */
.chat-input-wrap {
  padding: 6px var(--page-px) 10px;
  flex-shrink: 0;
  background: var(--color-bg);
}
.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-surface);
  border-radius: 14px;
  padding: 10px 12px;
  box-shadow: var(--shadow-md);
}
.chat-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
}
.chat-input::placeholder { color: var(--color-text-disabled); }
.chat-send-btn {
  width: 30px; height: 30px;
  background: var(--color-dark);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.chat-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.chat-send-btn:active:not(:disabled) {
  transform: scale(0.92);
  opacity: 0.8;
}
.chat-disclaimer {
  text-align: center;
  font-size: 10px;
  color: var(--color-text-disabled);
  margin-top: 6px;
  font-family: var(--font-sans);
}
```

### Comportamiento del teclado virtual en móvil (CRÍTICO):

Cuando el teclado sube en iOS/Android, el input debe seguir visible.
Añade este hook o lógica al componente del Asistente:

```jsx
// Auto-scroll al último mensaje cuando llega respuesta
useEffect(() => {
  if (bottomRef.current) {
    bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }
}, [messages]);

// En iOS, cuando el teclado sube, el viewport cambia.
// El layout flex con height:100vh se adapta automáticamente
// SI el meta viewport tiene viewport-fit=cover.
// No necesitas JS adicional si el CSS está correcto.
```

---

## CHECKLIST DE VALIDACIÓN

Antes de dar por completada la implementación, verifica cada punto:

### Bottom Nav
- [ ] No aparece en desktop (≥ 768px)
- [ ] Aparece en móvil (< 768px)
- [ ] El item activo se resalta en verde
- [ ] La barra no tapa el contenido en iPhone (safe area)
- [ ] El tap en iOS no muestra el flash azul
- [ ] El botón hamburguesa está oculto en móvil

### Asistente
- [ ] El chat hace scroll pero el header, context strip e input son fijos
- [ ] El input es visible cuando el teclado virtual sube
- [ ] El auto-scroll funciona al recibir nuevas respuestas
- [ ] Las sugerencias desaparecen cuando hay más de 2 mensajes
- [ ] El botón enviar se deshabilita con input vacío o mientras carga

### Sistema visual
- [ ] Todas las cards usan `var(--shadow-md)` — no `border: 1px solid`
- [ ] El botón "Guardar comida" es dark (`var(--color-dark)`)
- [ ] Las macros tienen accent bar de color en la parte superior
- [ ] El Historial agrupa por días en cards individuales
- [ ] "Hoy" en Historial aparece en verde
- [ ] El Progreso tiene la celda "Media 7D" en dark
- [ ] La card del Asistente en Dashboard es dark
- [ ] Ninguna pantalla tiene más de 2 elementos dark visibles a la vez

### iOS específico
- [ ] `<meta viewport content="..., viewport-fit=cover">` en index.html
- [ ] `padding-bottom: env(safe-area-inset-bottom)` en bottom nav
- [ ] `-webkit-overflow-scrolling: touch` en el chat scroll
- [ ] `overscroll-behavior: contain` en el chat scroll
- [ ] `-webkit-tap-highlight-color: transparent` en todos los botones táctiles

---

## NOTAS FINALES

- **No cambies nada de desktop.** Si tienes dudas sobre si algo afecta a desktop, añade el cambio dentro de `@media (max-width: 767px)`.
- **No toques la lógica de los mensajes del asistente, el motor de calibración, ni las llamadas a la API de Claude.**
- Si encuentras que el componente del Asistente tiene un `overflow: hidden` heredado que bloquea el scroll del chat, es el problema más común — búscalo en los ancestros del componente y elimínalo o cámbialo a `overflow: visible`.
- Pide los archivos antes de escribir código. No asumas la estructura.
