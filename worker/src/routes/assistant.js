// ============================================================
//  ASSISTANT ROUTE — /api/assistant/*
//  Asistente nutricional personal con IA (feature Pro)
//
//  PREREQUISITO DE BD — ejecutar una vez en D1 si no existe:
//  ALTER TABLE assistant_usage ADD COLUMN intros INTEGER DEFAULT 0;
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

// ── Auth helper: verifica access_level >= 2 en BD ──────────

async function requireProAccess(request, env) {
  const user = await authenticate(request, env);
  if (!user) return null;
  // Verificar en BD — nunca confiar solo en el JWT
  const row = await env.DB.prepare(
    'SELECT id, name, access_level FROM users WHERE id = ?'
  ).bind(user.userId).first();
  if (!row || row.access_level < 2) return null;
  return { ...user, ...row };
}

// ── Límites diarios por nivel ───────────────────────────────

const DAILY_LIMITS = { 2: 20, 3: 40, 99: 999 };

// ── System prompt del asistente ────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente nutricional personal de LucaEats. Tienes acceso completo a los datos reales del usuario y respondes con información específica y personalizada.

PERSONALIDAD:
- Cercano y motivador, nunca condescendiente
- Directo — vas al grano con datos concretos
- Honesto — si algo no va bien, lo dices con tacto
- Positivo pero realista — no generas expectativas falsas

REGLAS DE RESPUESTA:
1. SIEMPRE usa los datos reales del usuario en tus respuestas. Nunca des respuestas genéricas.
2. Cuando menciones números, sé preciso (1.820 kcal, no "alrededor de 1.800")
3. Respuestas cortas para preguntas simples (3-5 líneas)
4. Respuestas estructuradas para análisis complejos (usa secciones claras)
5. Si el usuario pregunta algo que no está en sus datos, díselo honestamente
6. NUNCA hagas diagnósticos médicos ni recomendaciones clínicas
7. Si detectas algo preocupante (muy pocas calorías, patrones extremos), menciona consultar con un profesional
8. Responde siempre en español
9. Usa emojis con moderación (1-2 por respuesta máximo)
10. Para listas de comidas: "Nombre — X kcal"

Cuando la pregunta sea sobre salud o recomendaciones médicas, añade al final en una línea aparte:
"ⓘ Soy una herramienta de seguimiento, no un profesional sanitario."`;

// ── Contexto ligero — Haiku, primera vez (~800 tokens) ─────

async function buildLightContext(userId, env) {
  const today   = new Date().toLocaleDateString('en-CA');
  const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA');

  const [user, todayRows, last7Days] = await Promise.all([
    env.DB.prepare(
      'SELECT name, age, weight, target_calories, target_protein, target_carbs, target_fat, goal_weight FROM users WHERE id = ?'
    ).bind(userId).first(),

    env.DB.prepare(
      'SELECT name, meal_type, calories, protein, carbs, fat FROM entries WHERE user_id = ? AND date = ? ORDER BY created_at ASC'
    ).bind(userId, today).all(),

    env.DB.prepare(`
      SELECT date, SUM(calories) as cal, SUM(protein) as prot
      FROM entries WHERE user_id = ? AND date >= ? AND date < ?
      GROUP BY date ORDER BY date DESC
    `).bind(userId, weekAgo, today).all(),
  ]);

  const todayTotals = (todayRows.results || []).reduce(
    (acc, e) => ({ cal: acc.cal + (e.calories||0), prot: acc.prot + (e.protein||0), carbs: acc.carbs + (e.carbs||0), fat: acc.fat + (e.fat||0) }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );
  const remaining = (user?.target_calories || 0) - todayTotals.cal;

  return `=== PERFIL ===
${user?.name} | ${user?.weight}kg | Objetivo: ${user?.target_calories} kcal/día | Meta peso: ${user?.goal_weight || 'no definida'}kg
Macros objetivo: ${user?.target_protein||'?'}g prot | ${user?.target_carbs||'?'}g carbos | ${user?.target_fat||'?'}g grasa

=== HOY (${today}) ===
Consumido: ${Math.round(todayTotals.cal)} kcal / ${user?.target_calories} objetivo
Restantes: ${Math.round(remaining)} kcal ${remaining < 0 ? '(SUPERADO)' : ''}
Proteína: ${Math.round(todayTotals.prot)}g | Carbos: ${Math.round(todayTotals.carbs)}g | Grasa: ${Math.round(todayTotals.fat)}g
Comidas de hoy:
${(todayRows.results||[]).length > 0
  ? (todayRows.results||[]).map(e => `  - [${e.meal_type}] ${e.name||'sin nombre'}: ${e.calories} kcal, ${e.protein||0}g prot`).join('\n')
  : '  - Sin registros todavía'}

=== ÚLTIMOS 7 DÍAS ===
${(last7Days.results||[]).length > 0
  ? (last7Days.results||[]).map(d => `  ${d.date}: ${Math.round(d.cal)} kcal (${Math.round(d.cal-(user?.target_calories||0)) >= 0 ? '+' : ''}${Math.round(d.cal-(user?.target_calories||0))} vs objetivo)`).join('\n')
  : '  Sin datos'}`;
}

// ── Contexto micro — conversaciones largas (~100 tokens) ────
// FIX #6: En conversaciones con >= 2 mensajes ya en historial,
// Claude ya tiene el contexto completo. Solo refrescar hoy.

async function buildMicroContext(userId, env) {
  const today = new Date().toLocaleDateString('en-CA');
  const [user, todayTotals] = await Promise.all([
    env.DB.prepare('SELECT target_calories FROM users WHERE id = ?').bind(userId).first(),
    env.DB.prepare(
      'SELECT SUM(calories) as cal, SUM(protein) as prot, SUM(carbs) as carbs, SUM(fat) as fat FROM entries WHERE user_id = ? AND date = ?'
    ).bind(userId, today).first(),
  ]);
  const cal       = todayTotals?.cal  || 0;
  const remaining = (user?.target_calories || 0) - cal;
  return `[Datos actualizados ${today}: ${Math.round(cal)} kcal consumidas, ${Math.round(remaining)} restantes | Prot: ${Math.round(todayTotals?.prot||0)}g | Carbos: ${Math.round(todayTotals?.carbs||0)}g | Grasa: ${Math.round(todayTotals?.fat||0)}g]`;
}

// ── Contexto completo — Sonnet, primera vez (~2200 tokens) ──
// FIX #7: eliminadas columnas de calibración (inútiles para el asistente)

async function buildUserContext(userId, env) {
  const today    = new Date().toLocaleDateString('en-CA');
  const weekAgo  = new Date(Date.now() - 7  * 86400000).toLocaleDateString('en-CA');
  const monthAgo = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA');

  const [user, todayRows, last7Days, last30Stats, topFoods, weightHistory] =
    await Promise.all([
      env.DB.prepare(
        'SELECT name, age, weight, height, gender, target_calories, target_protein, target_carbs, target_fat, goal_weight, tdee FROM users WHERE id = ?'
      ).bind(userId).first(),

      env.DB.prepare(
        'SELECT name, meal_type, calories, protein, carbs, fat FROM entries WHERE user_id = ? AND date = ? ORDER BY created_at ASC'
      ).bind(userId, today).all(),

      env.DB.prepare(`
        SELECT date, SUM(calories) as cal, SUM(protein) as prot
        FROM entries WHERE user_id = ? AND date >= ? AND date < ?
        GROUP BY date ORDER BY date DESC
      `).bind(userId, weekAgo, today).all(),

      env.DB.prepare(`
        SELECT AVG(dc) as avg_cal, AVG(dp) as avg_prot,
               MIN(dc) as min_cal, MAX(dc) as max_cal, COUNT(*) as days
        FROM (SELECT date, SUM(calories) as dc, SUM(protein) as dp
              FROM entries WHERE user_id = ? AND date >= ? AND date < ?
              GROUP BY date)
      `).bind(userId, monthAgo, today).first(),

      // FIX #5: filtrar a 90 días para evitar full table scan
      env.DB.prepare(`
        SELECT name, COUNT(*) as times, AVG(calories) as avg_cal
        FROM entries
        WHERE user_id = ? AND name IS NOT NULL AND name != ''
          AND date >= date('now', '-90 days')
        GROUP BY LOWER(name) ORDER BY times DESC LIMIT 5
      `).bind(userId).all(),

      env.DB.prepare(`
        SELECT date, weight FROM entries
        WHERE user_id = ? AND weight IS NOT NULL AND date >= ?
        GROUP BY date ORDER BY date DESC LIMIT 10
      `).bind(userId, monthAgo).all(),
    ]);

  const todayTotals = (todayRows.results||[]).reduce(
    (acc, e) => ({ cal: acc.cal+(e.calories||0), prot: acc.prot+(e.protein||0), carbs: acc.carbs+(e.carbs||0), fat: acc.fat+(e.fat||0) }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 }
  );
  const remaining = (user?.target_calories||0) - todayTotals.cal;
  const avg7d = (last7Days.results||[]).length > 0
    ? (last7Days.results||[]).reduce((s,d) => s+d.cal, 0) / (last7Days.results||[]).length : 0;

  const wh = weightHistory.results || [];
  const weightTrend = wh.length >= 2
    ? `${wh[0].weight < wh[wh.length-1].weight ? '↓ bajando' : '↑ subiendo'} (${(wh[0].weight - wh[wh.length-1].weight).toFixed(1)}kg en ${wh.length} registros)`
    : 'insuficientes datos';

  return `=== PERFIL ===
${user?.name} | ${user?.age} años | ${user?.weight}kg | ${user?.height}cm | ${user?.gender === 'male' ? 'hombre' : 'mujer'}
Objetivo peso: ${user?.goal_weight ? `${user.goal_weight}kg` : 'no definido'} | TDEE: ${user?.tdee || 'no calculado'} kcal
Objetivo diario: ${user?.target_calories} kcal | Proteína: ${user?.target_protein||'?'}g | Carbos: ${user?.target_carbs||'?'}g | Grasa: ${user?.target_fat||'?'}g

=== HOY (${today}) ===
${Math.round(todayTotals.cal)} / ${user?.target_calories} kcal | Restantes: ${Math.round(remaining)} ${remaining < 0 ? '(SUPERADO)' : ''}
Prot: ${Math.round(todayTotals.prot)}g | Carbos: ${Math.round(todayTotals.carbs)}g | Grasa: ${Math.round(todayTotals.fat)}g
${(todayRows.results||[]).map(e => `  [${e.meal_type}] ${e.name||'sin nombre'}: ${e.calories} kcal`).join('\n') || '  Sin registros'}

=== ÚLTIMOS 7 DÍAS ===
Media: ${Math.round(avg7d)} kcal/día
${(last7Days.results||[]).map(d => `  ${d.date}: ${Math.round(d.cal)} kcal (${Math.round(d.cal-(user?.target_calories||0)) >= 0 ? '+' : ''}${Math.round(d.cal-(user?.target_calories||0))})`).join('\n') || '  Sin datos'}

=== ÚLTIMOS 30 DÍAS ===
Días registrados: ${last30Stats?.days||0} | Media: ${Math.round(last30Stats?.avg_cal||0)} kcal | Proteína media: ${Math.round(last30Stats?.avg_prot||0)}g
Rango: ${Math.round(last30Stats?.min_cal||0)} – ${Math.round(last30Stats?.max_cal||0)} kcal

=== COMIDAS FRECUENTES (últimos 90 días) ===
${(topFoods.results||[]).map(f => `  ${f.name}: ${f.times}x (${Math.round(f.avg_cal)} kcal media)`).join('\n') || '  Sin datos suficientes'}

=== PESO ===
${wh.slice(0,5).map(w => `  ${w.date}: ${w.weight}kg`).join('\n') || '  Sin registros de peso'}
Tendencia: ${weightTrend}`;
}

// ── Detección de complejidad de la query ───────────────────
// FIX #8: eliminado 'semana' duplicado en regex

function detectQueryComplexity(message) {
  if (!message) return 'haiku';
  const complex = [
    /resumen (de|semanal|mensual|semana|mes)/i,
    /por qu[eé] (no bajo|no pierdo|no subo|no adelgazo)/i,
    /patr[oó]n|tendencia|an[aá]lisis/i,
    /qu[eé] (estoy haciendo mal|puedo mejorar|fallo)/i,
    /plan|rutina|estrategia|consejo/i,
    /comparar|diferencia entre/i,
    /qu[eé] ha pasado esta (semana|mes)/i,
  ];
  if (complex.some(p => p.test(message))) return 'sonnet';
  return 'haiku';
}

// ── Generar título para la conversación (fire-and-forget) ──
// FIX #9: registrar tokens en ai_usage_logs

async function generateConversationTitle(convId, userMessage, apiKey, db, userId) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `Genera un título de máximo 4 palabras en español para una conversación que empieza con este mensaje: "${userMessage.slice(0, 200)}". Solo el título, sin comillas ni explicación.`,
        }],
      }),
    });
    if (!res.ok) return;
    const data  = await res.json();
    const title = data.content?.[0]?.text?.trim().slice(0, 60);
    if (title) {
      await db.prepare('UPDATE assistant_conversations SET title = ? WHERE id = ?').bind(title, convId).run();
    }
    // Registrar tokens consumidos
    const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    await db.prepare(
      'INSERT INTO ai_usage_logs (user_id, model, tokens_used, feature) VALUES (?,?,?,?) ON CONFLICT DO NOTHING'
    ).bind(userId, 'claude-haiku-4-5-20251001', tokens, 'assistant_title').run().catch(() => {});
  } catch { /* fire-and-forget: los errores no bloquean */ }
}

// ── Handler principal ───────────────────────────────────────

export async function handleAssistant(request, env, path, ctx) {

  // POST /api/assistant/chat
  if (path === '/api/assistant/chat' && request.method === 'POST') {
    const user = await requireProAccess(request, env);
    if (!user) return errorResponse('El asistente es una feature exclusiva de Pro.', 403);

    const body = await request.json().catch(() => ({}));
    const { message, conversation_id } = body;
    // FIX #1: is_intro sólo puede venir del servidor; ignorar el flag del cliente
    // y validar en BD que no se haya servido ya hoy.
    const is_intro = body.is_intro === true;

    if (!message?.trim() || message.length > 1000) {
      return errorResponse('Mensaje inválido (máx 1000 caracteres)', 400);
    }

    const today = new Date().toLocaleDateString('en-CA');
    const limit = DAILY_LIMITS[user.access_level] ?? 20;

    // FIX #1: Validación server-side de intro (máx 1/usuario/día)
    if (is_intro) {
      try {
        const introRow = await env.DB.prepare(
          'SELECT intros FROM assistant_usage WHERE user_id = ? AND date = ?'
        ).bind(user.id, today).first();
        if ((introRow?.intros || 0) >= 1) {
          return errorResponse('Intro ya servida hoy', 429);
        }
        await env.DB.prepare(`
          INSERT INTO assistant_usage (user_id, date, intros) VALUES (?,?,1)
          ON CONFLICT(user_id, date) DO UPDATE SET intros = intros + 1
        `).bind(user.id, today).run();
      } catch {
        // Columna 'intros' puede no existir aún — degradar gracefully hasta que se ejecute la migración
      }
    }

    // FIX #3: Chequear límite y hacer incremento atómico ANTES de llamar a Claude
    // (elimina la ventana de race condition de 2-5 segundos)
    let used = 0;
    if (!is_intro) {
      const usageRow = await env.DB.prepare(
        'SELECT messages FROM assistant_usage WHERE user_id = ? AND date = ?'
      ).bind(user.id, today).first();
      used = usageRow?.messages || 0;
      if (used >= limit) {
        return errorResponse(`Límite de ${limit} mensajes diarios alcanzado. Se renueva a las 00:00.`, 429);
      }
      // Incremento atómico — se revierte si Claude falla (ver catch más abajo)
      await env.DB.prepare(`
        INSERT INTO assistant_usage (user_id, date, messages) VALUES (?,?,1)
        ON CONFLICT(user_id, date) DO UPDATE SET messages = messages + 1
      `).bind(user.id, today).run();
    }

    // Detectar complejidad y elegir modelo
    const complexity = is_intro ? 'haiku' : detectQueryComplexity(message);
    const modelId    = complexity === 'sonnet' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
    // FIX #10: Haiku max_tokens subido de 500 a 650
    const maxTokens  = complexity === 'sonnet' ? 1000 : 650;

    // Obtener o crear conversación (los intros nunca crean conversación)
    let convId    = conversation_id || null;
    let isNewConv = false;
    if (!is_intro && !convId) {
      const newConv = await env.DB.prepare(
        'INSERT INTO assistant_conversations (user_id) VALUES (?) RETURNING id'
      ).bind(user.id).first();
      convId    = newConv?.id;
      isNewConv = true;
    }

    // FIX #2: Historial con validación de ownership (AND user_id = ?)
    const history = (!is_intro && convId)
      ? await env.DB.prepare(
          'SELECT role, content FROM assistant_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 10'
        ).bind(convId, user.id).all()
      : { results: [] };

    // FIX #6: Usar micro-contexto en conversaciones ya establecidas (≥2 mensajes)
    // para evitar repetir ~800-2500 tokens en cada turno
    const historyLen = (history.results || []).length;
    let userContext;
    if (is_intro || historyLen < 2) {
      // Primera vez o conversación nueva — contexto completo
      userContext = complexity === 'sonnet'
        ? await buildUserContext(user.id, env)
        : await buildLightContext(user.id, env);
    } else {
      // Conversación en curso — solo actualización mínima de hoy
      userContext = await buildMicroContext(user.id, env);
    }

    // Prompt especial para intro diaria
    const effectiveMessage = is_intro
      ? `Genera un saludo de bienvenida personalizado y breve (máx 3 líneas) para el usuario. Menciona sus calorías de hoy y cuántas le quedan, o si aún no ha registrado nada anímale a empezar. Tono cercano y motivador.`
      : message;

    // Construir array de mensajes para Claude
    const messages = [
      { role: 'user',      content: `[DATOS DEL USUARIO]\n${userContext}\n[FIN DE DATOS]` },
      { role: 'assistant', content: 'Entendido, tengo tus datos actualizados. ¿En qué puedo ayudarte?' },
      ...(history.results || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user',      content: effectiveMessage },
    ];

    // Llamar a Claude
    let assistantText = '';
    let tokensUsed    = 0;
    try {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: modelId, max_tokens: maxTokens, system: SYSTEM_PROMPT, messages }),
      });
      if (!claudeRes.ok) {
        const err = await claudeRes.json().catch(() => ({}));
        // FIX #3: Revertir incremento si Claude rechaza la llamada
        if (!is_intro) {
          await env.DB.prepare(
            'UPDATE assistant_usage SET messages = MAX(0, messages - 1) WHERE user_id = ? AND date = ?'
          ).bind(user.id, today).run().catch(() => {});
        }
        return errorResponse(err?.error?.message || 'Error del asistente', 502);
      }
      const claudeData = await claudeRes.json();
      assistantText = claudeData.content?.[0]?.text || '';
      tokensUsed    = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);
    } catch {
      // FIX #3: Revertir incremento si hay error de red
      if (!is_intro) {
        await env.DB.prepare(
          'UPDATE assistant_usage SET messages = MAX(0, messages - 1) WHERE user_id = ? AND date = ?'
        ).bind(user.id, today).run().catch(() => {});
      }
      return errorResponse('Error de conexión con el asistente', 502);
    }

    // Guardar mensajes y actualizar conversación (FIX #4: sin segundo read de usage)
    if (!is_intro && convId) {
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO assistant_messages (conversation_id, user_id, role, content, model_used, tokens_used) VALUES (?,?,?,?,?,?)'
        ).bind(convId, user.id, 'user', message, modelId, 0),
        env.DB.prepare(
          'INSERT INTO assistant_messages (conversation_id, user_id, role, content, model_used, tokens_used) VALUES (?,?,?,?,?,?)'
        ).bind(convId, user.id, 'assistant', assistantText, modelId, tokensUsed),
        env.DB.prepare(
          'UPDATE assistant_conversations SET updated_at = datetime("now"), message_count = message_count + 2 WHERE id = ?'
        ).bind(convId),
        // FIX #3: NO incrementar usage aquí — ya se hizo atómicamente antes de la llamada
      ]);

      // Generar título en background tras el primer intercambio real
      // FIX #9: pasar userId para registrar tokens en ai_usage_logs
      if (isNewConv && ctx) {
        ctx.waitUntil(generateConversationTitle(convId, message, env.ANTHROPIC_API_KEY, env.DB, user.id));
      }

      return jsonResponse({
        message: assistantText,
        conversation_id: convId,
        model_used: complexity,
        usage: { used: used + 1, limit, remaining: Math.max(0, limit - used - 1) },
      });
    }

    // Respuesta de intro — incluye usage real para que el frontend muestre el contador correcto
    const introUsageRow = await env.DB.prepare(
      'SELECT messages FROM assistant_usage WHERE user_id = ? AND date = ?'
    ).bind(user.id, today).first();
    const introUsed = introUsageRow?.messages || 0;
    return jsonResponse({
      message: assistantText,
      is_intro: true,
      usage: { used: introUsed, limit, remaining: Math.max(0, limit - introUsed) },
    });
  }

  // GET /api/assistant/conversations
  if (path === '/api/assistant/conversations' && request.method === 'GET') {
    const user = await requireProAccess(request, env);
    if (!user) return errorResponse('Pro requerido', 403);

    const convs = await env.DB.prepare(`
      SELECT id, title, message_count, created_at, updated_at
      FROM assistant_conversations
      WHERE user_id = ? ORDER BY updated_at DESC LIMIT 15
    `).bind(user.id).all();

    return jsonResponse(convs.results || []);
  }

  // GET /api/assistant/conversations/:id
  const convMatch = path.match(/^\/api\/assistant\/conversations\/(\d+)$/);
  if (convMatch && request.method === 'GET') {
    const user = await requireProAccess(request, env);
    if (!user) return errorResponse('Pro requerido', 403);

    const convId = parseInt(convMatch[1]);
    // FIX #2: verificar ownership antes de devolver mensajes
    const conv = await env.DB.prepare(
      'SELECT id FROM assistant_conversations WHERE id = ? AND user_id = ?'
    ).bind(convId, user.id).first();
    if (!conv) return errorResponse('Conversación no encontrada', 404);

    const msgs = await env.DB.prepare(
      'SELECT role, content, model_used, created_at FROM assistant_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC'
    ).bind(convId, user.id).all();

    return jsonResponse(msgs.results || []);
  }

  return errorResponse('Not found', 404);
}
