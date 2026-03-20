// ============================================================
//  ASSISTANT ROUTE — /api/assistant/*
//  Asistente nutricional personal con IA (feature Pro)
//
//  PREREQUISITO DE BD — ejecutar una vez en D1 si no existe:
//  ALTER TABLE assistant_usage ADD COLUMN intros INTEGER DEFAULT 0;
// ============================================================

import { jsonResponse, errorResponse, requireProAccess, proAccessDenied } from '../utils.js';

// ── Límites diarios por nivel ───────────────────────────────

// Beta(1): 15 mensajes/día | Pro(2): 30 mensajes/día | Admin(99): sin límite práctico
const DAILY_LIMITS = { 1: 15, 2: 30, 99: 999 };
// Sonnet: max 1/usuario/dia — downgrade silencioso si se supera
const SONNET_DAILY_LIMIT = 1;

// ── System prompt del asistente ────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente nutricional personal de Caliro. Tienes acceso completo a los datos reales del usuario y respondes con información específica y personalizada.

PERSONALIDAD:
- Cercano y motivador, nunca condescendiente
- Directo — vas al grano con datos concretos
- Honesto — si algo no va bien, lo dices con tacto
- Positivo pero realista — no generas expectativas falsas

FORMATO:
- Sin frases de introducción ("¡Claro!", "Entendido, voy a ver tus datos...") ni cierres vacíos ("¿Alguna duda?", "¡Sigue así!"). Empieza siempre por la respuesta. La calidez viene del tono y de usar los datos reales, no de los formulismos.
- Estado del día (¿cómo voy?, ¿cuántas kcal?, ¿qué me falta?): 2-3 líneas. Los datos en contexto, no sueltos.
- Recomendación de alimento: máx 4 opciones concretas, una por línea con kcal aproximadas.
- Análisis complejo (semana, patrones, por qué…): máx 3 secciones con ###, 2-3 líneas cada una. Sin relleno.
- Al responder preguntas de análisis (cuando el contexto incluya PATRONES o PERFIL DE MACROS): si detectas UN patrón claro no preguntado pero relevante (p.ej. fines de semana >15% sobre objetivo, proteína sistemáticamente baja, tendencia en 7 días), añádelo al final como "Además: [observación concreta]". Solo uno, solo si es genuinamente accionable.

REGLAS:
1. SIEMPRE usa los datos reales del usuario. Nunca inventes ni aproximes — si el dato exacto está en el contexto, úsalo.
2. Cuando menciones números, sé preciso (1.820 kcal, no "alrededor de 1.800")
3. Si el usuario pregunta algo que no está en sus datos, díselo honestamente
4. NUNCA hagas diagnósticos médicos ni recomendaciones clínicas
5. Si detectas algo preocupante (muy pocas calorías, patrones extremos), menciona consultar con un profesional
6. Responde siempre en español
7. Usa emojis con moderación (1-2 por respuesta máximo)
8. Para listas de comidas: "Nombre — X kcal"
9. Interpreta el objetivo del usuario: si goal_weight < weight → quiere perder peso; si goal_weight > weight → quiere ganar; si son iguales o goal_weight no definido → mantenimiento. Adapta los consejos a este objetivo.
10. Si hay pocos días de datos (< 5 días registrados), recónocelo antes de sacar conclusiones.
11. Cuando el contexto incluya PERFIL DE MACROS, PATRONES POR DÍA o PATRONES POR TIPO DE COMIDA, úsalos activamente — no los ignores.
12. El "Además:" solo aparece una vez por respuesta y solo si la observación es concreta y accionable.

Cuando la pregunta sea sobre salud o recomendaciones médicas, añade al final en una línea aparte:
"ⓘ Soy una herramienta de seguimiento, no un profesional sanitario.""ⓘ Soy una herramienta de seguimiento, no un profesional sanitario."`

const DIGEST_SYSTEM_PROMPT = `Eres el asistente nutricional de Caliro. Genera un resumen semanal basado en datos reales.

Formato exacto — exactamente 3 puntos, nada antes ni después del primero:

### [Título 3-4 palabras]
[Observación concreta con números reales. Máx 2 líneas. Accionable.]

### [Título 3-4 palabras]
[Observación concreta con números reales. Máx 2 líneas. Accionable.]

### [Título 3-4 palabras]
[Observación concreta con números reales. Máx 2 líneas. Accionable.]

Reglas:
- Usa SOLO los datos del contexto. Nunca inventes.
- Prioriza: adherencia al objetivo calórico > macros vs objetivos > patrones día/tipo comida > calibración
- Si hay un patrón claro con números (fines de semana +X% sobre objetivo, proteína -X%, categoría con sesgo notable en calibración), menéionalo con exactitud
- Responde en español`;

// ── Helper: nombre del día en español ──────────────────────

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function todayLabel() {
  const now = new Date();
  return `${DAY_NAMES[now.getDay()]} ${now.toLocaleDateString('en-CA')}`;
}

function getWeekStart() {
  const d   = new Date();
  const day = d.getUTCDay(); // 0=Dom, 1=Lun...
  const diff = day === 0 ? -6 : 1 - day; // retroceder al lunes
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0]; // "2026-03-16"
}

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

  const target7   = user?.target_calories || 0;
  const onTarget7 = (last7Days.results||[]).filter(d => Math.abs(d.cal - target7) <= 250).length;
  const total7    = (last7Days.results||[]).length;

  return `Hoy: ${todayLabel()}

=== PERFIL ===
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
En objetivo (±250kcal): ${onTarget7}/${total7 || 0} días
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
  return `[Datos actualizados ${todayLabel()}: ${Math.round(cal)} kcal consumidas, ${Math.round(remaining)} restantes | Prot: ${Math.round(todayTotals?.prot||0)}g | Carbos: ${Math.round(todayTotals?.carbs||0)}g | Grasa: ${Math.round(todayTotals?.fat||0)}g]`;
}

// ── Contexto completo — Sonnet, primera vez (~2200 tokens) ──

async function buildUserContext(userId, env) {
  const today    = new Date().toLocaleDateString('en-CA');
  const weekAgo  = new Date(Date.now() - 7  * 86400000).toLocaleDateString('en-CA');
  const monthAgo = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA');

  const [user, todayRows, last7Days, last30Stats, topFoods, weightHistory, mealTypes, allDays30, calibRow] =
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
               AVG(dcarbs) as avg_carbs, AVG(dfat) as avg_fat,
               MIN(dc) as min_cal, MAX(dc) as max_cal, COUNT(*) as days
        FROM (SELECT date, SUM(calories) as dc, SUM(protein) as dp,
                     SUM(carbs) as dcarbs, SUM(fat) as dfat
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

      // Meal type breakdown — avg per occasion, frequency vs active days
      env.DB.prepare(`
        SELECT
          meal_type,
          ROUND(SUM(calories) * 1.0 / COUNT(DISTINCT date)) as avg_kcal,
          ROUND(SUM(protein)  * 1.0 / COUNT(DISTINCT date)) as avg_prot,
          COUNT(DISTINCT date) as meal_days
        FROM entries
        WHERE user_id = ? AND date >= ? AND date < ?
          AND meal_type IS NOT NULL AND meal_type != ''
        GROUP BY meal_type
        ORDER BY CASE meal_type
          WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2
          WHEN 'dinner'    THEN 3 WHEN 'snack' THEN 4 ELSE 5 END
      `).bind(userId, monthAgo, today).all(),

      // Per-day totals for 30 days — needed for weekday/weekend split in JS
      env.DB.prepare(`
        SELECT date, SUM(calories) as cal
        FROM entries
        WHERE user_id = ? AND date >= ? AND date < ?
        GROUP BY date ORDER BY date DESC
      `).bind(userId, monthAgo, today).all(),

      // Motor de calibración — solo se lee, no bloquea si falta la tabla
      env.DB.prepare(
        'SELECT global_bias, confidence, data_points, food_factors FROM user_calibration WHERE user_id = ?'
      ).bind(userId).first().catch(() => null),
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

  const targetCal  = user?.target_calories || 0;
  const onTarget7  = (last7Days.results||[]).filter(d => Math.abs(d.cal - targetCal) <= 250).length;
  const total7days = (last7Days.results||[]).length;

  // Meal type breakdown — normalize frequency against active days (not calendar days)
  const activeDays30 = Math.max(last30Stats?.days || 1, 1);
  const MEAL_LABELS  = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Snack', other: 'Otro' };
  const mealPattern  = (mealTypes.results || [])
    .filter(m => m.meal_days >= 3)  // skip noise from single-use meal types
    .map(m => {
      const label = (MEAL_LABELS[m.meal_type] || m.meal_type).padEnd(9);
      const freq  = Math.min((m.meal_days / activeDays30) * 7, 7).toFixed(1);
      return `  ${label} ~${m.avg_kcal} kcal | ${m.avg_prot}g prot | ${freq}x/sem`;
    })
    .join('\n') || '  Sin suficientes datos';

  // Weekday vs weekend — split allDays30 by day-of-week
  // T12:00:00Z anchors to UTC noon to avoid day-boundary issues in CF Workers
  const splitByDow = (rows) => {
    const wd = [], we = [];
    (rows || []).forEach(d => {
      const dow = new Date(d.date + 'T12:00:00Z').getDay(); // 0=Sun, 6=Sat
      (dow === 0 || dow === 6 ? we : wd).push(d);
    });
    return { wd, we };
  };
  const summarizeDow = (rows) => {
    if (rows.length < 2) return null;
    const avg = Math.round(rows.reduce((s, d) => s + d.cal, 0) / rows.length);
    const onT = rows.filter(d => Math.abs(d.cal - targetCal) <= 250).length;
    return { avg, onT, total: rows.length, pct: Math.round((onT / rows.length) * 100) };
  };
  const { wd: wdRows, we: weRows } = splitByDow(allDays30.results);
  const wdSum = summarizeDow(wdRows);
  const weSum = summarizeDow(weRows);
  const fmtDow = (label, s) =>
    `  ${label}: ~${s.avg} kcal/día | en objetivo ${s.onT}/${s.total} días (${s.pct}%)`;
  const dowPattern = [
    wdSum ? fmtDow('Lun\u2013Vie', wdSum) : null,
    weSum ? fmtDow('S\u00e1b\u2013Dom', weSum) : null,
  ].filter(Boolean).join('\n') || '  Sin suficientes datos';

  // Macro deficit profile — pre-computed labels so Claude reads conclusions, not raw numbers
  const macroProfile = (() => {
    const avgProt  = Math.round(last30Stats?.avg_prot  || 0);
    const avgCarbs = Math.round(last30Stats?.avg_carbs || 0);
    const avgFat   = Math.round(last30Stats?.avg_fat   || 0);
    const tgtProt  = user?.target_protein || 0;
    const tgtCarbs = user?.target_carbs   || 0;
    const tgtFat   = user?.target_fat     || 0;
    const fmtMacro = (avg, tgt, name) => {
      if (!tgt) return `  ${name.padEnd(10)} ${avg}g/día (sin objetivo definido)`;
      const pct = Math.round(((avg - tgt) / tgt) * 100);
      const tag = Math.abs(pct) <= 5 ? 'en objetivo'
                : pct > 0 ? `+${pct}% superávit`
                : `${pct}% déficit`;
      return `  ${name.padEnd(10)} ${avg}g/día vs ${tgt}g objetivo → ${tag}`;
    };
    return [
      fmtMacro(avgProt,  tgtProt,  'Prote\u00edna'),
      fmtMacro(avgCarbs, tgtCarbs, 'Carbos'),
      fmtMacro(avgFat,   tgtFat,   'Grasa'),
    ].join('\n');
  })();

  // Calibration section — solo Sonnet y solo si hay datos suficientes (confidence >= 15%)
  const calibSection = (() => {
    if (!calibRow || (calibRow.confidence || 0) < 0.15) return '';
    const conf    = Math.round((calibRow.confidence || 0) * 100);
    const pts     = calibRow.data_points || 0;
    const bias    = calibRow.global_bias || 0;
    const biasTag = Math.abs(bias) < 0.05
      ? 'calibrado (sesgo mínimo)'
      : bias > 0
        ? `+${Math.round(bias * 100)}% (subestima habitualmente)`
        : `${Math.round(bias * 100)}% (sobreestima habitualmente)`;
    let foodLine = '';
    try {
      const ff = JSON.parse(calibRow.food_factors || '{}');
      const notable = Object.entries(ff)
        .filter(([, v]) => Math.abs(v.bias) >= 0.10 && (v.samples || 0) >= 2)
        .sort((a, b) => Math.abs(b[1].bias) - Math.abs(a[1].bias))
        .slice(0, 3)
        .map(([cat, v]) => `${cat} (${v.bias > 0 ? '+' : ''}${Math.round(v.bias * 100)}%)`);
      if (notable.length) foodLine = `
  Categorías con sesgo: ${notable.join(', ')}`;
    } catch {}
    return `

=== MOTOR DE CALIBRACIÓN ===
  Confianza: ${conf}% (${pts} correcciones) | Sesgo: ${biasTag}${foodLine}`;
  })();

  return `Hoy: ${todayLabel()}

=== PERFIL ===
${user?.name} | ${user?.age} años | ${user?.weight}kg | ${user?.height}cm | ${user?.gender === 'male' ? 'hombre' : 'mujer'}
Objetivo peso: ${user?.goal_weight ? `${user.goal_weight}kg` : 'no definido'} | TDEE: ${user?.tdee || 'no calculado'} kcal
Objetivo diario: ${user?.target_calories} kcal | Proteína: ${user?.target_protein||'?'}g | Carbos: ${user?.target_carbs||'?'}g | Grasa: ${user?.target_fat||'?'}g

=== HOY (${today}) ===
${Math.round(todayTotals.cal)} / ${user?.target_calories} kcal | Restantes: ${Math.round(remaining)} ${remaining < 0 ? '(SUPERADO)' : ''}
Prot: ${Math.round(todayTotals.prot)}g | Carbos: ${Math.round(todayTotals.carbs)}g | Grasa: ${Math.round(todayTotals.fat)}g
${(todayRows.results||[]).map(e => `  [${e.meal_type}] ${e.name||'sin nombre'}: ${e.calories} kcal`).join('\n') || '  Sin registros'}

=== ÚLTIMOS 7 DÍAS ===
Media: ${Math.round(avg7d)} kcal/día | En objetivo (±250kcal): ${onTarget7}/${total7days || 0} días
${(last7Days.results||[]).map(d => `  ${d.date}: ${Math.round(d.cal)} kcal (${Math.round(d.cal-(user?.target_calories||0)) >= 0 ? '+' : ''}${Math.round(d.cal-(user?.target_calories||0))})`).join('\n') || '  Sin datos'}

=== ÚLTIMOS 30 DÍAS ===
Días registrados: ${last30Stats?.days||0} | Media: ${Math.round(last30Stats?.avg_cal||0)} kcal | Proteína media: ${Math.round(last30Stats?.avg_prot||0)}g
Rango: ${Math.round(last30Stats?.min_cal||0)} – ${Math.round(last30Stats?.max_cal||0)} kcal

=== PERFIL DE MACROS (últimos 30 días) ===
${macroProfile}

=== PATRONES POR DÍA (últimos 30 días) ===
${dowPattern}

=== PATRONES POR TIPO DE COMIDA (últimos 30 días) ===
${mealPattern}

=== COMIDAS FRECUENTES (últimos 90 días) ===
${(topFoods.results||[]).map(f => `  ${f.name}: ${f.times}x (${Math.round(f.avg_cal)} kcal media)`).join('\n') || '  Sin datos suficientes'}${calibSection}

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
    /plan (de |nutricional|semanal|mensual)|rutina|estrategia/i,
    // hábito/alimentación/déficit/superávit — removed, answerable with Haiku light context
    /mis (desayunos|comidas|cenas|snacks|meriendas)|por tipo de comida/i,
    /fin(es)? de semana|entre semana|d[\u00ed]as? de la semana/i,
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
    if (!user || user === 'waitlist') return proAccessDenied(user);

    const body = await request.json().catch(() => ({}));
    const { message, conversation_id } = body;
    // FIX #1: is_intro sólo puede venir del servidor; ignorar el flag del cliente
    // y validar en BD que no se haya servido ya hoy.
    const is_intro = body.is_intro === true;

    if (!message?.trim() || message.length > 1000) {
      return errorResponse('Mensaje inválido (máx 1000 caracteres)', 400);
    }

    const today = new Date().toLocaleDateString('en-CA');
    const limit = DAILY_LIMITS[user.access_level] ?? 0; // fail-safe: nivel desconocido = sin acceso

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
    let complexity = is_intro ? 'haiku' : detectQueryComplexity(message);

    // Sonnet budget: max 1/usuario/dia — downgrade silencioso si se supera
    if (complexity === 'sonnet' && !is_intro) {
      try {
        const sonnetRow = await env.DB.prepare(
          'SELECT sonnet_count FROM assistant_usage WHERE user_id = ? AND date = ?'
        ).bind(user.id, today).first();
        if ((sonnetRow?.sonnet_count || 0) >= SONNET_DAILY_LIMIT) complexity = 'haiku';
      } catch { /* DB error: allow Sonnet */ }
    }

    const modelId    = complexity === 'sonnet' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
    const maxTokens  = complexity === 'sonnet' ? 900 : 550;

    // Incrementar Sonnet counter atomicamente antes de la llamada
    if (complexity === 'sonnet' && !is_intro) {
      await env.DB.prepare(`
        INSERT INTO assistant_usage (user_id, date, sonnet_count) VALUES (?,?,1)
        ON CONFLICT(user_id, date) DO UPDATE SET sonnet_count = sonnet_count + 1
      `).bind(user.id, today).run().catch(() => {});
    }

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
      if (claudeData.stop_reason === 'max_tokens') {
        if (!is_intro) {
          await env.DB.prepare(
            'UPDATE assistant_usage SET messages = MAX(0, messages - 1) WHERE user_id = ? AND date = ?'
          ).bind(user.id, today).run().catch(() => {});
        }
        return errorResponse('La respuesta fue demasiado larga. Intenta con una pregunta más concreta.', 422);
      }
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

  // GET /api/assistant/usage — contador diario + resumen de hoy (para el saludo)
  if (path === '/api/assistant/usage' && request.method === 'GET') {
    const user = await requireProAccess(request, env);
    if (!user || user === 'waitlist') return proAccessDenied(user);

    const today = new Date().toLocaleDateString('en-CA');
    const limit = DAILY_LIMITS[user.access_level] ?? 0; // fail-safe: nivel desconocido = sin acceso

    const [usageRow, todayRow, profileRow] = await Promise.all([
      env.DB.prepare('SELECT messages FROM assistant_usage WHERE user_id = ? AND date = ?').bind(user.id, today).first(),
      env.DB.prepare('SELECT SUM(calories) as cal, SUM(protein) as prot FROM entries WHERE user_id = ? AND date = ?').bind(user.id, today).first(),
      env.DB.prepare('SELECT target_calories, target_protein FROM users WHERE id = ?').bind(user.id).first(),
    ]);

    const used           = usageRow?.messages || 0;
    const cal            = Math.round(todayRow?.cal  || 0);
    const prot           = Math.round(todayRow?.prot || 0);
    const target         = profileRow?.target_calories || 0;
    const targetProtein  = profileRow?.target_protein  || null;
    const remaining      = Math.max(0, target - cal);

    return jsonResponse({
      usage: { used, limit, remaining: Math.max(0, limit - used) },
      today: { cal, prot, target, target_protein: targetProtein, remaining_cal: remaining },
    });
  }

  // GET /api/assistant/conversations
  if (path === '/api/assistant/conversations' && request.method === 'GET') {
    const user = await requireProAccess(request, env);
    if (!user || user === 'waitlist') return proAccessDenied(user);

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
    if (!user || user === 'waitlist') return proAccessDenied(user);

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

  // GET /api/assistant/digest — resumen semanal (1 Sonnet/semana/usuario, solo si activo)
  if (path === '/api/assistant/digest' && request.method === 'GET') {
    const user = await requireProAccess(request, env);
    if (!user || user === 'waitlist') return proAccessDenied(user);
    try {
      const weekStart = getWeekStart();

      // Devolver digest cacheado si ya existe esta semana
      const existing = await env.DB.prepare(
        'SELECT content, generated_at FROM assistant_digests WHERE user_id = ? AND week_start = ?'
      ).bind(user.id, weekStart).first();
      if (existing) {
        return jsonResponse({ digest: { content: existing.content, generated_at: existing.generated_at } });
      }

      // Solo generar si el usuario tiene >= 5 dias registrados en los ultimos 14
      const activity = await env.DB.prepare(`
        SELECT COUNT(DISTINCT date) as active_days
        FROM entries WHERE user_id = ? AND date >= date('now', '-14 days')
      `).bind(user.id).first();
      if ((activity?.active_days || 0) < 5) {
        return jsonResponse({ digest: null, reason: 'insufficient_data' });
      }

      // Construir contexto completo y llamar a Sonnet
      const context = await buildUserContext(user.id, env);
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 350,
          system: DIGEST_SYSTEM_PROMPT,
          messages: [
            { role: 'user',      content: `[DATOS DEL USUARIO]\n${context}\n[FIN DE DATOS]` },
            { role: 'assistant', content: 'Entendido.' },
            { role: 'user',      content: 'Genera el resumen semanal.' },
          ],
        }),
      });
      if (!claudeRes.ok) return jsonResponse({ digest: null, reason: 'api_error' });
      const claudeData = await claudeRes.json();
      if (claudeData.stop_reason === 'max_tokens') return jsonResponse({ digest: null, reason: 'too_long' });
      const digestText = claudeData.content?.[0]?.text?.trim() || '';
      if (!digestText) return jsonResponse({ digest: null, reason: 'empty' });

      // Persistir — ON CONFLICT evita duplicados en condiciones de carrera
      const generatedAt = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO assistant_digests (user_id, week_start, content, generated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, week_start) DO NOTHING
      `).bind(user.id, weekStart, digestText, generatedAt).run().catch(() => {});

      return jsonResponse({ digest: { content: digestText, generated_at: generatedAt } });
    } catch {
      return jsonResponse({ digest: null, reason: 'error' }); // nunca rompe la UI
    }
  }

  return errorResponse('Not found', 404);
}
