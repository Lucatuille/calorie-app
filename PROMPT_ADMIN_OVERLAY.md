# 👑 Panel de Admin — Overlay Privado

## Contexto
Crear un panel de administración privado para el dueño de LucaEats. Doble protección: campo `is_admin` en BD + atajo de teclado secreto. Diseño de dashboard real y cuidado — no una página de debug. Misma estética que la app pero con densidad de información mayor.

---

## 1. PROTECCIÓN Y ACCESO

### Doble capa de seguridad:

**Capa 1 — Base de datos:**
```sql
-- Ejecutar en D1 Console (avisar al finalizar):
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
UPDATE users SET is_admin = 1 WHERE email = 'TU_EMAIL_AQUI';
```

**Capa 2 — Atajo de teclado secreto:**
El overlay se activa con `Ctrl + Shift + A` (o `Cmd + Shift + A` en Mac).
Si el usuario NO es admin, el atajo no hace nada — sin mensajes de error, sin pistas.
Si el usuario SÍ es admin, abre el overlay.

**En el Worker — todos los endpoints `/api/admin/*`:**
```js
// Middleware admin — verificar is_admin en cada request
async function requireAdmin(request, env) {
  const user = await getAuthUser(request, env);
  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return user;
}
```

**El JWT debe incluir `is_admin`** — actualizar la generación del token en `auth.js` para incluir este campo. El frontend lo lee del token para saber si mostrar el listener del atajo de teclado.

---

## 2. ESTRUCTURA DEL OVERLAY

### Comportamiento:
- Abre como overlay fullscreen sobre la app con `position: fixed, inset: 0, z-index: 9999`
- Fondo semitransparente oscuro detrás (`rgba(0,0,0,0.85)`) con blur del contenido
- Panel centrado `max-width: 1200px`, `height: 90vh`, scrollable internamente
- Cerrar con `Escape`, con botón X, o con click fuera del panel
- NO aparece en el historial de navegación — no cambia la URL
- Animación de entrada: scale 0.95 → 1 + fadeIn en 200ms

### Header del panel:
```
👑 LucaEats Admin                    [última actualización: hace 2min 🔄] [✕]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ 📊 Overview ] [ 👥 Usuarios ] [ 📈 Engagement ] [ 🤖 IA & Uso ]
```

4 tabs. La primera activa por defecto.

---

## 3. TAB 1 — OVERVIEW

Grid de KPI cards en la parte superior (2 filas de 4):

### Fila 1 — Usuarios:
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ TOTAL USERS  │ │ ACTIVOS HOY  │ │ ESTA SEMANA  │ │ NUEVOS 7d    │
│              │ │              │ │              │ │              │
│     12       │ │      3       │ │      8       │ │      2       │
│              │ │  ↑ vs ayer   │ │  67% retenc. │ │  +∞% 😄      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Fila 2 — Plataforma:
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ ENTRADAS BD  │ │ FOTOS IA HOY │ │ MEDIA KCAL   │ │ RACHA MAX    │
│              │ │              │ │ PLATAFORMA   │ │              │
│    1.247     │ │      7       │ │  1.920 kcal  │ │   🔥 14 días │
│ +43 hoy      │ │ 43 total     │ │ últimos 7d   │ │  (Carlos M.) │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Gráfico central — Actividad diaria (últimos 30 días):
Recharts `AreaChart` con:
- Línea/área verde: usuarios activos por día
- Línea punteada naranja: entradas registradas por día (eje secundario)
- Tooltip con fecha, usuarios activos y entradas del día

### Sección inferior — Alertas del sistema:
```
⚠️ ATENCIÓN
─────────────────────────────────────────────
🔴 Ana P. — 8 días sin registrar (última vez: 1 mar)
🟡 Carlos M. — 4 días sin registrar
🟢 Todo lo demás funciona correctamente
```

---

## 4. TAB 2 — USUARIOS

### Tabla completa de usuarios:

Columnas:
- **Usuario** — nombre + email (truncado)
- **Registro** — fecha en formato "hace 12 días"
- **Último acceso** — "hace 2 horas" / "hace 3 días" con color (verde/amarillo/rojo)
- **Racha** 🔥 — número de días
- **7d activos** — de los últimos 7 días cuántos registró (ej: "5/7")
- **Kcal media** — últimos 7 días
- **Usa IA** — sí/no con emoji 🤖
- **Plataforma** — detectar desde User-Agent si es iOS/Android/Desktop

Ordenar por defecto: último acceso (más reciente primero).
Click en cabecera de columna para ordenar por esa columna.

### Al hacer click en una fila — expandir detalle del usuario:
```
▼ Luca Tuille  luca@email.com
  ┌──────────────────────────────────────────────────────┐
  │  Registrado: 4 mar 2026                              │
  │  Peso actual: 70 kg  →  Objetivo: 65 kg              │
  │  Target kcal: 2.300  │  TDEE calculado: 2.580        │
  │                                                      │
  │  Últimos 7 días:                                     │
  │  L   M   X   J   V   S   D                          │
  │  ✓   ✓   ✓   ✓   ✓   ✗   ✓                          │
  │                                                      │
  │  Comida más registrada: "Pasta" (8 veces)           │
  │  Suplementos activos: Creatina, Omega 3              │
  └──────────────────────────────────────────────────────┘
```

Sin ver calorías individuales de cada entrada — solo stats agregados.

---

## 5. TAB 3 — ENGAGEMENT

### Retención por cohorte (semanal):
Tabla simple mostrando qué % de usuarios registrados cada semana siguen activos:
```
Semana registro    Usuarios    D+7    D+14    D+30
─────────────────────────────────────────────────
Semana del 3 mar       5       80%     60%     —
Semana del 24 feb      4       75%     50%    25%
Semana del 17 feb      3      100%     67%    33%
```

### Distribución de meal types (toda la plataforma):
Recharts `BarChart` horizontal:
```
Desayuno      ████████████  32%
Comida        █████████████ 35%
Cena          ██████████    28%
Snack         ██            5%
```

### Heatmap de actividad semanal:
Grid 7 columnas (L-D) x 4 filas (semanas):
Cada celda coloreada según % de usuarios activos ese día.
Verde oscuro = muchos usuarios. Verde claro = pocos. Gris = ninguno.
Igual que el heatmap de GitHub pero de actividad de usuarios.

### Top comidas registradas (toda la plataforma, anónimo):
```
1. Pollo con arroz        87 veces
2. Avena con frutas       64 veces
3. Pasta carbonara        51 veces
4. Ensalada con atún      43 veces
5. Tortilla española      38 veces
```

---

## 6. TAB 4 — IA & USO

### Stats de uso de la IA:
```
┌─────────────────────┐  ┌─────────────────────┐
│ FOTOS ANALIZADAS    │  │ COSTE ESTIMADO API  │
│ Total: 143          │  │ Este mes: ~$0.43    │
│ Esta semana: 23     │  │ Total: ~$0.57       │
│ Media/usuario: 11.9 │  │ Por foto: ~$0.004   │
└─────────────────────┘  └─────────────────────┘
```

### Precisión percibida de la IA:
Si implementamos en el futuro un botón de feedback en los resultados de foto, aquí se verían los ratings. Por ahora mostrar placeholder: *"Próximamente — sistema de feedback en análisis de fotos"*

### Uso por feature:
```
Feature                Usuarios que lo usan    % del total
──────────────────────────────────────────────────────────
Registro manual              12/12               100%
Análisis por foto             8/12                67%
Calculadora TDEE              9/12                75%
Análisis avanzado             6/12                50%
Suplementos                   7/12                58%
Modo oscuro                   5/12                42%
```

### Dispositivos:
```
iOS Safari          5  (42%)
Android Chrome      4  (33%)
Desktop Chrome      3  (25%)
```

---

## 7. BACKEND — Endpoints admin

Crear `worker/src/routes/admin.js` con:

### GET /api/admin/overview
```js
// Devuelve todos los KPIs de la tab Overview
{
  users: {
    total: 12,
    active_today: 3,
    active_week: 8,
    new_last_7d: 2,
    inactive_7d_plus: 4
  },
  platform: {
    total_entries: 1247,
    entries_today: 43,
    avg_calories_7d: 1920,
    ai_photos_today: 7,
    ai_photos_total: 143,
    max_streak: { user: 'Carlos M.', days: 14 }
  },
  alerts: [...],
  daily_activity: [...] // últimos 30 días
}
```

### GET /api/admin/users
Lista completa con stats por usuario. Query SQL eficiente — no N+1 queries.

### GET /api/admin/engagement
Datos de retención, meal types, heatmap, top comidas.

### GET /api/admin/ai-stats
Stats de uso de IA por usuario y totales.

**Todos los endpoints verifican `is_admin = 1` antes de devolver nada.**

---

## 8. FRONTEND — Componente AdminOverlay

### `client/src/components/AdminOverlay.jsx`:
- Estado: `isOpen`, `activeTab`, `data` por tab, `loading`
- Fetch lazy por tab — solo cargar datos cuando se abre esa tab
- Refresh manual con botón 🔄 en el header
- Auto-refresh cada 5 minutos si el overlay está abierto

### Listener del atajo de teclado en `App.jsx`:
```jsx
useEffect(() => {
  if (!user?.is_admin) return; // no registrar listener si no es admin
  
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      setAdminOpen(prev => !prev);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [user]);
```

### El campo `is_admin` en el contexto de auth:
Actualizar `AuthContext.jsx` para leer `is_admin` del JWT y exponerlo en el contexto. Actualizar la generación del JWT en el Worker para incluirlo.

---

## 9. DISEÑO VISUAL

- Todo en la paleta existente de la app — `var(--accent)`, `var(--surface)`, etc.
- Funciona en modo claro y oscuro (usa variables CSS)
- Las KPI cards usan `Instrument Serif` para los números grandes
- La tabla de usuarios tiene hover highlight sutil
- Los colores de estado: verde (#2d6a4f) = bien, amarillo (#e9c46a) = atención, rojo (#e76f51) = alerta
- Scrollbar custom fina y discreta dentro del overlay
- En móvil: tabs en scroll horizontal, tabla colapsada a cards

---

## 10. ORDEN DE IMPLEMENTACIÓN

1. SQL en D1 — avisarme para ejecutar: `ALTER TABLE users ADD COLUMN is_admin...` + `UPDATE users SET is_admin = 1 WHERE email = '...'`
2. Actualizar generación de JWT en Worker para incluir `is_admin`
3. Crear `worker/src/routes/admin.js` con los 4 endpoints
4. Registrar rutas admin en `worker/src/index.js`
5. Desplegar Worker: `cd worker && npm run deploy`
6. Actualizar `AuthContext.jsx` para exponer `is_admin`
7. Crear `AdminOverlay.jsx` con las 4 tabs
8. Añadir listener de teclado en `App.jsx`
9. Verificar que usuarios no-admin no ven nada ni en frontend ni en backend

---

## 11. AL FINALIZAR

- Verificar con tu cuenta: `Ctrl+Shift+A` abre el overlay
- Verificar con otra cuenta (no admin): el atajo no hace nada
- Verificar que `/api/admin/overview` devuelve 403 sin token admin
- `git add . && git commit -m "feat: panel admin privado con overlay" && git push`
- **NO mencionar la existencia del panel en ningún sitio público de la app**
