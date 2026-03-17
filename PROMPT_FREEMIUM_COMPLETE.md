# 💎 Sistema Freemium Completo — Locks, Página de Planes y Seguridad

## Contexto
Implementar el sistema freemium completo de kcal/LucaEats. Incluye: locks visuales en features Pro, página de planes `/planes`, upsell contextual en momentos clave, y seguridad en el backend para que ningún usuario pueda acceder a features Pro sin el nivel correcto. Compatible con el sistema de niveles ya implementado (access_level en JWT y BD).

---

## 0. PRINCIPIO DE SEGURIDAD — CRÍTICO

**NUNCA confiar solo en el frontend para proteger features Pro.**

El frontend muestra/oculta la UI, pero TODA la validación real ocurre en el Worker. Un usuario podría:
- Modificar su JWT en localStorage
- Hacer llamadas directas a la API desde la consola
- Manipular el DOM para saltarse locks visuales

**Regla absoluta:** Cada endpoint que sirve data Pro verifica `access_level` en el Worker desde la BD, nunca desde el JWT solo.

```js
// En CADA endpoint Pro del Worker:
async function requireProAccess(request, env) {
  const user = await getAuthUser(request, env);
  if (!user) return null;
  
  // SIEMPRE leer de la BD, nunca solo del JWT
  // El JWT puede estar desactualizado o manipulado
  const freshUser = await env.DB.prepare(
    'SELECT access_level FROM users WHERE id = ?'
  ).bind(user.id).first();
  
  const proLevels = [1, 2, 99]; // Fundador, Pro, Admin
  if (!proLevels.includes(freshUser?.access_level)) {
    return null; // No tiene acceso Pro
  }
  return user;
}
```

**Aplicar `requireProAccess` en estos endpoints:**
- `GET /api/progress/advanced` — análisis avanzado
- `GET /api/entries/calibration-profile` — motor personal
- `DELETE /api/entries/calibration-profile` — reset calibración
- `GET /api/entries` con parámetro `days > 30` — historial extendido
- `GET /api/export/csv` — exportar datos

**Para análisis de foto y texto — verificar límite diario:**
```js
// Ya implementado en el sistema de niveles
// Verificar que funciona correctamente:
// access_level 0,3 (Free) → límite 3/día
// access_level 1,2,99 (Fundador/Pro/Admin) → ilimitado
```

---

## 1. UTILIDAD CENTRAL — `client/src/utils/proAccess.js`

```js
// Niveles que tienen acceso Pro completo
export const PRO_LEVELS = [1, 2, 99]; // Fundador, Pro, Admin

export function isPro(accessLevel) {
  return PRO_LEVELS.includes(accessLevel);
}

export function isFree(accessLevel) {
  return accessLevel === 3;
}

export function isWaitlist(accessLevel) {
  return accessLevel === 0;
}

// Features que requieren Pro
export const PRO_FEATURES = {
  ADVANCED_ANALYTICS:    'advanced_analytics',
  CALIBRATION_PROFILE:   'calibration_profile',
  UNLIMITED_AI:          'unlimited_ai',
  EXTENDED_HISTORY:      'extended_history',
  EXPORT_CSV:            'export_csv',
  UNLIMITED_SUPPLEMENTS: 'unlimited_supplements',
  MACRO_GOALS:           'macro_goals',
  TDEE_ADVANCED:         'tdee_advanced',
};

// Mensajes de upsell por feature
export const UPSELL_COPY = {
  advanced_analytics: {
    title: 'Análisis avanzado',
    description: 'Proyección de peso científica, tendencias y análisis detallado de tus hábitos.',
  },
  calibration_profile: {
    title: 'Tu motor personal',
    description: 'La IA aprende de tus correcciones y se calibra a tus raciones reales.',
  },
  unlimited_ai: {
    title: 'IA ilimitada',
    description: 'Analiza todas tus comidas sin límite diario.',
  },
  extended_history: {
    title: 'Historial completo',
    description: 'Accede a todo tu historial sin límite de días.',
  },
  export_csv: {
    title: 'Exportar datos',
    description: 'Descarga tu historial completo en CSV.',
  },
  unlimited_supplements: {
    title: 'Suplementos ilimitados',
    description: 'Añade todos los suplementos que quieras.',
  },
  macro_goals: {
    title: 'Objetivos de macros',
    description: 'Define objetivos personalizados de proteína, carbos y grasa.',
  },
  tdee_advanced: {
    title: 'Calculadora TDEE avanzada',
    description: 'Wizard completo con fórmula Katch-McArdle para atletas.',
  },
};
```

---

## 2. COMPONENTES DE LOCK

### `client/src/components/ProLock.jsx` — El lock visual

Tres variantes según el contexto:

```jsx
// VARIANTE A — Feature bloqueada en sección (la más común)
// Uso: <ProLock feature="advanced_analytics" />
//
// Renderiza un overlay sobre el contenido bloqueado:
//
// [contenido borroso detrás]
// ┌─────────────────────────────────┐
// │  🔒  Análisis avanzado          │
// │      Proyección de peso...      │
// │                                 │
// │      [ Ver planes → ]           │
// └─────────────────────────────────┘

// VARIANTE B — Badge pequeño inline
// Uso: <ProLock variant="badge" />
// Renderiza: [🔒 Pro]

// VARIANTE C — Bottom sheet de upsell
// Uso: <ProLock variant="sheet" feature="..." isOpen onClose />
// Se abre al tocar cualquier elemento bloqueado
```

**Implementación completa:**

```jsx
import { useNavigate } from 'react-router-dom';
import { UPSELL_COPY } from '../utils/proAccess';

export default function ProLock({ 
  feature,           // qué feature está bloqueada
  variant = 'overlay', // 'overlay' | 'badge' | 'sheet' | 'inline'
  isOpen,            // para variant='sheet'
  onClose,           // para variant='sheet'
  children,          // contenido a mostrar borroso detrás (variant='overlay')
}) {
  const navigate = useNavigate();
  const copy = UPSELL_COPY[feature] || { title: 'Pro', description: '' };

  const goToPlans = () => navigate('/planes');

  // BADGE — pequeño, inline
  if (variant === 'badge') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: 'var(--color-background-secondary)',
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: '100px',
        padding: '2px 8px',
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        flexShrink: 0,
      }} onClick={goToPlans}>
        🔒 Pro
      </span>
    );
  }

  // OVERLAY — sobre contenido borroso
  if (variant === 'overlay') {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--border-radius-lg)' }}>
        {/* Contenido borroso detrás */}
        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.4 }}>
          {children}
        </div>
        
        {/* Lock overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(var(--bg-rgb), 0.7)',
          backdropFilter: 'blur(2px)',
          padding: '24px',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '24px', marginBottom: '8px' }}>🔒</span>
          <strong style={{ fontSize: '15px', marginBottom: '6px' }}>{copy.title}</strong>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', 
                      marginBottom: '16px', lineHeight: '1.5' }}>
            {copy.description}
          </p>
          <button onClick={goToPlans} style={{
            background: 'var(--accent)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '100px',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            Ver planes →
          </button>
        </div>
      </div>
    );
  }

  // INLINE — fila bloqueada con icono
  if (variant === 'inline') {
    return (
      <div onClick={goToPlans} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0', opacity: 0.5, cursor: 'pointer',
        borderBottom: '1px solid var(--color-border-tertiary)',
      }}>
        <span style={{ fontSize: '14px' }}>{copy.title}</span>
        <ProLock variant="badge" feature={feature} />
      </div>
    );
  }

  // SHEET — bottom sheet de upsell
  if (variant === 'sheet') {
    if (!isOpen) return null;
    return (
      <>
        {/* Overlay */}
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 8000, backdropFilter: 'blur(2px)',
        }} />
        
        {/* Sheet */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg)', borderRadius: '20px 20px 0 0',
          padding: '24px 24px 40px',
          zIndex: 8001, textAlign: 'center',
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ width: 40, height: 4, background: 'var(--border)', 
                        borderRadius: 2, margin: '0 auto 20px' }} />
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>∞</span>
          <strong style={{ fontSize: '18px', display: 'block', marginBottom: '8px',
                           fontFamily: 'Instrument Serif, serif' }}>
            {copy.title}
          </strong>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)',
                      lineHeight: '1.6', marginBottom: '24px' }}>
            {copy.description}
          </p>
          <div style={{ background: 'var(--surface)', borderRadius: '12px',
                        padding: '16px', marginBottom: '20px' }}>
            <span style={{ fontSize: '28px', fontFamily: 'Instrument Serif, serif',
                           color: 'var(--accent)' }}>1.99€</span>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>/mes</span>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              Menos que un café · Cancela cuando quieras
            </p>
          </div>
          <button onClick={goToPlans} style={{
            width: '100%', background: 'var(--accent)', color: 'white',
            border: 'none', padding: '14px', borderRadius: '100px',
            fontSize: '15px', fontWeight: 500, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', marginBottom: '12px',
          }}>
            Activar Pro →
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--color-text-secondary)',
            fontSize: '14px', cursor: 'pointer',
          }}>
            Ahora no
          </button>
        </div>
      </>
    );
  }
}
```

---

## 3. APLICAR LOCKS EN LA APP

### `Progress.jsx` — Botón de Análisis Avanzado
```jsx
// Si es Free: mostrar botón con lock
{isPro(user.access_level) ? (
  <button onClick={() => setAnalyticsOpen(true)}>
    Análisis detallado →
  </button>
) : (
  <div onClick={() => setUpsellOpen(true)} style={{ cursor: 'pointer' }}>
    <span>Análisis detallado</span>
    <ProLock variant="badge" feature="advanced_analytics" />
  </div>
)}

<ProLock 
  variant="sheet" 
  feature="advanced_analytics"
  isOpen={upsellOpen}
  onClose={() => setUpsellOpen(false)}
/>
```

### `Profile.jsx` — Motor personal
```jsx
// Si es Free: mostrar sección bloqueada
{isPro(user.access_level) ? (
  <CalibrationSection /> // componente existente
) : (
  <ProLock variant="overlay" feature="calibration_profile">
    {/* Placeholder con datos falsos para que se vea borroso */}
    <div style={{ padding: '20px' }}>
      <p>Correcciones registradas: 12</p>
      <p>Precisión: ████████░░ Mejorando</p>
      <p>Pasta +35% · Ensaladas +28%</p>
    </div>
  </ProLock>
)}
```

### `Profile.jsx` — Exportar CSV
```jsx
{isPro(user.access_level) ? (
  <button onClick={handleExport}>↓ CSV</button>
) : (
  <div onClick={() => setUpsellOpen(true)}>
    <span style={{ opacity: 0.4 }}>↓ CSV</span>
    <ProLock variant="badge" feature="export_csv" />
  </div>
)}
```

### `Profile.jsx` — Objetivos de macros
```jsx
{isPro(user.access_level) ? (
  <MacroGoalsForm /> // formulario existente
) : (
  <ProLock variant="inline" feature="macro_goals" />
)}
```

### `SupplementTracker.jsx` — Límite de 5 suplementos
```jsx
// Si tiene 5+ suplementos y es Free, mostrar lock en el botón de añadir
{supplements.length >= 5 && !isPro(user.access_level) ? (
  <div onClick={() => setUpsellOpen(true)} style={{ cursor: 'pointer' }}>
    <span style={{ opacity: 0.4 }}>+ Añadir suplemento</span>
    <ProLock variant="badge" feature="unlimited_supplements" />
  </div>
) : (
  <button onClick={() => setManagerOpen(true)}>+ Añadir suplemento</button>
)}
```

### `Calculator.jsx` — TDEE avanzado (Katch-McArdle)
```jsx
// El campo de % grasa corporal en el wizard TDEE
{isPro(user.access_level) ? (
  <BodyFatInput /> // input existente
) : (
  <div onClick={() => setUpsellOpen(true)}>
    <ProLock variant="inline" feature="tdee_advanced" />
  </div>
)}
```

### `Progress.jsx` — Historial extendido (más de 30 días)
```jsx
// En el selector de período del gráfico
const periodOptions = isPro(user.access_level) 
  ? ['7 días', '30 días', '90 días']
  : ['7 días', '30 días'];

// Si Free intenta seleccionar 90 días → upsell
```

---

## 4. MENSAJE DE LÍMITE DE IA — Actualizar `AddEntryForm.jsx`

Cuando el backend devuelve `error: 'ai_limit_reached'`:

```jsx
{aiLimitReached && (
  <div style={{
    background: 'var(--surface)', borderRadius: '16px',
    padding: '20px', textAlign: 'center', marginTop: '16px',
  }}>
    <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>⚡</span>
    <strong style={{ display: 'block', marginBottom: '6px' }}>
      Has usado tus 3 análisis de hoy
    </strong>
    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
      Se renuevan a las 00:00 · quedan {hoursUntilMidnight}h
    </p>
    
    <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
      <span style={{ fontSize: '20px', color: 'var(--accent)', fontWeight: 600 }}>∞ Pro</span>
      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}> · IA ilimitada · 1.99€/mes</span>
    </div>
    
    <button onClick={() => navigate('/planes')} style={{
      width: '100%', background: 'var(--accent)', color: 'white',
      border: 'none', padding: '13px', borderRadius: '100px',
      fontSize: '14px', fontWeight: 500, cursor: 'pointer',
      fontFamily: 'DM Sans, sans-serif', marginBottom: '10px',
    }}>
      Activar Pro →
    </button>
    <button onClick={() => setMode('manual')} style={{
      background: 'none', border: 'none',
      color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer',
    }}>
      Registrar manualmente
    </button>
  </div>
)}
```

---

## 5. UPSELL CONTEXTUAL EN DASHBOARD — Después de 7 días

En `Dashboard.jsx`, mostrar UNA SOLA VEZ cuando el usuario lleva 7 días de racha y es Free:

```jsx
// Mostrar solo si: es Free + racha >= 7 + no ha visto este mensaje
const showStreakUpsell = isFree(user.access_level) 
  && streak >= 7 
  && !localStorage.getItem('streak_upsell_seen');

{showStreakUpsell && (
  <div style={{
    background: 'linear-gradient(135deg, var(--surface), var(--bg))',
    border: '1px solid var(--border)',
    borderRadius: '16px', padding: '20px', marginBottom: '16px',
  }}>
    <p style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500, marginBottom: '6px' }}>
      🔥 {streak} días seguidos
    </p>
    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '15px' }}>
      Llevas una semana cuidando tu alimentación
    </strong>
    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
      Desbloquea el análisis completo de tu progreso con Pro.
    </p>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => navigate('/planes')} style={{
        flex: 1, background: 'var(--accent)', color: 'white',
        border: 'none', padding: '10px', borderRadius: '100px',
        fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
      }}>
        Ver mi análisis Pro
      </button>
      <button onClick={() => {
        localStorage.setItem('streak_upsell_seen', 'true');
        setShowStreakUpsell(false);
      }} style={{
        background: 'none', border: '1px solid var(--border)',
        padding: '10px 16px', borderRadius: '100px',
        fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)',
      }}>
        Ahora no
      </button>
    </div>
  </div>
)}
```

---

## 6. PÁGINA DE PLANES — `client/src/pages/Plans.jsx`

Ruta pública `/planes`, accesible sin login pero con CTA de registro si no hay sesión.

```jsx
// Estructura de la página:
// 1. Header: "Elige tu plan"
// 2. Toggle mensual/anual (con descuento anual)
// 3. Dos cards: Free y Pro
// 4. FAQ breve
// 5. Footer con garantías

const Plans = () => {
  const { user } = useAuth();
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'
  
  const price = billing === 'monthly' ? '1.99€' : '1.25€';
  const priceNote = billing === 'monthly' 
    ? 'por mes' 
    : 'por mes · 14.99€/año (ahorra 9€)';

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
      
      {/* Header */}
      <h1 style={{ fontFamily: 'Instrument Serif', fontSize: '36px', 
                   textAlign: 'center', marginBottom: '8px' }}>
        Elige tu plan
      </h1>
      <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', 
                  marginBottom: '32px' }}>
        Sin permanencia · Cancela cuando quieras
      </p>

      {/* Toggle mensual/anual */}
      <div style={{ display: 'flex', justifyContent: 'center', 
                    gap: '8px', marginBottom: '28px' }}>
        {['monthly', 'annual'].map(b => (
          <button key={b} onClick={() => setBilling(b)} style={{
            padding: '8px 20px', borderRadius: '100px',
            background: billing === b ? 'var(--accent)' : 'var(--surface)',
            color: billing === b ? 'white' : 'var(--color-text-secondary)',
            border: billing === b ? 'none' : '1px solid var(--border)',
            fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}>
            {b === 'monthly' ? 'Mensual' : 'Anual · -37%'}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        
        {/* FREE */}
        <div style={{
          border: '1px solid var(--border)', borderRadius: '16px',
          padding: '24px',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            Free
          </p>
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '32px', fontFamily: 'Instrument Serif' }}>0€</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}> /mes</span>
          </div>
          
          {[
            'Registro manual ilimitado',
            'Escáner de productos',
            '3 análisis IA/día',
            'Dashboard completo',
            'Modo oscuro',
            'Suplementos (5 máx)',
            'Racha de días',
            'Historial 30 días',
          ].map(f => (
            <div key={f} style={{ display: 'flex', gap: '8px', marginBottom: '8px',
                                   fontSize: '13px', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent)' }}>✓</span>
              {f}
            </div>
          ))}

          <button disabled style={{
            width: '100%', marginTop: '20px', padding: '12px',
            borderRadius: '100px', border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--color-text-secondary)',
            fontSize: '14px', cursor: 'default',
          }}>
            {user ? 'Plan actual' : 'Gratis para siempre'}
          </button>
        </div>

        {/* PRO */}
        <div style={{
          border: '2px solid var(--accent)', borderRadius: '16px',
          padding: '24px', position: 'relative',
        }}>
          {/* Badge más popular */}
          <div style={{
            position: 'absolute', top: '-12px', left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)', color: 'white',
            fontSize: '11px', fontWeight: 600, padding: '4px 12px',
            borderRadius: '100px', whiteSpace: 'nowrap',
          }}>
            Más popular
          </div>
          
          <p style={{ fontSize: '13px', color: 'var(--accent)', 
                      fontWeight: 500, marginBottom: '4px' }}>
            ∞ Pro
          </p>
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '32px', fontFamily: 'Instrument Serif',
                           color: 'var(--accent)' }}>{price}</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {' '}{priceNote}
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', 
                      marginBottom: '12px', fontStyle: 'italic' }}>
            Todo de Free, más:
          </p>

          {[
            'IA ilimitada',
            'Motor de calibración personal',
            'Análisis avanzado completo',
            'Proyección de peso científica',
            'Historial sin límite',
            'Exportar datos CSV',
            'Suplementos ilimitados',
            'Objetivos de macros',
            'TDEE con composición corporal',
          ].map(f => (
            <div key={f} style={{ display: 'flex', gap: '8px', marginBottom: '8px',
                                   fontSize: '13px', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent)' }}>✓</span>
              <strong>{f}</strong>
            </div>
          ))}

          <button 
            onClick={() => {/* Stripe checkout — próximamente */
              alert('Stripe próximamente — contacta con lucatuille@icloud.com para acceso Pro');
            }}
            style={{
              width: '100%', marginTop: '20px', padding: '13px',
              borderRadius: '100px', border: 'none',
              background: 'var(--accent)', color: 'white',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}>
            Activar Pro →
          </button>
        </div>
      </div>

      {/* Garantías */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px',
                    flexWrap: 'wrap', marginBottom: '32px' }}>
        {[
          '🔒 Pago seguro con Stripe',
          '↩️ 30 días de garantía',
          '✕ Cancela cuando quieras',
        ].map(g => (
          <span key={g} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {g}
          </span>
        ))}
      </div>

      {/* FAQ */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Preguntas frecuentes</h3>
        {[
          {
            q: '¿Puedo cancelar cuando quiera?',
            a: 'Sí. Sin permanencia, sin penalizaciones. Cancelas desde tu perfil o escribiéndonos.'
          },
          {
            q: '¿Los Fundadores (beta testers) tienen que pagar?',
            a: 'No. Los Fundadores tienen acceso Pro completo para siempre como agradecimiento por haber ayudado a construir la app.'
          },
          {
            q: '¿Qué pasa si cancelo?',
            a: 'Pasas al plan Free. Tus datos se conservan, solo se limitan algunas features.'
          },
          {
            q: '¿Hay plan anual?',
            a: 'Sí, 14.99€/año — equivale a 1.25€/mes, ahorras 9€ respecto al mensual.'
          },
        ].map(({ q, a }) => (
          <div key={q} style={{ marginBottom: '16px' }}>
            <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>{q}</strong>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{a}</p>
          </div>
        ))}
      </div>

    </div>
  );
};
```

---

## 7. NAVBAR — Link a planes

En `Navbar.jsx`, añadir link sutil para usuarios Free:

```jsx
{isFree(user?.access_level) && (
  <Link to="/planes" style={{
    fontSize: '13px',
    color: 'var(--accent)',
    fontWeight: 500,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  }}>
    ∞ Pro
  </Link>
)}
```

---

## 8. ANIMACIÓN CSS GLOBAL

Añadir en `global.css`:

```css
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

@keyframes slideDown {
  from { transform: translateY(0);    opacity: 1; }
  to   { transform: translateY(100%); opacity: 0; }
}

/* Shimmer para placeholder de contenido bloqueado */
@keyframes shimmer {
  0%   { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
```

---

## 9. SEGURIDAD ADICIONAL EN EL WORKER

### Rate limiting en endpoints sensibles:
```js
// En analyze-photo y analyze-text — verificación doble
// 1. JWT dice que es Pro → OK superficialmente
// 2. PERO siempre verificar en BD antes de procesar
// Si JWT y BD no coinciden → usar el de BD (más restrictivo)

const jwtLevel = request.user.access_level;
const dbUser = await env.DB.prepare(
  'SELECT access_level FROM users WHERE id = ?'
).bind(request.user.id).first();

// Usar SIEMPRE el nivel de la BD
const actualLevel = dbUser?.access_level ?? 3;

if (actualLevel !== jwtLevel) {
  // El JWT está desactualizado o manipulado
  // Continuar con el nivel de la BD sin error
  // (puede ser legítimo si el nivel cambió recientemente)
  request.user.access_level = actualLevel;
}
```

### No exponer datos de otros usuarios en historial extendido:
```js
// En GET /api/entries con días > 30
// Verificar que user_id del query = user_id del JWT
// (ya debería estar, pero verificar explícitamente)
const entries = await env.DB.prepare(
  'SELECT * FROM entries WHERE user_id = ? AND date >= ? ORDER BY date DESC'
).bind(request.user.id, startDate).all(); // SIEMPRE filtrar por user_id
```

---

## 10. ORDEN DE IMPLEMENTACIÓN

1. Crear `client/src/utils/proAccess.js`
2. Crear `client/src/components/ProLock.jsx`
3. Añadir animaciones en `global.css`
4. Aplicar locks en `Progress.jsx` (análisis avanzado)
5. Aplicar locks en `Profile.jsx` (calibración, CSV, macros)
6. Aplicar locks en `SupplementTracker.jsx` (límite 5)
7. Actualizar mensaje límite IA en `AddEntryForm.jsx`
8. Añadir upsell de racha en `Dashboard.jsx`
9. Crear `client/src/pages/Plans.jsx`
10. Añadir ruta `/planes` en `App.jsx` (pública, sin auth requerida)
11. Añadir link Pro en `Navbar.jsx` para usuarios Free
12. Actualizar Worker — verificación doble de access_level desde BD
13. Desplegar Worker: `cd worker && npm run deploy`

---

## 11. AL FINALIZAR

**Tests de seguridad — verificar manualmente:**
- Modificar el JWT en localStorage y poner `access_level: 2` siendo Free
- Intentar llamar a `/api/progress/advanced` con ese JWT manipulado
- Debe devolver 403 porque el Worker verifica en BD

**Tests de UX:**
- Usuario Free: ver locks en análisis avanzado, calibración, CSV
- Usuario Free: llegar al límite de 3 IA y ver el mensaje correcto
- Usuario Free: tocar cualquier lock → bottom sheet de upsell
- Usuario Pro/Fundador: no ver ningún lock en ningún sitio
- Página /planes accesible sin login

**Tests de compatibilidad:**
- Fundadores (level 1): no ven locks, no ven el link Pro en navbar
- Admins (level 99): no ven locks, no ven el link Pro en navbar
- Free (level 3): ven todos los locks y el link Pro

`git add . && git commit -m "feat: sistema freemium completo con locks, planes y seguridad" && git push`
