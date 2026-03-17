# 🤖 Asistente Nutricional Personal con IA — Feature Pro

## Contexto
Implementar un asistente nutricional personal con IA como feature exclusiva de Pro en LucaEats. El asistente tiene acceso completo a los datos del usuario en D1 y responde con información personalizada y específica. No es un chatbot genérico — es un nutricionista personal que conoce exactamente qué ha comido el usuario, cómo va su progreso y cuáles son sus objetivos.

---

## 0. ARQUITECTURA GENERAL

```
Frontend (Chat UI)
    ↓ mensaje + conversation_id
Worker (/api/assistant/chat)
    ↓ carga contexto del usuario desde D1
    ↓ buildLightContext() para Haiku, buildUserContext() para Sonnet
    ↓ llama a Claude API (Haiku o Sonnet según complejidad)
    ↓ guarda conversación en D1
    ↓ genera título de conversación (fire-and-forget tras 1er intercambio)
    ↓ devuelve respuesta
Frontend (muestra respuesta)
```

**Modelos usados:**
- Preguntas simples (detección automática): Claude Haiku → ~$0.002/mensaje
- Análisis profundos y resúmenes: Claude Sonnet → ~$0.015/mensaje
- La detección del tipo de pregunta se hace en el Worker antes de llamar a Claude

**Caché de mensajes costosos (client-side localStorage):**
- Mensaje de bienvenida diario: `lucaeats_daily_intro_YYYY-MM-DD` → regenerar si fecha cambia
- Resumen semanal: `lucaeats_weekly_summary_YYYY-WW` → regenerar si semana cambia
- Esto evita llamadas a Claude en cada page load

---

## 1. BASE DE DATOS — Nuevas tablas

**Ejecutar en D1 Console:**

```sql
CREATE TABLE assistant_conversations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT,
  message_count INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assistant_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  model_used      TEXT,
  tokens_used     INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assistant_usage (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  messages INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_assistant_messages_conv ON assistant_messages(conversation_id, created_at);
CREATE INDEX idx_assistant_conv_user ON assistant_conversations(user_id, updated_at DESC);
CREATE INDEX idx_assistant_usage ON assistant_usage(user_id, date);
```

---

## 2. WORKER — worker/src/routes/assistant.js

### FIXES respecto al prompt original:
1. `buildLightContext()` para queries Haiku — solo perfil + hoy + 7 días (~40% menos tokens)
2. `buildUserContext()` completo solo para Sonnet
3. Título de conversación generado con Haiku en fire-and-forget tras el primer intercambio
4. NO hay endpoint `/daily-intro` ni `/weekly-summary` en el backend — el frontend los cachea en localStorage y llama a `/api/assistant/chat` con prompts específicos cuando el caché expira

### Límites diarios:
- access_level 0 (Free): 0 mensajes (feature bloqueada)
- access_level 1 (Pro): 20 mensajes/día
- access_level 2 (Fundador): 40 mensajes/día
- access_level 99 (Admin): 999

### Contexto ligero (Haiku — queries simples):
Solo carga: perfil, totales de hoy, últimos 7 días. ~800 tokens de contexto.

### Contexto completo (Sonnet — análisis complejos):
Carga: perfil, hoy, 7 días, 30 días, racha, adherencia, comidas frecuentes, peso, calibración. ~2.500 tokens.

### Detección de complejidad:
- simplePatterns → Haiku
- complexPatterns → Sonnet
- default → Haiku (más barato)

### Título automático:
Tras el primer par user/assistant en una conversación nueva (`message_count === 0` antes del insert), lanzar en `ctx.waitUntil()` una llamada a Haiku con el mensaje del usuario para generar un título de 4 palabras y UPDATE la conversación.

---

## 3. FRONTEND — client/src/pages/Assistant.jsx

### Caché en localStorage (evita llamadas Claude en cada page load):
```js
const today = new Date().toLocaleDateString('en-CA');
const cacheKey = `lucaeats_daily_intro_${today}`;
const cached = localStorage.getItem(cacheKey);
if (cached) {
  setMessages([{ role: 'assistant', content: cached, isWelcome: true }]);
} else {
  // Llamar a /api/assistant/chat con prompt especial
  const res = await api.sendAssistantMessage({
    message: '__DAILY_INTRO__',  // flag especial que el Worker reconoce
    conversation_id: null,
    is_intro: true,
  }, token);
  localStorage.setItem(cacheKey, res.message);
  setMessages([{ role: 'assistant', content: res.message, isWelcome: true }]);
}
```

El Worker detecta `is_intro: true` y usa un prompt fijo barato con Haiku para generar el saludo del día.

### Resumen semanal:
```js
const weekKey = `lucaeats_weekly_summary_${getWeekKey()}`;
// getWeekKey() → 'YYYY-WN' basado en new Date()
```

### Componentes:
- MessageBubble: burbujas de chat, user (verde) / assistant (surface)
- MarkdownText: parser mínimo para **negrita** y listas
- TypingIndicator: tres puntos animados mientras carga
- QuickSuggestions: chips adaptativos por hora del día
- UsageBar: mensajes restantes (naranja si <5, rojo si 0)

---

## 4. NAVBAR — visible solo para Pro/Fundador/Admin

```jsx
{user?.access_level >= 1 && (
  <Link to="/asistente">🤖 Asistente</Link>
)}
```

---

## 5. DASHBOARD — card de preview para Free

Card con dashed border, opacity 0.7, clic redirige a /planes.

---

## 6. SEGURIDAD

- `requireProAccess` verifica `access_level >= 1` en BD en CADA request
- Mensajes filtrados: máximo 1.000 caracteres
- Rate limiting: tabla `assistant_usage`
- Historial siempre filtrado por `user_id`
- El flag `__DAILY_INTRO__` no se guarda en el historial de la conversación

---

## 7. ORDEN DE IMPLEMENTACIÓN

1. SQL en D1 Console (3 tablas + 3 índices)
2. `worker/src/routes/assistant.js`
3. `worker/src/index.js` — añadir rutas
4. Deploy Worker
5. `client/src/pages/Assistant.jsx`
6. `client/src/api.js` — nuevos métodos
7. `client/src/App.jsx` — nueva ruta /asistente
8. `client/src/components/Navbar.jsx` — link Pro
9. `client/src/pages/Dashboard.jsx` — card Free
10. git push
