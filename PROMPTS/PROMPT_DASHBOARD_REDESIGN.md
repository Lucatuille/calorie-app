# 🎨 Rediseño Dashboard Completo — kcal Evolved

## REGLA CRÍTICA
Trabajar ÚNICAMENTE en el branch `ui-experiments`. Verificar antes de empezar:
```bash
git checkout ui-experiments
git branch --show-current  # debe mostrar: ui-experiments
```
NUNCA hacer cambios en `main`.

---

## 1. TOKENS CSS — Actualizar `global.css`

Reemplazar las variables de color y tipografía existentes por este sistema:

```css
:root {
  /* Backgrounds */
  --bg:            #fafaf8;
  --surface:       #ffffff;
  --surface-2:     #f5f4ef;
  --surface-3:     #f0efe8;

  /* Borders */
  --border:        rgba(0,0,0,0.07);
  --border-strong: rgba(0,0,0,0.12);

  /* Text */
  --text-primary:   #111111;
  --text-secondary: #a8a49a;
  --text-tertiary:  #c4c1b8;

  /* Accent */
  --accent:         #16a34a;
  --accent-light:   #f0fdf4;
  --accent-border:  #bbf7d0;
  --accent-dark:    #111111;

  /* Typography */
  --font-serif: 'Instrument Serif', serif;
  --font-sans:  'DM Sans', sans-serif;

  /* Radii */
  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  20px;
  --radius-full: 100px;
}

/* Dark mode */
[data-theme="dark"] {
  --bg:            #0f0f0f;
  --surface:       #1a1a1a;
  --surface-2:     #222222;
  --surface-3:     #2a2a2a;
  --border:        rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.12);
  --text-primary:   #f5f5f5;
  --text-secondary: #666666;
  --text-tertiary:  #444444;
  --accent-light:   #0a1f0f;
  --accent-border:  #1a3d20;
  --accent-dark:    #ffffff;
}
```

---

## 2. NAVBAR — Actualizar

El navbar actual tiene demasiados elementos. Simplificar:

```jsx
<nav style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 24px',
  height: '52px',
  background: 'var(--bg)',
  borderBottom: '0.5px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
}}>
  {/* Logo */}
  <span style={{
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: 400,
    letterSpacing: '2px',
    fontFamily: 'var(--font-sans)',
  }}>
    kcal
  </span>

  {/* Links — desktop only */}
  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
    {['Inicio', 'Registrar', 'Historial', 'Progreso', 'Perfil'].map(link => (
      <NavLink key={link} to={...} style={({ isActive }) => ({
        fontSize: '14px',
        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
        textDecoration: 'none',
        fontWeight: isActive ? 500 : 400,
      })}>
        {link}
      </NavLink>
    ))}
    {isPro(user?.access_level) && (
      <NavLink to="/asistente" style={...}>
        Asistente
      </NavLink>
    )}
  </div>

  {/* Right side */}
  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
      {user?.name}
    </span>
    {/* Badge de nivel */}
    {getLevelBadge(user?.access_level)}
    {/* Toggle modo oscuro */}
    <ModeToggle />
  </div>
</nav>
```

En móvil: mostrar solo logo + hamburguesa (ya implementado).

---

## 3. DASHBOARD.JSX — Estructura completa

Reemplazar el contenido del dashboard por esta estructura. El orden de secciones es FIJO — no reordenar:

```
1. Saludo + nombre
2. Hero calórico (card principal)
3. Lista de comidas de hoy
4. Suplementos
5. Card del asistente
```

Las secciones de "Últimos 30 días", "Esta semana" y "Acciones rápidas" se ELIMINAN del dashboard. El acceso a estadísticas está en Progreso.

---

### Sección 1 — Saludo

```jsx
<div style={{ padding: '20px 24px 0' }}>
  <p style={{
    fontSize: '11px',
    color: 'var(--text-secondary)',
    margin: '0 0 2px',
    fontFamily: 'var(--font-sans)',
  }}>
    {getGreeting()},
  </p>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
    <h1 style={{
      fontFamily: 'var(--font-serif)',
      fontSize: '32px',
      fontStyle: 'italic',
      fontWeight: 400,
      color: 'var(--text-primary)',
      margin: 0,
      lineHeight: 1,
    }}>
      {user?.name}
    </h1>
    {/* Racha */}
    {streak > 0 && (
      <span style={{
        fontSize: '11px',
        color: 'var(--accent)',
        background: 'var(--accent-light)',
        border: '0.5px solid var(--accent-border)',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontWeight: 500,
      }}>
        🔥 {streak} días
      </span>
    )}
  </div>
</div>
```

---

### Sección 2 — Hero calórico

```jsx
<div style={{ padding: '0 16px', marginBottom: '10px' }}>
  <div style={{
    background: 'var(--surface)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
  }}>
    {/* Fila superior: número grande + consumido/objetivo */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12px',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '52px',
          color: 'var(--text-primary)',
          lineHeight: 1,
          letterSpacing: '-2px',
        }}>
          {remaining.toLocaleString('es')}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
          kcal libres hoy
        </div>
      </div>
      <div style={{ textAlign: 'right', paddingTop: '4px' }}>
        <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {todayCalories.toLocaleString('es')}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          de {user.target_calories.toLocaleString('es')}
        </div>
      </div>
    </div>

    {/* Barra segmentada — 10 segmentos */}
    <div style={{ display: 'flex', gap: '3px', marginBottom: '12px' }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{
          flex: 1,
          height: '3px',
          borderRadius: '100px',
          background: i < filledSegments
            ? (isOver ? '#ef4444' : 'var(--accent)')
            : 'var(--surface-3)',
          transition: 'background 0.3s ease',
        }} />
      ))}
    </div>
    {/* filledSegments = Math.min(Math.round((todayCalories / target_calories) * 10), 10) */}
    {/* isOver = todayCalories > target_calories */}

    {/* Macros — grid 3 columnas */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      {[
        { val: todayProtein, label: 'proteína' },
        { val: todayCarbs,   label: 'carbos' },
        { val: todayFat,     label: 'grasa' },
      ].map((m, i) => (
        <div key={m.label} style={{
          padding: '9px 8px',
          textAlign: 'center',
          background: 'var(--surface-2)',
          borderLeft: i > 0 ? '0.5px solid var(--border)' : 'none',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {Math.round(m.val)}g
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px', letterSpacing: '0.2px' }}>
            {m.label}
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

---

### Sección 3 — Comidas de hoy

```jsx
<div style={{ padding: '0 16px', marginBottom: '10px' }}>
  <div style={{
    background: 'var(--surface)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
  }}>
    {/* Header */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: todayEntries.length > 0 ? '10px' : '0',
    }}>
      <span style={{
        fontSize: '9px',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        fontWeight: 500,
      }}>
        Hoy · {todayEntries.length} {todayEntries.length === 1 ? 'comida' : 'comidas'}
      </span>
      {/* Botón añadir — círculo verde pequeño */}
      <button
        onClick={() => navigate('/registrar')}
        style={{
          width: '22px',
          height: '22px',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M4 1v6M1 4h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>

    {/* Lista de entradas */}
    {todayEntries.length === 0 ? (
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
        Sin registros hoy — empieza añadiendo tu primera comida.
      </p>
    ) : (
      <div>
        {todayEntries.map((entry, i) => (
          <div key={entry.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: i < todayEntries.length - 1 ? '0.5px solid var(--border)' : 'none',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {entry.name || entry.meal_type}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                {MEAL_TYPES.find(m => m.key === entry.meal_type)?.label || entry.meal_type}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                {entry.calories}
              </span>
              <button
                onClick={() => handleDelete(entry.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  fontSize: '14px',
                  padding: '0',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

---

### Sección 4 — Suplementos

```jsx
<div style={{ padding: '0 16px', marginBottom: '10px' }}>
  <div style={{
    background: 'var(--surface)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
  }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px',
    }}>
      <span style={{
        fontSize: '9px',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        fontWeight: 500,
      }}>
        Suplementos · {taken}/{total}
      </span>
      <button onClick={() => setManagerOpen(true)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-tertiary)', fontSize: '14px', padding: 0,
      }}>
        ✎
      </button>
    </div>

    {supplements.length === 0 ? (
      <button onClick={() => setManagerOpen(true)} style={{
        width: '100%', background: 'var(--surface-2)',
        border: '0.5px dashed var(--border-strong)',
        borderRadius: 'var(--radius-md)', padding: '12px',
        fontSize: '13px', color: 'var(--text-secondary)',
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}>
        + Añadir suplementos
      </button>
    ) : (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(supplements.length, 4)}, 1fr)`,
        gap: '6px',
      }}>
        {supplements.map(s => (
          <button
            key={s.id}
            onClick={() => handleToggle(s)}
            style={{
              background: s.taken ? 'var(--accent-light)' : 'var(--surface)',
              border: `0.5px solid ${s.taken ? 'var(--accent-border)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '9px 6px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '18px', display: 'block' }}>{s.emoji}</span>
            <span style={{
              fontSize: '8px',
              display: 'block',
              marginTop: '3px',
              color: s.taken ? 'var(--accent)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
            }}>
              {s.name}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

---

### Sección 5 — Card del asistente

```jsx
<div style={{ padding: '0 16px 32px' }}>
  {isPro(user?.access_level) ? (
    /* PRO — card negra activa */
    <button
      onClick={() => navigate('/asistente')}
      style={{
        width: '100%',
        background: '#111',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{
          fontSize: '10px',
          background: 'var(--accent)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontWeight: 600,
          alignSelf: 'flex-start',
          marginBottom: '2px',
          fontFamily: 'var(--font-sans)',
        }}>
          Pro
        </span>
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff', fontFamily: 'var(--font-sans)' }}>
          Asistente personal
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sans)' }}>
          {welcomeMessage}
        </span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>→</span>
    </button>
  ) : (
    /* FREE — card gris bloqueada */
    <button
      onClick={() => navigate('/planes')}
      style={{
        width: '100%',
        background: 'var(--surface-2)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
          Asistente personal
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
          Tu nutricionista con IA · Pro
        </span>
      </div>
      <span style={{ fontSize: '16px' }}>🔒</span>
    </button>
  )}
</div>
```

Para el `welcomeMessage` de la card Pro — usar la misma función `buildWelcomeMessage` ya implementada pero devolver solo el estado calórico (sin saludo ni cierre):

```js
// Solo la parte del estado calórico, sin saludo ni cierre
const assistantPreview = getEstadoCalorico(
  { todayCalories, todayProtein },
  user.target_calories,
  user.target_protein
);
```

---

## 4. LO QUE SE ELIMINA DE DASHBOARD.JSX

Eliminar completamente estos bloques:
- Sección "Esta semana" / "Últimos 7 días"
- Sección "Últimos 30 días" con las 4 tarjetas de stats
- Sección "Acciones rápidas" con los 4 botones grandes
- El donut chart (ya está en Progreso)
- Las pills de colores de macros (reemplazadas por el grid de macros)

---

## 5. TIPOGRAFÍA GLOBAL

En `global.css`, asegurarse de que el import de Google Fonts incluye los pesos correctos:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
```

Aplicar globalmente:
```css
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}
```

---

## 6. AL FINALIZAR

```bash
git add .
git commit -m "redesign: dashboard evolved — hero calórico, barra segmentada, card asistente"
git push origin ui-experiments
```

Verificar en `ui-experiments.calorie-app.pages.dev`:
- El banner naranja de preview aparece arriba
- El nombre aparece en itálica sin punto final
- La barra segmentada tiene 10 segmentos
- Las secciones eliminadas ya no están
- La card del asistente es negra para Pro, gris para Free
- En modo oscuro todo sigue legible

NUNCA mergear a main sin revisión completa en móvil real.
