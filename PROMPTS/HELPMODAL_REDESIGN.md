# HelpModal — rediseño parcial

**Estado:** decisiones cerradas, pendiente implementación.
**Fecha decisión:** 2026-05-07.
**Archivo afectado:** `client/src/components/HelpModal.jsx` (~1167 líneas).

---

## Estado actual

HelpModal tiene 6 páginas, accesible vía botón "?" en navbar. Cada página con estructura consistente: HeroBanner + IntroText + DemoBox interactivo + acordeones/widgets + TipStrip. Demos son interactivas en vivo, no screenshots estáticos.

| # | Página | Estado |
|---|--------|--------|
| 1 | Registrar comidas (foto/escáner/texto) | Sólida — demos buenas |
| 2 | Motor de calibración | Excepcional — slider interactivo de mejora con N correcciones |
| 3 | Chef Caliro (chat/día/semana) | Excepcional — card stack con 3 demos |
| 4 | Historial | Débil — la página menos densa |
| 5 | Progreso | Sólida — SVG chart, adherencia, proyección |
| 6 | Suplementos | Nicho — solo aplica a users con suplementos |

---

## Crítica que motiva el rediseño

**Paleta de hero banners rota.** Los 6 banners usan 6 colores distintos: verde claro, violeta, amarillo, rosa, azul, verde claro. Caliro es marca verde única (Tailwind green-600 / green-500). El modal parece tener paleta de Notion, no de Caliro. Inconsistencia visual fuerte con el resto de la app.

**Cobertura incompleta del moat.** Faltan dos features importantes:

- Digest semanal (resumen dominical generado en `/assistant`).
- Frequent meals (chips de comidas habituales en Calculator).

**Page 4 (Historial) es desproporcionadamente débil.** Una demo de cards editables con un toast feedback, una card explicativa "comiste fuera sin móvil", y un tipstrip. Densidad informativa baja respecto al resto de páginas. Mejor enseñar Historial donde aplica (tooltip contextual al entrar) que dedicarle página propia.

**Page 6 (Suplementos) es nicho.** No todos los users usan suplementos. Página dedicada para feature opcional sobra.

---

## Cambios decididos

### Cambio 1 — Unificar paleta

Sustituir los 6 colores actuales por paleta verde Caliro + neutros. Los hero banners se diferencian entre páginas por número (01, 02, ..., 05) + tipografía + subtítulo, NO por color de fondo.

**Paleta nueva propuesta:**

| Variante | Background | Text color | Uso |
|----------|------------|------------|-----|
| Verde claro principal | `#dcfce7` | `#15803d` | Páginas core (1, 2, 3) |
| Crema editorial | `#faf4e6` | `#1f1a12` | Páginas contextuales (4, 5) |

Alternativa más radical: todos los heroes en blanco/crema con número grande tipográfico. La diferenciación visual ya viene del número y subtítulo, no hace falta color.

**Decisión: preview ambas opciones (dos verdes vs verde + crema) antes de elegir.** Render ambas variantes en `previews/helpmodal-palette.html` con los 5 hero banners visibles, comparar lado a lado, decidir entonces.

### Cambio 2 — Reestructura de 6 a 5 páginas

| # | Página actual | Página nueva | Cambio |
|---|---------------|--------------|--------|
| 1 | Registrar | Registrar + frequent_meals | Sub-bloque al final de Page 1 |
| 2 | Motor calibración | Motor calibración | **Sin cambios** |
| 3 | Chef Caliro | Chef Caliro + Resumen semanal | Bloque adicional sobre digest |
| 4 | Historial | (eliminada) | Pasa a tooltip contextual fuera del modal |
| 5 | Progreso | Progreso | **Sin cambios estructurales**, solo paleta |
| 6 | Suplementos | Tu perfil | Reformulada — incluye suplementos como bloque |

### Cambio 3 — Detalle de cada página modificada

**Page 1 (Registrar) — añadir sub-bloque frequent_meals al final:**

Tras los 3 acordeones de pro tips y antes del TipStrip, añadir un bloque:

> **Sugerencias rápidas según lo que comes habitualmente**
>
> Tras registrar varias veces, las comidas habituales aparecen como chips rápidos al inicio del registro. Un toque y ya está.
>
> [Demo: chip horizontal con 3 ejemplos: "Avena con plátano (412 kcal)", "Pollo con arroz (580 kcal)", "Tostada con AOVE (180 kcal)"]

Tono editorial neutro, sin emoji-spam. El demo debe ser estático (no interactivo) para no añadir complejidad — solo enseña que existen.

**Page 3 (Chef Caliro) — añadir bloque Resumen semanal:**

Page 3 actualmente cubre 3 modos en card stack: Chat, Día, Semana. Añadir un cuarto modo o un bloque adicional al final:

> **Cada domingo, un resumen analítico de tu semana**
>
> El Chef genera un análisis con números concretos: adherencia, patrones detectados, comparativa entre semana vs finde, evolución de proteína, áreas de mejora. Sin metáforas, solo datos.
>
> [Demo: ejemplo del digest real con texto analítico breve. P. ej.:
> _"Esta semana cubriste el target 5 de 7 días. Patrón finde: +320 kcal de media vs entre semana, equivale a ~2 días anulados de déficit. Proteína bien (1,7 g/kg). Tu desayuno cambió: 3 días con tostadas vs el habitual avena."_]

Importante: el digest aparece en `/assistant`. La página 3 ya cubre el Chef/Asistente, así que el digest es coherente como bloque dentro, no como página propia.

**Page 4 (Historial) — eliminada del HelpModal.**

El contenido se sustituye por un tooltip contextual one-shot que aparece la primera vez que el usuario entra a la sección Historial. Detalle del tooltip en `ONBOARDING_DECISIONS.md` (Señal 4).

Renumerar páginas restantes: actual Page 5 → nueva Page 4 (Progreso). Actual Page 6 → nueva Page 5 (Tu perfil).

**Page 5 (Tu perfil) — reformulada desde Suplementos.**

Reemplaza la página actual de Suplementos. Cubre cómo el usuario configura Caliro para que el Chef y la calibración funcionen mejor. Estructura propuesta:

- HeroBanner: "05 — Tu perfil" / "Adapta Caliro a ti"
- Intro: "Caliro funciona mejor cuanto más sabe de ti. Estos son los datos que te conviene tener al día."
- Bloque 1: **Targets** — calorías, macros, peso objetivo. Donde se configuran (Perfil) y por qué importan.
- Bloque 2: **Preferencias dietéticas** — dieta (omnívoro, vegetariano, vegano), alergias, disgustos. Reglas duras que el Chef respeta sin excepción.
- Bloque 3: **Suplementos** — añade los que tomas, aparecen automáticamente cada día. El Chef tiene el contexto.
- TipStrip: "El Chef y el motor de calibración se alimentan de tu perfil. Cuanto más completo, mejor te entienden."

Demos opcionales por bloque (toggle de suplementos del original sigue valiendo).

### Cambio 4 — Page 6 (Suplementos) condicional

No aplica con el cambio 3 — al fusionar suplementos como bloque dentro de Page 5 "Tu perfil", el problema desaparece. Si el usuario no tiene suplementos configurados, el bloque de suplementos puede colapsarse o mostrarse minimizado en Page 5, pero la página entera sigue siendo relevante (targets + preferencias siempre aplican).

---

## Lo que NO se toca

- Estructura de componentes compartidos (`HeroBanner`, `DemoBox`, `TipStrip`, `IntroText`, `StepCard`).
- Demos interactivas existentes (slider de calibración, card stack del Chef, SVG chart de progreso). Son el activo más valioso.
- Voz editorial: neutra, números concretos, sin emojis ni metáforas.
- Responsive: bottom sheet móvil + modal centrado desktop.
- Body lock al abrir.
- Animation slideUp.
- Footer Anterior / dots / Siguiente.

---

## Coste estimado

- Unificar paleta (sustituir colores de los 6 hero banners): 4 horas. Cambio cosmético, requiere preview en ambos temas (light por ahora — el modal usa `data-theme="light"` forzado).
- Sub-bloque frequent_meals en Page 1: 2 horas.
- Bloque Resumen semanal en Page 3: 4 horas. Demo nueva con texto analítico de ejemplo.
- Eliminar Page 4 (Historial) y renumerar dots/PAGES array: 1 hora.
- Reformular Page 6 → Page 5 "Tu perfil" con 3 bloques: 4-5 horas. La parte más sustancial.

**Total: 2-3 días de trabajo.**

---

## Orden de implementación recomendado

1. Renumeración: eliminar Page 4 actual del array PAGES y PAGE_TITLES (preserva el resto).
2. Paleta nueva en hero banners (afecta a todas las páginas, mejor cambio aislado).
3. Sub-bloque frequent_meals en Page 1.
4. Bloque digest semanal en Page 3.
5. Reformulación Page 5 (de Suplementos a Tu perfil) — última por ser la más sustancial.

Preview en `previews/helpmodal-redesign.html` antes de migrar a producción según workflow estándar.

---

## Coordinación con tooltip de Historial

El tooltip que sustituye Page 4 está documentado en `ONBOARDING_DECISIONS.md` (Señal 4). Idealmente se implementa en la misma sesión para que la cobertura no quede partida (eliminas página del modal sin tener tooltip = pérdida de educación temporal).

Orden recomendado: implementar tooltip Historial ANTES de eliminar Page 4 del modal. Cero gap de cobertura educativa.
