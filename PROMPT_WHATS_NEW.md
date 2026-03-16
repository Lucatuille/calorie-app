# ✨ Sistema What's New — LucaEats

## Contexto
Implementar un sistema de "Novedades" que aparece una vez por versión cuando el usuario abre la app después de una actualización importante. Solo frontend — sin backend ni BD. El sistema debe ser fácil de mantener para futuras versiones: añadir una nueva entrada = 5 minutos de trabajo.

---

## 1. ARQUITECTURA DEL SISTEMA

### El archivo central de versiones — `client/src/data/whatsNew.js`

Este es el único archivo que hay que tocar para futuras versiones. Estructura de datos clara y extensible:

```js
// INSTRUCCIONES PARA FUTURAS VERSIONES:
// 1. Añade un nuevo objeto al INICIO del array (las versiones van de más reciente a más antigua)
// 2. Incrementa CURRENT_VERSION
// 3. Cada release tiene: version, date, title, subtitle, items[]
// 4. Cada item tiene: icon, title, description, tag (optional)
// Tags disponibles: 'new' | 'improved' | 'fix'

export const CURRENT_VERSION = '1.3.0';

export const RELEASES = [
  {
    version: '1.3.0',
    date: 'Marzo 2026',
    title: 'Tres formas de registrar',
    subtitle: 'La app que aprende cómo comes tú',
    items: [
      {
        icon: '▦',
        title: 'Escáner de código de barras',
        description: 'Escanea cualquier producto del supermercado y obtén sus macros al instante. Los productos escaneados se guardan para la próxima vez.',
        tag: 'new'
      },
      {
        icon: '✏️',
        title: 'Describe tu comida con texto',
        description: 'Escribe "pollo con arroz y ensalada" o "menú del día de restaurante" y la IA calcula los macros sola. Sin fotos, sin escáner.',
        tag: 'new'
      },
      {
        icon: '🎯',
        title: 'IA que aprende de ti',
        description: 'Cada corrección que haces mejora las estimaciones futuras. Después de 5 usos, la app ya conoce tus raciones reales.',
        tag: 'new'
      },
      {
        icon: '💊',
        title: 'Seguimiento de suplementos',
        description: 'Marca tus suplementos del día con un toque desde el dashboard. Creatina, Omega 3, Vitamina D — todo en un vistazo.',
        tag: 'new'
      },
      {
        icon: '📊',
        title: 'Análisis avanzado con proyección',
        description: 'Abre el análisis detallado en Progreso para ver tu proyección de peso basada en tu déficit real y adherencia.',
        tag: 'new'
      },
      {
        icon: '🧮',
        title: 'Calculadora TDEE mejorada',
        description: 'Wizard paso a paso con preguntas concretas. Ahora usa la fórmula Mifflin-St Jeor 1990, el estándar clínico más preciso.',
        tag: 'improved'
      },
      {
        icon: '🌙',
        title: 'Modo oscuro',
        description: 'Actívalo desde el navbar. Tu preferencia se guarda automáticamente.',
        tag: 'new'
      }
    ]
  }
  // Las siguientes versiones se añaden aquí encima, siguiendo el mismo formato
  // Ejemplo de próxima versión:
  // {
  //   version: '1.4.0',
  //   date: 'Abril 2026',
  //   title: 'Tu título aquí',
  //   subtitle: 'Tu subtítulo aquí',
  //   items: [...]
  // }
];
```

---

## 2. LÓGICA DE CONTROL — `client/src/hooks/useWhatsNew.js`

```js
import { useState, useEffect } from 'react';
import { CURRENT_VERSION, RELEASES } from '../data/whatsNew';

const STORAGE_KEY = 'lucaeats_whats_new_seen';

export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [releaseToShow, setReleaseToShow] = useState(null);

  useEffect(() => {
    // Esperar 1.5 segundos después de montar — no interrumpir la carga inicial
    const timer = setTimeout(() => {
      const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
      
      // Si nunca ha visto ninguna versión O la versión actual es nueva
      if (lastSeenVersion !== CURRENT_VERSION) {
        // Mostrar solo la versión más reciente (la primera del array)
        setReleaseToShow(RELEASES[0]);
        setIsOpen(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setIsOpen(false);
  };

  // Para testing/desarrollo: forzar apertura
  const forceOpen = () => {
    setReleaseToShow(RELEASES[0]);
    setIsOpen(true);
  };

  return { isOpen, releaseToShow, dismiss, forceOpen };
}
```

---

## 3. EL COMPONENTE — `client/src/components/WhatsNew.jsx`

### Diseño visual:

```
┌──────────────────────────────────────────┐  ← overlay oscuro detrás
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  ✨ Novedades · Marzo 2026     [✕] │  │
│  │                                    │  │
│  │  Tres formas de registrar         │  │
│  │  La app que aprende cómo comes tú  │  │
│  │                                    │  │
│  │  ────────────────────────────────  │  │
│  │                                    │  │
│  │  ▦  Escáner de código de barras   │  │  ← scrollable
│  │     Escanea cualquier producto... │  │
│  │     [NUEVO]                        │  │
│  │                                    │  │
│  │  ✏️  Describe tu comida con texto  │  │
│  │     Escribe "pollo con arroz"...  │  │
│  │     [NUEVO]                        │  │
│  │                                    │  │
│  │  🎯  IA que aprende de ti          │  │
│  │     Cada corrección mejora...     │  │
│  │     [NUEVO]                        │  │
│  │                                    │  │
│  │  ────────────────────────────────  │  │
│  │                                    │  │
│  │  [ ¡Entendido, a probarlo! ]      │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Especificaciones de diseño:

**El modal:**
- `position: fixed`, centrado vertical y horizontalmente
- `max-width: 480px`, `max-height: 80vh`
- `border-radius: var(--border-radius-lg)`
- `background: var(--bg)` o `var(--surface)`
- Box shadow sutil
- Overflow-y: auto en la lista de items (scrollable si hay muchos)
- El header (título + subtítulo) y el botón CTA son sticky — no scrollean

**El overlay:**
- `position: fixed, inset: 0`
- `background: rgba(0,0,0,0.5)`
- `backdrop-filter: blur(2px)`
- Click en overlay → dismiss (misma lógica que botón cerrar)
- `z-index: 9000`

**El header del modal:**
```
✨ Novedades · [date]                    [✕]
──────────────────────────────────────────
[title] — Instrument Serif, 22px
[subtitle] — DM Sans 300, 14px, color secundario
```

**Cada item de novedad:**
```jsx
<div style={{
  display: 'flex',
  gap: '12px',
  padding: '14px 0',
  borderBottom: '1px solid var(--border)'
}}>
  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>
    {item.icon}
  </span>
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <strong style={{ fontSize: '14px' }}>{item.title}</strong>
      {item.tag && <TagBadge tag={item.tag} />}
    </div>
    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', 
                 lineHeight: '1.5', margin: 0 }}>
      {item.description}
    </p>
  </div>
</div>
```

**Los badges de tag:**
```jsx
const TagBadge = ({ tag }) => {
  const styles = {
    new:      { bg: '#e8f4ee', color: '#2d6a4f', label: 'Nuevo' },
    improved: { bg: '#fff3e0', color: '#e65100', label: 'Mejorado' },
    fix:      { bg: '#fce4ec', color: '#c62828', label: 'Corregido' },
  };
  const s = styles[tag];
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: '10px', fontWeight: 600,
      padding: '2px 7px', borderRadius: '100px',
      textTransform: 'uppercase', letterSpacing: '0.3px'
    }}>
      {s.label}
    </span>
  );
};
```

**El botón CTA (sticky bottom):**
```jsx
<div style={{
  padding: '16px 0 0',
  position: 'sticky',
  bottom: 0,
  background: 'var(--bg)',
  borderTop: '1px solid var(--border)',
  marginTop: '8px'
}}>
  <button
    onClick={dismiss}
    style={{
      width: '100%',
      background: 'var(--accent)',
      color: 'white',
      border: 'none',
      padding: '13px',
      borderRadius: '100px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'DM Sans, sans-serif'
    }}
  >
    ¡Entendido, a probarlo! →
  </button>
</div>
```

**Animación de entrada:**
```css
@keyframes whatsNewIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.whats-new-modal {
  animation: whatsNewIn 0.25s ease forwards;
}
```

**Animación de salida:**
Al hacer dismiss, aplicar animación inversa antes de desmontar:
```js
const dismiss = () => {
  // Añadir clase de salida
  setIsClosing(true);
  setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setIsOpen(false);
    setIsClosing(false);
  }, 200); // duración de la animación de salida
};
```

---

## 4. INTEGRACIÓN EN APP.JSX

```jsx
import WhatsNew from './components/WhatsNew';
import { useWhatsNew } from './hooks/useWhatsNew';

function App() {
  const whatsNew = useWhatsNew();

  return (
    <>
      {/* ... resto del routing ... */}
      
      {/* What's New — solo se monta si hay algo que mostrar */}
      {whatsNew.isOpen && whatsNew.releaseToShow && (
        <WhatsNew
          release={whatsNew.releaseToShow}
          onDismiss={whatsNew.dismiss}
        />
      )}
    </>
  );
}
```

**IMPORTANTE:** El componente solo se renderiza cuando `isOpen` es true — sin modales ocultos con `display: none` que afecten al rendimiento.

---

## 5. MODO DESARROLLO — Botón para testear

En el panel admin (solo visible para admins), añadir un botón discreto para forzar la apertura del What's New sin borrar el localStorage:

```jsx
// En el panel admin, tab Overview, abajo del todo:
{process.env.NODE_ENV === 'development' && (
  <button onClick={whatsNew.forceOpen} style={{ fontSize: '12px', opacity: 0.5 }}>
    🔧 Preview What's New
  </button>
)}
```

---

## 6. REGLAS PARA FUTURAS VERSIONES

Dejar estas instrucciones comentadas en `whatsNew.js`:

```js
/*
 * CÓMO AÑADIR UNA NUEVA VERSIÓN:
 *
 * 1. Añade un nuevo objeto al INICIO del array RELEASES (más reciente primero)
 * 2. Actualiza CURRENT_VERSION con el nuevo número (ej: '1.4.0')
 * 3. El popup aparecerá automáticamente a todos los usuarios en su próxima visita
 *
 * CUÁNDO SUBIR VERSION:
 * - Patch (1.3.X): bugfixes, mejoras menores → no mostrar What's New
 * - Minor (1.X.0): features nuevas → mostrar What's New
 * - Major (X.0.0): rediseño o cambio grande → mostrar What's New con énfasis
 *
 * TAGS DISPONIBLES:
 * - 'new'      → feature nueva, badge verde
 * - 'improved' → feature mejorada, badge naranja
 * - 'fix'      → bug corregido, badge rojo (usar con moderación)
 *
 * LÍMITE RECOMENDADO: 4-6 items por versión. Si hay más, priorizar los más impactantes.
 */
```

---

## 7. CASOS EDGE A MANEJAR

**Usuario nuevo (primera vez):**
- `localStorage` no tiene `STORAGE_KEY`
- El popup se mostraría en su primera visita
- Solución: al registrarse, guardar `CURRENT_VERSION` en localStorage para que no vea el What's New de bienvenida — ya tiene el onboarding disclaimer

```js
// En Register.jsx, después del registro exitoso:
localStorage.setItem('lucaeats_whats_new_seen', CURRENT_VERSION);
```

**Usuario que borra caché:**
- Verá el What's New de nuevo aunque ya lo haya visto
- Es un edge case aceptable — no es un bug crítico

**Usuario con multiple tabs abiertos:**
- Si cierra en una tab, en la otra sigue visible
- Al hacer dismiss en cualquier tab → se guarda en localStorage → no volverá a aparecer

---

## 8. ORDEN DE IMPLEMENTACIÓN

1. Crear `client/src/data/whatsNew.js` con el contenido de la v1.3.0
2. Crear `client/src/hooks/useWhatsNew.js`
3. Crear `client/src/components/WhatsNew.jsx`
4. Integrar en `App.jsx`
5. Añadir `localStorage.setItem` en `Register.jsx` para usuarios nuevos
6. Verificar en local: borrar `lucaeats_whats_new_seen` del localStorage → recargar → debe aparecer después de 1.5s
7. Verificar que al hacer click en "Entendido" no vuelve a aparecer
8. Verificar en modo oscuro

---

## 9. AL FINALIZAR

- `git add . && git commit -m "feat: sistema what's new con versiones" && git push`
- Marcar en ROADMAP.md
- Para la próxima versión: solo editar `whatsNew.js` — nada más
