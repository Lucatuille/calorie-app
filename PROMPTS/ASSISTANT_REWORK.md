Caliro Assistant — Roadmap
Phase 0 — Response quality (pending, quick)
What we agreed on but haven't implemented yet

Rewrite system prompt rules: no preamble, no filler closings, length by question type
Lower max_tokens: Haiku 800→550, Sonnet 1200→900
Fix detectQueryComplexity: remove consejo as standalone trigger, add pattern/habit keywords for future Tier 2 queries
Token impact: neutral to negative (smaller responses = lower cost)

Phase 1 — Meal type context (Tier 2 foundation)
What the assistant needs to stop being a calculator

Add to buildUserContext (Sonnet only — Haiku stays lean):


PATRONES POR TIPO DE COMIDA (últimos 30 días)
  Desayuno:  avg Xkcal | Xg prot | X veces/semana
  Comida:    avg Xkcal | Xg prot | X veces/semana
  Cena:      avg Xkcal | Xg prot | X veces/semana
  Snacks:    avg Xkcal | Xg prot | X veces/semana
Implementation: 1 new SQL query grouped by meal_type. All data already in DB.

Token impact: +120-180 tokens to Sonnet context only. Haiku untouched.

Phase 2 — Day-of-week patterns
The weekend effect

Add to buildUserContext:


PATRONES POR DÍA
  Lunes–Viernes:  avg Xkcal | en objetivo X/Y días
  Sábado–Domingo: avg Xkcal | en objetivo X/Y días
Implementation: SQL with strftime('%w', date) to group weekday vs weekend. One query.

Token impact: +60-80 tokens to Sonnet context only.

Phase 3 — Macro deficit profile
The single most actionable insight for users

Add to buildUserContext:


PERFIL DE MACROS (últimos 30 días)
  Proteína: avg Xg/día vs Xg objetivo → X% (déficit/superávit/ok)
  Carbos:   avg Xg/día vs Xg objetivo → X%
  Grasa:    avg Xg/día vs Xg objetivo → X%
Pre-computed server-side so Claude just reads it, no inference needed.

Token impact: +50-70 tokens. Small, high value.

Phase 4 — System prompt evolution
From answering to pattern surfacing

Two changes to system prompt:

1. Tone shift for Sonnet: When the user asks anything analytical, Claude should first answer the question, then — if it spots something relevant in the context — surface one pattern. Just one, unprompted. Not always, only when genuinely notable.

2. New analytical rules:

For meal type questions: reference the breakdown by type
For "why not losing weight": check weekday vs weekend gap first, then macro deficit profile
For food recommendations: factor in which meal type is being asked about and what that meal type historically looks like for this user


Phase 5 — Calibration integration
Connect the two systems

Add calibration data to assistant context (Sonnet only):


MOTOR DE CALIBRACIÓN
  Confianza: X% (basado en X correcciones)
  Sesgo global: +X% (subestima habitualmente)
  Categorías problemáticas: pasta (+18%), arroz (+12%)
This lets Claude say: "Ojo con el registro de pasta — el motor detecta que tiendes a comer más de lo que parece."

Implementation: read from user_calibration table, already exists. Minimal query.

Token impact: +40-60 tokens, Sonnet only.

Phase 6 — Weekly digest (proactive, no user input)
The killer differentiator

A background endpoint /api/assistant/digest that:

Runs on demand (or triggered weekly from frontend on login)
Builds a rich context snapshot (phases 1-5 data)
Calls Sonnet with a specific prompt: "Genera un resumen de 3 puntos concretos sobre los patrones de esta semana. Cada punto debe ser accionable."
Stores result in DB, surfaces it on next login as a card in the assistant screen
Not a chat message — a card. Looks different from the conversation.

Token impact: one Sonnet call per week per active user. Controlled, predictable.

Token budget overview
Context	Now	After Ph.1-5
Haiku (light)	~500 tokens	~500 tokens (unchanged)
Sonnet (full)	~900 tokens	~1.350 tokens
Micro (ongoing)	~100 tokens	~100 tokens (unchanged)
Sonnet at 1.350 input + max 900 output = ~2.250 tokens per complex query. Haiku stays completely lean — quick questions never pay the Tier 2 cost.

Complexity routing — final state

HAIKU  → status questions, food suggestions, simple counts
SONNET → weekly/monthly analysis, pattern questions, "why", meal habits,
          deficit profiles, anything mentioning meal type patterns
The detectQueryComplexity function needs about 4-5 new triggers added alongside Phase 1-3 to make sure pattern questions always route to Sonnet where the rich context lives.

Order of implementation

Phase 0  → response quality          (30min, pure system prompt + config)
Phase 1  → meal type context         (1h, 1 SQL query + context string)
Phase 2  → day-of-week patterns      (30min, 1 SQL query)
Phase 3  → macro deficit profile     (30min, computed from existing query)
Phase 4  → system prompt evolution   (45min, prompt engineering)
Phase 5  → calibration integration   (30min, 1 DB read)
Phase 6  → weekly digest             (2-3h, new endpoint + frontend card)
Total: roughly one focused session per phase. Phases 0-3 are purely additive — no risk, no schema changes, all data already in the DB. Phase 6 is the only one requiring new frontend work.

When you're ready, we start with Phase 0.


