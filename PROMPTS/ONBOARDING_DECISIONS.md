# Onboarding silencioso — decisiones cerradas

**Estado:** decisiones cerradas, pendiente implementación.
**Fecha decisión:** 2026-05-07.
**Próximo paso:** confirmar textos exactos de tooltips/línea contextual, después implementar.

---

## Problema que resuelve

El moat real de Caliro (motor de calibración, Chef Caliro multimodo, frequent meals, digest semanal, BEDCA-grounded estimations) está construido pero distribuido en silos coherentes con la UX, no centralizado en un panel. Esto es decisión consciente y respetable — la limpieza del dashboard es parte de la marca. Pero genera un coste: el usuario nuevo puede no descubrir el moat sin guía.

El HelpModal (botón "?" en navbar) ya cubre la mayor parte del moat con 6 páginas de demos interactivas. El gap real de exposición se reduce a:

1. Que el usuario nuevo descubra que existe el botón "?".
2. Que el usuario sepa que cada domingo recibe un resumen semanal (digest), feature diferida en el tiempo que no se topa por navegación.
3. Que el usuario sepa que puede editar comidas de días anteriores (Historial), feature contextual que se enseña mejor donde aplica.

---

## Filosofía de diseño

**Señal sin contenido.** El dashboard se mantiene limpio. No se añaden widgets ni cards nuevas. Las señales son mínimas (dots, animations, tooltips one-shot) que indican estado del resto de la app sin meter contenido en home.

**Densidad máxima:** 1 señal activa simultánea en cada momento. Si colisionan, prioridad: pulse "?" → dot digest → tooltip historial.

**Reversibilidad:** toda señal se persiste como vista en DB tras la primera vez, no reaparece.

**No abrumar al user nuevo:** el tooltip de Historial no aparece hasta que el user efectivamente navega a Historial. El dot del digest no aparece hasta que existe digest generado.

---

## Las 4 señales

### Señal 1 — Pulse animation del icono "?"

**Qué:** el botón "?" en el navbar tiene una animación pulse sutil hasta que el usuario lo abre una vez. Sin texto, sin tooltip, solo animación.

**Cuándo aparece:** desde el primer login del usuario hasta que abra el HelpModal una vez.

**Cuándo desaparece:** al primer click del icono. Flag `help_modal_seen` pasa a `true`. No reaparece nunca.

**Por qué pulse y no tooltip:** un tooltip apuntando al "?" añade texto al header, rompe la limpieza. Una animación sutil del icono comunica "hay algo aquí" sin saturar el dashboard. Patrón usado por iMessage para conversaciones nuevas.

### Señal 2 — Dot indicator en tab Asistente

**Qué:** un punto verde de 6px junto al texto "Asistente" en navbar cuando hay digest semanal no leído.

**Cuándo aparece:** existe `assistant_digests` row para la semana actual del usuario AND `first_digest_seen_at` es null o anterior al `week_start` actual.

**Cuándo desaparece:** al abrir el `DigestSheet` (no al solo entrar a `/assistant` — el user debe ver el contenido). El dot reaparece el lunes siguiente cuando se genera el siguiente digest.

**Condición confirmada:** versión simple — `digest existe AND no visto`. El filtro "user con datos" queda implícito en el endpoint del digest (no se genera si no hay entries suficientes).

### Señal 3 — Línea contextual one-shot junto al tab Asistente

**Qué:** la primera vez que aparece el dot, junto al texto "Asistente" se muestra una línea efímera durante una sesión: "Tu primer resumen semanal está listo".

**Cuándo aparece:** dot activo AND `first_digest_seen_at` es null. Solo en la primera ocurrencia del dot, no en las siguientes.

**Cuándo desaparece:** al hacer click en el tab Asistente (independientemente de si abre el sheet o no).

**Texto exacto:** _"Tu primer resumen semanal está listo"_.

**Por qué:** el dot es señal pero no enseñanza. La primera vez que aparece, el usuario no sabe qué significa el punto verde. Esta línea one-shot enseña qué es y se desvanece una vez asimilado.

### Señal 4 — Tooltip contextual en Historial

**Qué:** la primera vez que el usuario entra a la sección Historial, un tooltip discreto apunta al botón "+" de un día anterior.

**Cuándo aparece:** primera navegación del usuario a `/historial` (o ruta equivalente) AND `history_tooltip_seen` es null.

**Cuándo desaparece:** al hacer click en cualquier botón "+" de un día anterior, O al hacer dismiss explícito del tooltip, O al salir de la sección Historial.

**Texto exacto:** _"Puedes editar comidas de cualquier día. Toca + para añadir."_

**Por qué:** la página 4 actual del HelpModal cubre Historial mediocremente. Es feature contextual que se enseña mejor donde se usa, no por adelantado. Esto descarga el HelpModal de una página débil y respeta el principio "enseñar donde aplica".

---

## Persistencia DB

Decisión: campo `onboarding_state` JSON en tabla `users`. Una columna nueva, todo el estado dentro. Razón: solo 3 flags previstos, no escala a tantos eventos como para justificar tabla separada.

Migración propuesta:

```sql
ALTER TABLE users ADD COLUMN onboarding_state TEXT DEFAULT '{}';
```

Estructura JSON:

```json
{
  "help_modal_seen": true,
  "first_digest_seen_at": "2026-05-12T09:30:00Z",
  "history_tooltip_seen": true
}
```

Endpoint nuevo: `PATCH /api/profile/onboarding-state` para actualizar flags individuales sin tocar otros campos del user.

Lectura: incluir `onboarding_state` en `GET /api/profile` (ya existe). Frontend lee al cargar y decide qué señales mostrar.

---

## Trigger logic resumida

| Señal | Condición de aparición | Condición de desaparición permanente |
|-------|------------------------|--------------------------------------|
| Pulse "?" | `help_modal_seen` is null | Click en "?" → set `help_modal_seen = true` |
| Dot Asistente | digest semana actual existe AND `first_digest_seen_at < week_start` | Abrir DigestSheet → set `first_digest_seen_at = now` |
| Línea contextual | `first_digest_seen_at` is null AND dot activo | Click en tab Asistente |
| Tooltip historial | `history_tooltip_seen` is null AND user en /historial | Click en + de día anterior O dismiss O salir → set `history_tooltip_seen = true` |

---

## Detalles que se cierran al implementar

Decisiones técnicas menores que se afinan en preview, no requieren validación previa:

- **Detalles visuales del pulse.** Frecuencia (~1s), intensidad sutil, color verde Caliro o neutro según contraste con navbar.
- **Detalles visuales del dot.** Tamaño 6px, posición a la derecha del texto del tab, color verde Caliro estándar.
- **Animación de aparición/desaparición** de la línea contextual y del tooltip (fade in/out 200-300ms).

Cierre de estos en preview antes de migrar a producción según workflow estándar.

---

## Coste estimado

- Migración DB + endpoint PATCH onboarding-state: 2 horas.
- Pulse animation icono "?": 1 hora.
- Dot tab Asistente: 2 horas (incluye lógica de comparación con `week_start`).
- Línea contextual one-shot: 2 horas.
- Tooltip historial: 2 horas.
- Cableado frontend (lectura del onboarding_state, render condicional): 3-4 horas.

**Total: 1-2 días de trabajo.**

---

## Orden de implementación recomendado

1. Migración DB (`onboarding_state` column) y endpoint PATCH.
2. Lectura frontend del onboarding_state al cargar app.
3. Pulse del "?" (más simple, valida el patrón).
4. Dot Asistente + línea contextual (par acoplado).
5. Tooltip Historial (independiente, último).

Cada señal en preview antes de migrar a producción según workflow estándar.
