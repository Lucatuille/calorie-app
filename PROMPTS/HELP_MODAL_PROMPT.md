# Implementación: Modal de Ayuda Interactivo — Caliro

## Contexto del proyecto

Caliro es una PWA de nutrición con IA construida en React 18 + Vite. El sistema de diseño se llama "Sistema C":
- Fondo: `var(--cream)` = `#F5F2EE`
- Cards: blancas con `box-shadow: var(--shadow-md)` y `border: 0.5px solid var(--border)`
- Acento principal: `var(--accent)` = `#22c55e` (verde)
- Tipografía display: `Instrument Serif` (italic para énfasis)
- Tipografía cuerpo: `DM Sans`
- Border radius cards: `var(--radius-lg)` = `14-16px`
- Border radius pills: `var(--radius-full)` = `9999px`

---

## Qué hay que construir

Un **modal de ayuda interactivo** accesible desde un botón `?` siempre visible en la app. El modal contiene 6 páginas, cada una con una demo interactiva simulada (datos ficticios, sin llamadas a la API) que enseña al usuario cómo usar cada feature de Caliro.

El objetivo es un "showroom" del producto — el usuario nuevo ve exactamente cómo se verá la app cuando tenga datos reales.

---

## Archivo a crear

**Ruta:** `client/src/components/HelpModal.jsx`

Es un componente React independiente. No modifica ningún componente existente excepto añadir el botón `?` y el `<HelpModal>` en el layout principal.

---

## Parte 1: El botón de apertura

Añadir en el componente de layout principal (probablemente `App.jsx` o el nav) un botón circular fijo:

```jsx
// Botón siempre visible, esquina superior derecha del área de contenido
// NO fixed a la ventana — relativo al contenedor de la app
<button
  onClick={() => setHelpOpen(true)}
  aria-label="Abrir guía de Caliro"
  style={{
    position: 'fixed',
    top: '16px',
    right: '16px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.06)',
    border: '0.5px solid rgba(0,0,0,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    zIndex: 90,
    transition: 'background 0.2s',
  }}
>
  ?
</button>
```

El botón abre el modal. No se muestra cuando el modal está abierto. No se muestra en las páginas de onboarding o login.

---

## Parte 2: Estructura del modal

El modal es un **bottom sheet** que cubre el 92% de la pantalla. Se abre desde abajo con animación slide-up.

```jsx
// Estructura del modal
<div style={overlayStyle}>                    // fondo oscuro semitransparente
  <div style={sheetStyle}>                    // el sheet blanco
    <div style={headerStyle}>                 // cabecera fija con título y X
      <span>{pages[currentPage].title}</span>
      <button onClick={onClose}>✕</button>
    </div>
    <div style={bodyStyle}>                   // contenido scrollable
      {pages[currentPage].component}
    </div>
    <div style={footerStyle}>                 // navegación fija abajo
      <button onClick={prev}>← Anterior</button>
      <Dots current={currentPage} total={6} />
      <button onClick={next}>
        {currentPage === 5 ? 'Cerrar' : 'Siguiente →'}
      </button>
    </div>
  </div>
</div>
```

**Estilos del overlay:**
```js
{
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'flex-end',
}
```

**Estilos del sheet:**
```js
{
  background: 'white',
  borderRadius: '20px 20px 0 0',
  width: '100%',
  height: '92dvh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}
```

**Header:**
```js
{
  padding: '16px 20px',
  borderBottom: '0.5px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
}
// Título: font-family Instrument Serif, 18px
// Botón X: círculo 26px, background var(--surface-2), border var(--border)
```

**Body:**
```js
{
  flex: 1,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
}
```

**Footer:**
```js
{
  padding: '12px 20px',
  borderTop: '0.5px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
  background: 'white',
}
```

**Dots navigation:**
```jsx
// Dots: píldoras horizontales, la activa es más ancha
{Array.from({length: total}).map((_, i) => (
  <div
    key={i}
    onClick={() => setCurrentPage(i)}
    style={{
      width: i === current ? '16px' : '6px',
      height: '6px',
      borderRadius: '3px',
      background: i === current ? '#111' : '#ddd',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
  />
))}
```

**Botón Anterior:**
```js
// padding: '8px 14px', borderRadius: '10px'
// border: '0.5px solid var(--border)', background: 'none'
// color: var(--text-secondary), fontSize: '13px'
// Deshabilitado (opacity 0.3, pointerEvents none) en página 0
```

**Botón Siguiente / Cerrar:**
```js
// padding: '8px 14px', borderRadius: '10px'
// border: 'none', background: '#111', color: 'white', fontSize: '13px'
// En página 5 dice "Cerrar" y llama onClose
```

---

## Parte 3: Las 6 páginas

Cada página tiene esta estructura interna:

```
[Hero banner de color]     — fondo de color suave, número grande + título + subtítulo
[Demo interactiva]         — simulación de la UI real, completamente funcional
[Pro tips o info extra]    — contenido adicional específico de cada página
[Tip strip]               — franja verde con consejo final
```

Usa el archivo `HELP_MODAL_CONTENT.md` para el contenido exacto de cada página.

### Componentes compartidos reutilizables

```jsx
// HeroBanner — el banner de color en la parte superior de cada página
const HeroBanner = ({ num, title, subtitle, color, textColor }) => (
  <div style={{
    background: color,
    borderRadius: '14px',
    padding: '24px 20px',
    margin: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
  }}>
    <div style={{
      fontSize: '52px',
      fontFamily: 'Instrument Serif',
      color: textColor,
      opacity: 0.15,
      lineHeight: 1,
      marginBottom: '4px',
    }}>{num}</div>
    <div style={{
      fontSize: '22px',
      fontFamily: 'Instrument Serif',
      color: textColor,
      marginBottom: '4px',
    }}>{title}</div>
    <div style={{ fontSize: '13px', color: textColor, opacity: 0.7 }}>{subtitle}</div>
  </div>
);

// DemoBox — contenedor gris que envuelve cada demo
const DemoBox = ({ label, children }) => (
  <div style={{ margin: '0 18px 14px' }}>
    {label && (
      <div style={{
        fontSize: '10px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        marginBottom: '8px',
        fontWeight: 500,
      }}>{label}</div>
    )}
    <div style={{
      background: '#F5F2EE',
      borderRadius: '14px',
      padding: '14px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        border: '0.5px solid var(--border)',
        padding: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
      }}>
        {children}
      </div>
    </div>
  </div>
);

// TipStrip — franja verde al final de cada página
const TipStrip = ({ text }) => (
  <div style={{
    background: '#f0fdf4',
    borderLeft: '2px solid #22c55e',
    borderRadius: '0 8px 8px 0',
    padding: '10px 14px',
    margin: '0 18px 20px',
    fontSize: '12px',
    color: '#555',
    lineHeight: 1.55,
  }}>
    <strong style={{ color: '#111' }}>Consejo — </strong>{text}
  </div>
);

// IntroText — párrafo introductorio de cada página
const IntroText = ({ children }) => (
  <p style={{
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 18px 14px',
  }}>{children}</p>
);

// StepCard — una fila de paso numerado
const StepCard = ({ num, title, body, accentColor, accentBg }) => (
  <div style={{
    background: 'white',
    border: '0.5px solid var(--border)',
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '8px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  }}>
    <div style={{
      width: '26px', height: '26px',
      borderRadius: '50%',
      background: accentBg,
      color: accentColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: 500,
      flexShrink: 0,
      fontFamily: 'Instrument Serif',
    }}>{num}</div>
    <div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '3px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{body}</div>
    </div>
  </div>
);
```

---

### Página 1: Registrar comidas

**Estado local:**
```js
const [selectedMethod, setSelectedMethod] = useState(0);
```

**Demo — tres botones de método:**

Los tres botones tienen este comportamiento: al pulsar uno, se pone activo (borde verde, fondo verde claro) y los demás vuelven a inactivo (fondo blanco, borde gris).

```jsx
const methods = [
  {
    icon: '📷',
    label: 'Foto IA',
    desc: 'Haz una foto al plato. La IA reconoce comida española real — tortilla, bocadillos, paella — y devuelve calorías y macros en segundos. Añade texto descriptivo para mayor precisión.',
  },
  {
    icon: '≡',
    label: 'Escanear',
    desc: 'Para productos envasados. Apunta la cámara al código de barras y obtén los datos nutricionales exactos del fabricante. La opción más precisa — 100% exacto.',
  },
  {
    icon: '✏',
    label: 'Describir',
    desc: 'Escribe lo que comiste en texto libre. «Dos huevos fritos con jamón serrano» funciona perfectamente. Cuanto más específico, más precisa la estimación.',
  },
];
```

Debajo de los botones, mostrar el `desc` del método seleccionado en un recuadro redondeado de fondo `#F5F2EE`.

**Pro tips — tres pills expandibles:**

Debajo de la demo, tres pills colapsables. Al tocar uno se expande mostrando el contenido. Solo uno abierto a la vez.

```js
const proTips = [
  {
    icon: '📷',
    label: 'Foto IA: más contexto = más precisión',
    body: 'Añade texto a la foto describiendo lo que ves: «pollo a la plancha con arroz blanco, ración mediana». Combinar foto + descripción puede mejorar la estimación hasta un 30% respecto a solo la imagen.',
  },
  {
    icon: '✏',
    label: 'Descripción: sé específico',
    body: '«Pasta boloñesa casera con carne picada, plato grande» es 3 veces más preciso que «pasta». La diferencia entre una descripción vaga y una específica puede ser de 150-200 kcal.',
  },
  {
    icon: '≡',
    label: 'Envasados: siempre el escáner',
    body: 'Para cualquier producto con código de barras (yogures, proteínas, snacks, conservas) usa siempre el escáner en lugar de la foto o el texto. Es el único método con precisión del 100%.',
  },
];
```

Cada pill: fondo `var(--surface-2)`, borde `var(--border)`, border-radius `10px`, padding `10px 14px`. Flecha `▼`/`▲` a la derecha. Cuando se expande, el cuerpo aparece debajo con `fontSize: 12px, color: var(--text-secondary)`.

**Tip strip:**
"Corrige las estimaciones si no son exactas — el motor de calibración aprende de cada corrección que hagas y mejora con el tiempo."

---

### Página 2: Motor de calibración

**Estado local:**
```js
const [corrections, setCorrections] = useState(0); // 0-20
```

**Demo — slider de correcciones:**

Un slider de 0 a 20. A medida que aumenta el valor, los datos de la demo cambian progresivamente.

Datos ficticios que cambian con el slider:

```js
// Calcular a partir del valor del slider (v = 0-20):
const conf1 = Math.min(95, 40 + v * 2.5);   // Tortilla española
const conf2 = Math.min(92, 35 + v * 2.8);   // Pasta boloñesa  
const global = Math.min(92, 30 + v * 3.1);  // Precisión global

// Estimaciones que se afinan:
const est1 = v > 10 ? '358 kcal' : v > 5 ? '368 kcal' : '~385 kcal';
const est2 = v > 10 ? '492 kcal' : v > 5 ? '508 kcal' : '~525 kcal';
```

Mostrar:
- Barra de slider con etiqueta "Correcciones realizadas: X"
- Dos filas de comida (Tortilla española / Pasta boloñesa) con la estimación y el % de confianza en verde
- Barra de progreso "Precisión global del motor" con el porcentaje

**Mapa de categorías:**

Debajo de la demo, una sección fija (no cambia con el slider) que explica que el motor aprende por categorías:

```jsx
// Título: "El motor aprende por categorías"
// Subtítulo pequeño: "Corregir tortilla mejora huevos y frituras — no la pasta"

const categories = [
  { name: 'Huevos y tortillas', pct: 78, color: '#fef3c7' },
  { name: 'Carnes y pescados', pct: 65, color: '#dcfce7' },
  { name: 'Pasta y arroces', pct: 32, color: '#e0f2fe' },
  { name: 'Verduras y ensaladas', pct: 45, color: '#fce7f3' },
];
```

Cada categoría: nombre + barra de progreso pequeña con el porcentaje ficticio. Fondo del color de la categoría, border-radius `8px`, padding `8px 10px`.

**Tip strip:**
"La pasta y el arroz tienden a subestimarse visualmente. Corrígelos las primeras veces para calibrar esas categorías rápidamente."

---

### Página 3: Asistente personal

**Estado local:**
```js
const [selectedQ, setSelectedQ] = useState(0);
```

**Demo — 4 preguntas como pills:**

Cuatro pills horizontales scrollables. Al tocar uno, se pone activo (fondo `#111`, texto blanco) y los demás vuelven a inactivo.

```js
const questions = [
  {
    label: '¿Cómo voy hoy?',
    reply: 'Llevas <b>620 kcal</b> — te quedan <b style="color:#22c55e">1.192 kcal</b> y <b>114g de proteína</b> para hoy. Vas bien en carbohidratos y grasa, pero el déficit de proteína es alto. Intenta que la cena tenga al menos 40g de proteína.',
  },
  {
    label: '¿Qué debería cenar?',
    reply: 'Con 1.192 kcal libres y 114g de proteína pendientes, lo ideal sería <b>pechuga de pollo con arroz</b> (~480 kcal, 45g prot). Te dejaría margen para un snack de ~200 kcal antes de dormir.',
  },
  {
    label: 'Mis patrones',
    reply: 'Tus <b>viernes son tus mejores días</b> — sueles estar en objetivo. Los <b>fines de semana</b> tu ingesta sube de media 380 kcal respecto a entre semana. El déficit de proteína es consistente: promedio 82g/día vs 136g objetivo.',
  },
  {
    label: '¿Por qué no bajo de peso?',
    reply: 'Tu adherencia esta semana fue del <b>57%</b> — 4 de 7 días en déficit real. Los días que te pasas del objetivo lo haces de media <b>+420 kcal</b>, lo que compensa casi todo el déficit de los otros días. La solución no es comer menos — es ser más consistente.',
  },
];
```

La respuesta se muestra como un chat bubble: fondo blanco, borde `var(--border)`, border-radius `12px 12px 12px 3px`, padding `10px 12px`, `fontSize: 12px`. El HTML de la respuesta se renderiza con `dangerouslySetInnerHTML`.

Debajo del bubble, un texto pequeño en gris:
"El asistente tiene acceso a tu historial completo — responde con tus datos reales, no con consejos genéricos."

**Tip strip:**
"Cuanto más específica la pregunta, mejor la respuesta. «¿Qué debería cenar para llegar a mi objetivo de proteína hoy?» es mejor que «¿qué ceno?»"

---

### Página 4: Historial

**Estado local:**
```js
const [addingFor, setAddingFor] = useState(null); // null | 'hoy' | 'ayer' | 'miércoles'
```

**Demo — lista de días:**

```js
const days = [
  {
    key: 'hoy',
    label: 'Hoy · Viernes',
    kcal: 620,
    target: 1812,
    foods: 'Arroz japonés · Sopa miso',
  },
  {
    key: 'ayer',
    label: 'Ayer · Jueves',
    kcal: 1654,
    target: 1812,
    foods: 'Pollo · Ensalada · Bocadillo',
  },
  {
    key: 'miércoles',
    label: 'Miércoles',
    kcal: 1820,
    target: 1812,
    foods: 'Tortilla · Pasta · Plátano',
  },
];
```

Cada día: nombre a la izquierda, kcal + botón `+` verde a la derecha, barra de progreso debajo, nombre de comidas en gris pequeño. Si `kcal > target`, la barra y el número son rojos (`#ef4444`), si no, verdes (`#22c55e`).

Al pulsar el `+` de cualquier día: mostrar un toast/mensaje pequeño dentro de la demo box: "Añadiendo comida para [día]..." en verde durante 2 segundos, luego desaparece.

**Bloque de caso de uso:**

Debajo de la demo, una card explicativa (sin demo interactiva):

```
Título: "¿Comiste fuera sin el móvil?"
Cuerpo: "Regístralo cuando llegues a casa tocando el «+» del día correspondiente. 
El asistente sabrá lo que comiste ese día y sus recomendaciones del día siguiente 
serán más precisas."
```

Card: fondo `var(--surface-2)`, border-radius `12px`, padding `14px`, borde `var(--border)`. Icono de restaurante o tenedor a la izquierda.

**Tip strip:**
"Puedes añadir comidas a cualquier día de los últimos 30 días. Cuanto más completo sea tu historial, mejores las recomendaciones del asistente."

---

### Página 5: Progreso

**Demo — dos métricas + gráfica de peso:**

Dos cards de métricas ficticias:
```
Card 1: "Adherencia" / "5/7" en Instrument Serif verde / "días en objetivo esta semana"
Card 2: "Proyección" / "−0.4 kg" en Instrument Serif / "esta semana"
```

Gráfica de peso (SVG estático, no interactiva): línea verde descendente suave, 7 puntos, del día 1 al 7. Valores ficticios: 70.8 → 70.5 → 70.7 → 70.4 → 70.2 → 70.0 → 69.8. Eje X con etiquetas L M X J V S D. Eje Y implícito.

**Bloque explicativo de la fluctuación:**

Card explicativa debajo de la demo:

```
Título: "¿Por qué la proyección fluctúa?"
Cuerpo: "El modelo es honesto — el peso real varía ±1 kg cada día por retención de agua, 
glucógeno muscular y digestión. Si un día la proyección sube, no es un fallo. 
Lo que importa es la tendencia de la semana, no el dato diario."
```

Misma card que la de historial (fondo `var(--surface-2)`).

**Bloque de peso corporal:**

Tercera card:
```
Título: "Registrar peso cada mañana"
Cuerpo: "Toca el pill de peso en el Dashboard cada mañana antes de comer. 
Con datos de peso consistentes, la proyección de Progreso es mucho más precisa."
```

**Tip strip:**
"Mira la tendencia semanal, no el número de cada día. Una bajada real de 0.5 kg a la semana es excelente aunque el día a día fluctúe."

---

### Página 6: Suplementos

**Estado local:**
```js
const [taken, setTaken] = useState({ creatina: false, omega3: false, vitd: false });
```

**Demo — tres suplementos tappables:**

```js
const sups = [
  { key: 'creatina', icon: '💪', name: 'Creatina' },
  { key: 'omega3',   icon: '🐟', name: 'Omega 3' },
  { key: 'vitd',     icon: '☀️', name: 'Vitamina D' },
];
```

Cada suplemento: card cuadrada, icono grande centrado, nombre debajo. Al tocar: borde verde `1.5px solid #22c55e`, fondo `#dcfce7`. Al tocar de nuevo: vuelve al estado inactivo (fondo `#F5F2EE`, sin borde).

Encima de los tres cards: contador "X/3 tomados hoy" que se actualiza al tocar.

**Bloque explicativo:**

Card debajo de la demo:
```
Título: "Añádelos una vez, aparecen solos"
Cuerpo: "Ve al Perfil → Suplementos para configurar los que tomas habitualmente. 
A partir de ahí aparecen en el Dashboard cada día automáticamente — 
sin tener que configurarlos de nuevo."
```

**Tip strip:**
"El asistente sabe qué suplementos has tomado hoy. Si le preguntas sobre proteína o recuperación, tiene ese contexto."

---

## Parte 4: Animación de entrada

El sheet debe entrar con una animación slide-up suave:

```css
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
```

Aplicar al sheet: `animation: slideUp 0.3s ease`.

El overlay (fondo oscuro) debe tener `transition: opacity 0.3s` al aparecer.

Al cerrar: idealmente slide-down, pero si es complejo simplemente `display: none` inmediato — no bloquear el resto de la implementación por esto.

---

## Parte 5: Integración en el proyecto

1. Crear `client/src/components/HelpModal.jsx` con todo el código.

2. En el componente de layout o `App.jsx`, añadir:
```jsx
import HelpModal from './components/HelpModal';

// En el estado:
const [helpOpen, setHelpOpen] = useState(false);

// En el render, fuera de cualquier route (siempre visible):
{helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

// El botón ?:
{!helpOpen && (
  <button
    onClick={() => setHelpOpen(true)}
    aria-label="Abrir guía"
    // estilos del botón ? definidos arriba
  >?</button>
)}
```

3. NO añadir llamadas a la API. Todos los datos son ficticios y estáticos/locales.

4. NO modificar ningún componente existente excepto `App.jsx` para añadir el botón y el modal.

---

## Parte 6: Checklist antes de entregar

- [ ] El botón `?` es visible en todas las páginas de la app excepto login/onboarding
- [ ] El modal se abre con animación slide-up
- [ ] Las 6 páginas son navegables con Anterior/Siguiente y con los dots
- [ ] En la última página el botón dice "Cerrar" y cierra el modal
- [ ] Página 1: los 3 botones de método son tappables y cambian la descripción
- [ ] Página 1: los 3 pro tips son expandibles, solo uno abierto a la vez
- [ ] Página 2: el slider actualiza en tiempo real los porcentajes y estimaciones
- [ ] Página 3: los 4 pills de pregunta son tappables y cambian el chat bubble
- [ ] Página 4: el `+` de cada día muestra el toast y desaparece
- [ ] Página 5: la gráfica SVG se muestra correctamente
- [ ] Página 6: los suplementos son tappables y el contador se actualiza
- [ ] El modal cierra con el botón X y con el botón Cerrar de la última página
- [ ] No hay llamadas a la API en ninguna parte del componente
- [ ] El componente usa el Sistema C (colores, tipografía, border-radius)
