# 🛡️ Medidas de seguridad legal — Disclaimers no invasivos

## Contexto
Añadir disclaimers legales a LucaEats de forma que protejan legalmente la app sin interrumpir la experiencia del usuario. La app es un tracker personal, no un dispositivo médico. Los disclaimers deben ser visibles pero discretos — nunca popups bloqueantes ni texto alarmista.

---

## 1. ONBOARDING — Pantalla de bienvenida (una sola vez)

### Cuándo aparece:
Solo la primera vez que el usuario abre la app, justo después del login/registro. Guardar en localStorage `hasSeenDisclaimer: true` para no volver a mostrarla nunca.

### Diseño — NO es un popup bloqueante:
Es una pantalla completa de bienvenida elegante que aparece una sola vez, integrada en el flujo natural. Estética coherente con la app.

```
[Logo LucaEats pequeño centrado]

Bienvenido a LucaEats

Tu compañero de seguimiento nutricional
personal.

─────────────────────────────────────

LucaEats es una herramienta de tracking
personal. No sustituye el consejo de un
médico o nutricionista.

Si tienes alguna condición médica o
buscas orientación clínica, consulta
siempre con un profesional de la salud.

─────────────────────────────────────

[ Empezar →]
```

### Detalles de diseño:
- Fondo `var(--bg)` — mismo que el resto de la app
- Logo pequeño arriba, texto grande centrado
- El disclaimer en texto pequeño `font-size: 0.8rem`, color `var(--text-secondary)` — presente pero no protagonista
- UN solo botón "Empezar" — sin opción de rechazar, sin checkboxes
- Animación de fadeIn suave al aparecer
- En móvil ocupa toda la pantalla, en desktop max-width 480px centrado

### Implementación:
```jsx
// En App.jsx, antes de renderizar las rutas:
const hasSeenDisclaimer = localStorage.getItem('lucaeats_disclaimer_v1');

if (isAuthenticated && !hasSeenDisclaimer) {
  return <WelcomeDisclaimer onAccept={() => {
    localStorage.setItem('lucaeats_disclaimer_v1', 'true');
  }} />;
}
```

Crear `client/src/components/WelcomeDisclaimer.jsx`.

---

## 2. CALCULADORA TDEE — Disclaimer en resultado

### Dónde:
Al final de la pantalla de resultados del wizard TDEE, justo antes del botón "Guardar como mi objetivo". Texto pequeño, no intrusivo.

### Texto:
```
ℹ️ Estos valores son estimaciones orientativas 
basadas en fórmulas estadísticas (±150-200 kcal 
de margen inherente). No constituyen prescripción 
dietética. Consulta con un nutricionista para un 
plan personalizado.
```

### Diseño:
- `font-size: 0.75rem`
- Color `var(--text-secondary)` 
- Icono ℹ️ delante
- Sin bordes ni cajas — texto plano integrado
- No bloquea nada ni requiere interacción

---

## 3. PROYECCIÓN DE PESO — Disclaimer inline

### Dónde:
Al pie de la sección de proyección en el bottom sheet de Análisis Avanzado. Ya existe un disclaimer parcial — reemplazarlo por este más completo.

### Texto:
```
Las proyecciones son estimaciones orientativas con 
un margen de error de ±150-200 kcal. El peso fluctúa 
±1-2 kg diariamente por agua y glucógeno — esto no 
refleja cambios reales en grasa. No uses estos datos 
para decisiones médicas. Consulta con un profesional 
de la salud para objetivos terapéuticos.
```

### Diseño:
- Mismo estilo que el punto anterior — texto pequeño, color secundario
- Separado del contenido principal por una línea `<hr>` fina
- Sin iconos alarmantes, sin cajas rojas

---

## 4. FOOTER GLOBAL — Texto legal mínimo

### Dónde:
En la página de Perfil, al final de todo (después de todos los campos). Solo en Perfil, no en todas las páginas — no hace falta ser repetitivo.

### Texto:
```
LucaEats v1.0 · Herramienta de tracking nutricional personal
No es un dispositivo médico ni sustituye asesoramiento clínico.
Consulta nuestra Política de privacidad
```

### Diseño:
- `font-size: 0.7rem`
- Color muy suave `var(--text-secondary)` con opacidad reducida
- "Política de privacidad" como link (puede apuntar a una página básica por ahora)
- Completamente al pie, invisible a menos que el usuario llegue hasta abajo

---

## 5. PÁGINA DE POLÍTICA DE PRIVACIDAD — `/privacy`

Crear una ruta pública `/privacy` con una página básica de política de privacidad que cubra los puntos esenciales. No necesita diseño elaborado.

### Contenido mínimo:
```
Política de Privacidad — LucaEats

Última actualización: [fecha actual]

1. Qué datos recogemos
   - Email y nombre de registro
   - Datos de alimentación introducidos por el usuario
   - Peso corporal (opcional)
   - Datos de uso de la app

2. Cómo usamos los datos
   - Para proporcionar el servicio de tracking
   - No vendemos datos a terceros
   - No usamos datos para publicidad

3. Dónde se almacenan
   - En servidores de Cloudflare (infraestructura europea)

4. Tus derechos (RGPD)
   - Acceso a tus datos: escríbenos a [email]
   - Eliminación de cuenta y datos: desde Perfil → Eliminar cuenta
   - Portabilidad: exporta tus datos en CSV desde Perfil

5. Contacto
   [email de contacto]

LucaEats es una herramienta de seguimiento personal.
No es un dispositivo médico. No sustituye el consejo
de un médico, nutricionista u otro profesional sanitario.
```

### Implementación:
- Ruta pública `/privacy` — accesible sin login
- Página React simple con texto, sin navegación compleja
- Link desde el footer del Perfil

---

## 6. TÉRMINOS EN REGISTRO — Checkbox mínimo

### Dónde:
En la página de Register, antes del botón "Crear cuenta". Un solo checkbox, no dos.

### Texto:
```
☐ He leído y acepto los Términos de uso y la 
  Política de privacidad de LucaEats
```

"Política de privacidad" como link a `/privacy`.

### Comportamiento:
- El botón "Crear cuenta" está deshabilitado hasta que se marque
- Guardar en la BD que el usuario aceptó los términos (añadir campo `terms_accepted_at` a users)

### SQL necesario (avisar para ejecutar en D1):
```sql
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
```

---

## 7. LO QUE NO HACER — Evitar expresamente

- ❌ NO añadir popups en medio de la app
- ❌ NO poner warnings rojos en el dashboard
- ❌ NO repetir el disclaimer en cada página
- ❌ NO pedir confirmación cada vez que el usuario usa una feature
- ❌ NO usar lenguaje alarmista ("PELIGRO", "ADVERTENCIA", "RIESGO")
- ❌ NO añadir más de un checkbox en el registro

---

## 8. ORDEN DE IMPLEMENTACIÓN

1. Crear `WelcomeDisclaimer.jsx` e integrarlo en `App.jsx`
2. Crear página `/privacy` con ruta pública
3. Añadir checkbox en `Register.jsx`
4. Añadir disclaimer inline en resultado de TDEE wizard
5. Actualizar disclaimer en proyección de peso (Análisis Avanzado)
6. Añadir footer en `Profile.jsx`
7. SQL para `terms_accepted_at` — avisarme para ejecutar en D1
8. Desplegar: `cd worker && npm run deploy` si hay cambios en Worker

---

## 9. AL FINALIZAR

- Verificar que `WelcomeDisclaimer` solo aparece una vez (probar borrando localStorage y recargando)
- Verificar que `/privacy` es accesible sin estar logueado
- Verificar que el checkbox de registro bloquea el botón correctamente
- `git add . && git commit -m "feat: disclaimers legales y política de privacidad" && git push`
