# HELP_MODAL_CONTENT.md — Contenido de referencia

Este archivo contiene todo el contenido textual del modal de ayuda.
Úsalo como referencia para copiar textos exactos al implementar HelpModal.jsx.

---

## Estructura de cada página

```
título           → aparece en el header fijo del modal
heroBanner       → número grande + título + subtítulo con color de fondo
introText        → párrafo introductorio debajo del banner
demo             → ver HELP_MODAL_PROMPT.md para la lógica interactiva
extra            → contenido adicional específico de la página
tipStrip         → consejo final en franja verde
```

---

## Página 1 — Registrar comidas

```
título:    "Registrar comidas"
heroBanner:
  num:      "01"
  title:    "Registrar"
  subtitle: "Foto, escáner o texto libre"
  color:    "#dcfce7"
  textColor: "#15803d"

introText:
  "Tres formas de añadir lo que comes. Cada una tiene su caso de uso ideal.
   Toca cada método para ver cuándo usarlo."

demo:
  método 0 — Foto IA:
    desc: "Haz una foto al plato. La IA reconoce comida española real — tortilla,
           bocadillos, paella — y devuelve calorías y macros en segundos. Añade
           texto descriptivo para mayor precisión."

  método 1 — Escanear:
    desc: "Para productos envasados. Apunta la cámara al código de barras y obtén
           los datos nutricionales exactos del fabricante. La opción más precisa
           — 100% exacto."

  método 2 — Describir:
    desc: "Escribe lo que comiste en texto libre. «Dos huevos fritos con jamón
           serrano» funciona perfectamente. Cuanto más específico, más precisa
           la estimación."

proTips:
  tip 0:
    icon: "📷"
    label: "Foto IA: más contexto = más precisión"
    body:  "Añade texto a la foto describiendo lo que ves: «pollo a la plancha con
            arroz blanco, ración mediana». Combinar foto + descripción puede mejorar
            la estimación hasta un 30% respecto a solo la imagen."

  tip 1:
    icon: "✏"
    label: "Descripción: sé específico"
    body:  "«Pasta boloñesa casera con carne picada, plato grande» es 3 veces más
            preciso que «pasta». La diferencia entre una descripción vaga y una
            específica puede ser de 150-200 kcal."

  tip 2:
    icon: "≡"
    label: "Envasados: siempre el escáner"
    body:  "Para cualquier producto con código de barras (yogures, proteínas, snacks,
            conservas) usa siempre el escáner en lugar de la foto o el texto. Es el
            único método con precisión del 100%."

tipStrip:
  "Corrige las estimaciones si no son exactas — el motor de calibración aprende de
   cada corrección que hagas y mejora con el tiempo."
```

---

## Página 2 — Motor de calibración

```
título:    "Motor de calibración"
heroBanner:
  num:      "02"
  title:    "Calibración"
  subtitle: "La IA que aprende cómo comes tú"
  color:    "#ede9fe"
  textColor: "#5b21b6"

introText:
  "La IA aprende de cada corrección que haces. Arrastra el slider para ver cómo
   mejora la precisión del motor a medida que lo usas."

demo:
  slider: 0-20 correcciones realizadas
  datos que cambian (ver fórmulas en HELP_MODAL_PROMPT.md)
  comidas ficticias: Tortilla española / Pasta boloñesa
  barra de "Precisión global del motor"

sección categorías:
  título:    "El motor aprende por categorías"
  subtítulo: "Corregir tortilla mejora huevos y frituras — no la pasta"
  categorías (ficticias):
    - Huevos y tortillas  → 78%  → color fondo: #fef3c7
    - Carnes y pescados   → 65%  → color fondo: #dcfce7
    - Pasta y arroces     → 32%  → color fondo: #e0f2fe
    - Verduras y ensaladas → 45% → color fondo: #fce7f3

tipStrip:
  "La pasta y el arroz tienden a subestimarse visualmente. Corrígelos las primeras
   veces para calibrar esas categorías rápidamente."
```

---

## Página 3 — Asistente personal

```
título:    "Asistente personal"
heroBanner:
  num:      "03"
  title:    "Asistente"
  subtitle: "No es un chatbot genérico"
  color:    "#fef3c7"
  textColor: "#92400e"

introText:
  "El asistente tiene acceso a tu historial completo y responde con tus datos
   reales. Toca una pregunta para ver cómo responde."

demo:
  pregunta 0 — "¿Cómo voy hoy?":
    reply: "Llevas <b>620 kcal</b> — te quedan <b style='color:#22c55e'>1.192 kcal</b>
            y <b>114g de proteína</b> para hoy. Vas bien en carbohidratos y grasa,
            pero el déficit de proteína es alto. Intenta que la cena tenga al menos
            40g de proteína."

  pregunta 1 — "¿Qué debería cenar?":
    reply: "Con 1.192 kcal libres y 114g de proteína pendientes, lo ideal sería
            <b>pechuga de pollo con arroz</b> (~480 kcal, 45g prot). Te dejaría
            margen para un snack de ~200 kcal antes de dormir."

  pregunta 2 — "Mis patrones":
    reply: "Tus <b>viernes son tus mejores días</b> — sueles estar en objetivo.
            Los <b>fines de semana</b> tu ingesta sube de media 380 kcal respecto
            a entre semana. El déficit de proteína es consistente: promedio 82g/día
            vs 136g objetivo."

  pregunta 3 — "¿Por qué no bajo de peso?":
    reply: "Tu adherencia esta semana fue del <b>57%</b> — 4 de 7 días en déficit
            real. Los días que te pasas del objetivo lo haces de media <b>+420 kcal</b>,
            lo que compensa casi todo el déficit de los otros días. La solución no
            es comer menos — es ser más consistente."

texto bajo la demo:
  "El asistente tiene acceso a tu historial completo — responde con tus datos
   reales, no con consejos genéricos."
  fontSize: 12px, color: var(--text-secondary), margin: 0 18px 14px

tipStrip:
  "Cuanto más específica la pregunta, mejor la respuesta. «¿Qué debería cenar para
   llegar a mi objetivo de proteína hoy?» es mejor que «¿qué ceno?»"
```

---

## Página 4 — Historial

```
título:    "Historial"
heroBanner:
  num:      "04"
  title:    "Historial"
  subtitle: "Edita cualquier día anterior"
  color:    "#fce7f3"
  textColor: "#9d174d"

introText:
  "Añade comidas a días anteriores o edita entradas existentes. Toca el «+»
   de cualquier día para probarlo."

demo:
  días ficticios:
    día 0: label "Hoy · Viernes",   kcal 620,  target 1812, foods "Arroz japonés · Sopa miso"
    día 1: label "Ayer · Jueves",   kcal 1654, target 1812, foods "Pollo · Ensalada · Bocadillo"
    día 2: label "Miércoles",       kcal 1820, target 1812, foods "Tortilla · Pasta · Plátano"

  color barra/número:
    kcal <= target → #22c55e (verde)
    kcal > target  → #ef4444 (rojo)

  al pulsar +: toast "Añadiendo comida para [día]..." en verde, desaparece en 2s

card caso de uso:
  icono:  🍽  (o restaurante/tenedor)
  título: "¿Comiste fuera sin el móvil?"
  cuerpo: "Regístralo cuando llegues a casa tocando el «+» del día correspondiente.
           El asistente sabrá lo que comiste ese día y sus recomendaciones del día
           siguiente serán más precisas."

tipStrip:
  "Puedes añadir comidas a cualquier día de los últimos 30 días. Cuanto más completo
   sea tu historial, mejores las recomendaciones del asistente."
```

---

## Página 5 — Progreso

```
título:    "Progreso"
heroBanner:
  num:      "05"
  title:    "Progreso"
  subtitle: "Tu evolución real"
  color:    "#e0f2fe"
  textColor: "#0369a1"

introText:
  "Visualiza tu adherencia, proyección de peso y tendencia corporal. Los datos
   son más útiles cuanto más consistente sea tu registro diario."

demo:
  card 1: label "Adherencia"  / valor "5/7" (Instrument Serif, verde) / sub "días en objetivo"
  card 2: label "Proyección"  / valor "−0.4 kg" (Instrument Serif, #111) / sub "esta semana"

  gráfica SVG (estática, no interactiva):
    7 puntos de peso ficticio: 70.8 → 70.5 → 70.7 → 70.4 → 70.2 → 70.0 → 69.8
    línea verde #22c55e, stroke-width 2, stroke-linecap round, stroke-linejoin round
    eje X: L M X J V S D (fontSize 8, color #aaa)
    último punto: círculo relleno verde + etiqueta "69.8"
    sin eje Y visible — solo la línea

card fluctuación:
  icono:  📊
  título: "¿Por qué la proyección fluctúa?"
  cuerpo: "El modelo es honesto — el peso real varía ±1 kg cada día por retención
           de agua, glucógeno muscular y digestión. Si un día la proyección sube,
           no es un fallo. Lo que importa es la tendencia de la semana, no el
           dato diario."

card peso:
  icono:  ⚖
  título: "Registrar peso cada mañana"
  cuerpo: "Toca el pill de peso en el Dashboard cada mañana antes de comer.
           Con datos consistentes, la proyección de Progreso es mucho más precisa."

tipStrip:
  "Mira la tendencia semanal, no el número de cada día. Una bajada real de 0.5 kg
   a la semana es excelente aunque el día a día fluctúe."
```

---

## Página 6 — Suplementos

```
título:    "Suplementos"
heroBanner:
  num:      "06"
  title:    "Suplementos"
  subtitle: "Seguimiento diario automático"
  color:    "#f0fdf4"
  textColor: "#166534"

introText:
  "Añádelos una vez en el Perfil y aparecen solos cada día. Toca cada uno para
   marcarlo como tomado — el asistente tiene ese contexto."

demo:
  contador arriba: "X/3 tomados hoy" — se actualiza al tocar
  suplementos:
    { key: 'creatina', icon: '💪', name: 'Creatina' }
    { key: 'omega3',   icon: '🐟', name: 'Omega 3' }
    { key: 'vitd',     icon: '☀️', name: 'Vitamina D' }

  estado inactivo: fondo #F5F2EE, sin borde de color
  estado activo:   fondo #dcfce7, borde 1.5px solid #22c55e

card explicativa:
  icono:  ⚙
  título: "Añádelos una vez, aparecen solos"
  cuerpo: "Ve al Perfil → Suplementos para configurar los que tomas habitualmente.
           A partir de ahí aparecen en el Dashboard cada día automáticamente —
           sin tener que configurarlos de nuevo."

tipStrip:
  "El asistente sabe qué suplementos has tomado hoy. Si le preguntas sobre proteína
   o recuperación, tiene ese contexto."
```

---

## Colores de referencia del Sistema C

```
--cream:          #F5F2EE   (fondo global)
--white:          #FFFFFF   (fondo cards)
--dark:           #111111   (texto primario, botones)
--mid:            #888888   (texto secundario)
--light:          #E8E4DE   (bordes, separadores)
--green:          #22c55e   (acento principal)
--green-dark:     #16a34a   (hover verde)
--green-subtle:   #dcfce7   (fondo verde claro)
--green-xsubt:    #f0fdf4   (fondo verde muy claro)
--serif:          'Instrument Serif', Georgia, serif
--sans:           'DM Sans', sans-serif
--radius-sm:      8px
--radius-md:      10px
--radius-lg:      14px
--radius-full:    9999px
--shadow-md:      0 4px 12px rgba(0,0,0,0.08)
```

---

## Notas de implementación

1. **Sin API calls.** Todo el componente usa useState local y datos ficticios hardcodeados.

2. **dangerouslySetInnerHTML** solo en las respuestas del asistente (página 3) donde hay HTML con `<b>` y colores inline. En el resto del componente usar JSX normal.

3. **Scroll.** El body del modal tiene `overflowY: auto`. Cada página puede ser más larga que la pantalla — eso es correcto, el usuario hace scroll dentro del modal.

4. **Mobile first.** Todo está diseñado para 375px de ancho mínimo. No hay layout de dos columnas en ninguna parte del modal.

5. **Sin librerías externas.** El componente usa solo React hooks (useState) y CSS inline. No añadir dependencias nuevas.

6. **El botón ?** debe estar en `z-index: 90` para no quedar por encima del modal (`z-index: 100`) ni del nav de la app.

7. **Reset de página.** Cuando el modal se abre, siempre empieza en la página 0 (Registrar). El estado de cada demo (slider, método seleccionado, etc.) se resetea al cambiar de página.
```
