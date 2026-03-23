# Caliro — AI Accuracy Improvement Plan

Three systems. Each analyzed independently, then connected at the end.
Prioritized within each section: P1 = high impact, low effort. P2 = high impact, higher effort.
P3 = lower impact or experimental.

---

## System 1 — Photo Analysis

### How it works today

Claude Haiku Vision receives the image plus a static system prompt with per-100g
reference values and a mandatory component-by-component decomposition process.
The user can optionally add free-text context. Calibration is applied to the result.

### Root causes of inaccuracy

**1. Portion size — the hardest problem**
Without a physical reference in the frame (a hand, a coin, a known-size object),
Claude is estimating portion size purely from visual density and plate fill ratio.
This is the single largest source of error. A "full plate of pasta" could be 300g or 600g
depending on plate diameter and how heaped it is. The current prompt gives no anchor.

**2. Hidden calories**
Oil used in cooking, butter on vegetables, cream in sauces, dressing on salads —
none of these are visible as distinct components. The current prompt assumes
"+30-80kcal" for cooking oil generically. This is too conservative for sautéed dishes
(which can have 100-200kcal of oil) and too high for boiled dishes (which have zero).
Creamy sauces, aioli, alioli, and salad dressings are systematically underestimated.

**3. Restaurant vs home cooking**
The current prompt applies a flat "+25-35% vs casero simple" for restaurants.
But the variance is enormous: a restaurant ensalada mixta may be 200kcal.
A restaurant croquetas plate is 600-900kcal. The flat percentage is misleading —
it should apply to calorie-dense dishes but not to simple salads or grilled items.

**4. Spanish-specific foods**
Claude has broad food knowledge but some Spanish preparations are systematically
miscategorized or underestimated: croquetas (very high fat from frying + bechamel),
tortilla española (depends heavily on oil quantity), patatas bravas (always fried,
often with aioli on top), montaditos/pintxos (bread + toppings in small portions
that add up), cocido madrileño (multiple components, high calorie density),
churros con chocolate. These need explicit reference values.

**5. Multiple dishes in one photo**
If the user photographs a full restaurant table or a tray with multiple items,
Claude tends to estimate the most prominent item and undercount the rest.

**6. Photo angle and quality**
Overhead (top-down) shots hide the height/depth of dishes — a deep bowl of stew
looks like a flat plate. Side-angle shots hide the surface area. Both cause
systematic underestimation for volume-based dishes.

---

### Improvement Plan

**P1 — Pre-photo context: 3 quick taps (client-side + prompt change)**

Before sending the photo, show 3 fast context questions. These take 3 seconds
and dramatically improve the prompt's information:

- "¿Dónde comes?" → Casa / Restaurante / Takeaway / Fast food
- "¿Tamaño del plato?" → Pequeño (20cm) / Normal (26cm) / Grande (30cm) / Bol / Táper
- Optional: free text (already exists)

Map these to explicit prompt instructions:
- "fast_food" → override the +25% restaurant multiplier with specific fast food values
- "pequeño" → Claude should assume portions are 20-30% smaller than a standard plate
- "grande" → assume 20-30% larger

This is the highest-impact change possible. Portion size is the #1 error source
and this gives Claude a concrete reference frame at zero AI cost.

**P1 — Strengthen the oil/sauce rules in the system prompt**

Replace the generic "+30-80kcal aceite" with explicit rules by cooking method:
- Hervido/vapor: +0kcal aceite
- Plancha/horno sin aderezo: +15-30kcal
- Salteado/rehogado: +60-100kcal
- Frito en sartén: +100-180kcal
- Frito en freidora: +150-250kcal
- Salsa cremosa visible (nata, alioli, mayonesa): +100-200kcal según cantidad
- Aliño de ensalada: +80-150kcal según generosidad visible

Claude already detects cooking method reasonably well — the issue is the
current rules don't differentiate. This is a prompt-only change.

**P1 — Add Spanish food explicit reference table to system prompt** ⏳ PENDIENTE (se implementará con la base de datos de alimentos españoles)

Extend the per-100g reference with a "comidas españolas completas" section:
- Croquetas (1 unidad, ~40g): 90-110kcal1
- Tortilla española (ración): 250-380kcal según grosor y aceite
- Patatas bravas (ración): 350-500kcal con salsa
- Bocadillo jamón (estándar): 400-500kcal
- Menú del día (completo): 900-1200kcal
- Paella (ración restaurante): 500-700kcal
- Fabada (ración): 500-650kcal
- Churros con chocolate (ración): 400-600kcal

These are the foods where generic Haiku knowledge is most unreliable for Spain.

**P2 — Explicit multi-item instruction**

Add a rule: "Si la imagen contiene más de un plato o varios alimentos separados,
analiza cada uno individualmente y suma. No analices solo el elemento más prominente."

Add a secondary instruction: "Si el plato principal tiene acompañamientos visibles
(guarnición, pan, bebida), inclúyelos en el total aunque sean secundarios."

**P2 — Confidence-based range output**

When confidence is "media" or "baja", instead of returning a single number,
return a range (min/max). Display in the UI as "480–650 kcal" with a note
"estimación con margen". This is more honest and better calibrated than
false precision. Requires a frontend change to display the range.

**P3 — Two-photo mode**

Allow the user to take a second photo (side angle) if the first was top-down.
The API call sends both images. Haiku Vision supports multiple images in one request.
This would significantly improve accuracy for bowl-type dishes and layered foods.
Higher friction but could be opt-in ("¿Añadir foto lateral?").

---

## System 2 — Text Analysis

### How it works today

A single text input goes to Claude Haiku with a system prompt that instructs
structured JSON output with per-item breakdown. Calibration is applied to the total.
The user provides free text in any format — could be "pollo con arroz" or a full
description of a restaurant meal.

### Root causes of inaccuracy

**1. Quantity ambiguity**
Spanish food language is inherently vague about quantities: "un plato de lentejas",
"un trozo de tortilla", "unas patatas fritas", "algo de pasta". The current prompt
says "ración normal española si no se especifica cantidad" but gives Claude no
anchors for what "normal" means for each dish type. Claude defaults to conservative
estimates — always smaller, always less oil.

**2. Cooking method not specified**
"Pollo" could be grilled (165kcal/100g), roasted (210kcal/100g), fried in batter
(280kcal/100g), or in a creamy sauce (250kcal/100g). The calorie difference across
methods is 70-100%. Users rarely specify the cooking method because it feels obvious
to them. The current prompt doesn't ask Claude to infer it from context clues.

**3. Restaurant composite meals**
"Menú del día", "menú ejecutivo", "pilló el menú" — these are three-course meals
(primero + segundo + postre + pan + bebida) that consistently total 900-1400kcal.
The current prompt has no specific rule for these. Claude tends to estimate just
the main course and ignore the rest.

**4. Branded products treated as generic**
"Un Danone", "un Actimel", "un KitKat", "un Cola-Cao" — Claude has some knowledge
of specific products but it's unreliable and often confuses package size with
serving size. "Un Cola-Cao" could be a glass (250ml, ~180kcal) or the powder
in a spoon (~40kcal). Without product data, estimates are noisy.

**5. Portion descriptor vocabulary**
Spanish uses rich portion vocabulary: "un cazo", "un cucharón", "un puñado",
"un pellizco", "una pizca", "a discreción". The current system prompt has no
conversion table for these informal units. Claude guesses, inconsistently.

**6. Multi-meal entries**
Users sometimes log two meals at once: "desayuno: tostadas con aceite; comida: menú
del día". The system correctly uses the `items` array but the decomposition is
unreliable when the input is long and complex.

---

### Improvement Plan

**P1 — Spanish portion anchor table in system prompt** ⏳ PENDIENTE (se implementará con la base de datos de alimentos españoles)

Add an explicit anchor table to the system prompt for the most common vague
quantity descriptors in Spanish eating context:

```
ANCHORS DE RACIÓN ESPAÑOLA (usar cuando no se especifica cantidad):
- "un plato de" pasta/arroz/legumbres: 300-350g cocinado (~400kcal base)
- "un plato de" ensalada: 200g (~50kcal base, más aliño)
- "un trozo de" tortilla española: 150g (~280kcal)
- "un filete de" carne/pollo: 150-180g
- "un filete de" pescado: 150g
- "una ración de" croquetas: 4-5 unidades (180-220g, ~400kcal)
- "un bocadillo": 200g pan + relleno
- "un sándwich": 60g pan + relleno
- "una tostada": 30g pan
- "un cazo/cucharón": 200ml (~1 ración de sopa/guiso)
- "un puñado de": 30g (frutos secos, cereales)
- "un yogur": 125g
- menú del día completo: 1000-1200kcal SIEMPRE (primero+segundo+pan+postre)
```

This is a pure system prompt change with zero code impact.

**P1 — Cooking method inference instruction**

Add a rule: "Si el método de cocción no se especifica, infiere el más probable
según el contexto (restaurante → más grasa, casero con método no especificado →
asumir plancha/horno). Para carnes y pescados sin especificar: asumir plancha.
Para patatas sin especificar en restaurante: asumir fritas."

This biases toward accuracy for the most common failure case (underestimating
because cooking method was omitted).

**P1 — Menú del día explicit rule**

Add a hard rule: "Si el usuario menciona 'menú del día', 'menú ejecutivo', 'cogí
el menú' u otra expresión similar: estima 1000-1200kcal mínimo. Descompón como:
primero (~350kcal) + segundo (~450kcal) + pan (~150kcal) + postre/bebida (~200kcal).
No estimes solo el plato principal."

**P2 — Low-confidence follow-up question**

When Claude returns `confidence: "low"`, instead of silently returning the estimate,
the response includes a `clarification_question` field. The client displays this
as a small prompt under the result:

_"Estimación: 420 kcal — ¿El pollo era frito o a la plancha? [Frito] [Plancha]"_

Tapping a button sends a refined request with the clarification appended.
This is a two-pass system for genuinely ambiguous entries — only triggers for
low confidence, doesn't add friction to normal use.

Requires: new field in text analysis response, client-side UI change, optional
second API call. The second call is cheap (Haiku, short context).

**P2 — Personal food dictionary (learned corrections)**

When a user corrects a text entry, store the original text description alongside
the correction. Over time, build a personal dictionary: "pollo con patatas" →
this user consistently eats ~550kcal (not the 420 the AI estimated).

Implementation: a new `user_food_patterns` table in D1. When a matching description
is found, include it in the user message as context: "Nota: el usuario ha registrado
'pollo con patatas' antes como ~550kcal en media."

This is different from the calibration engine (which adjusts by category/bias).
This is exact match memory — much more precise for frequently repeated meals.

**P3 — Structured entry mode**

For users who want precision: a form-based entry where they select food from
a list, specify quantity, and cooking method via dropdowns. No AI involved.
Bypasses the vagueness problem entirely for users who are willing to be precise.
More friction, better accuracy. Should be an opt-in mode, not the default.

---

## System 3 — Calibration Engine

### How it works today

The engine (`worker/src/utils/calibration.js`) calculates four factors from
the user's correction history:
- `global_bias`: overall tendency to over/underestimate
- `meal_factors`: bias per meal type (breakfast/lunch/dinner/snack)
- `food_factors`: bias per food category (normalized via CATEGORY_MAP)
- `time_factors`: weekend vs weekday difference

These are applied as a multiplicative factor on top of the AI estimate.
Confidence activates at 2 effective corrections, reaches maximum at 12.

### Weaknesses identified in the current code

**1. No outlier filtering**
A user who accidentally enters 5000kcal (data entry error) and corrects to 500kcal
generates a `correction_pct` of -90%, which is absorbed directly into the global
bias. One extreme outlier can corrupt the entire model. The code has no check for
implausible corrections.

The fix: filter corrections where `Math.abs(correction_pct) > 1.5` (150% correction)
before computing any factor. These are almost certainly data entry errors, not
genuine AI misestimates.

**2. Recency weighting is too mild**
Current: `Math.pow(1.05, i)` where i is the chronological index (0 = oldest).
After 30 corrections, the newest has 4.3x the weight of the oldest. After 60,
it's 18x. The problem: if a user ate differently 6 months ago (bulk phase,
different diet), those old corrections are still dragging the model for weeks.

The fix: switch to time-based decay instead of index-based. A correction from
30 days ago should have half the weight of one from today. 60 days ago, 25%.
This requires storing `created_at` on corrections (already in the schema).

**3. Food factors activate too early (2 samples minimum)**
Currently `food_factors` apply after just 2 corrections in the same category.
With 2 samples, one outlier dominates. The bias estimate is extremely noisy.
The fix: raise the minimum to 5 samples per food category before applying
the food factor. Until then, fall back to global_bias for that category.

**4. Overcorrection cap is too wide**
Current cap: `Math.max(0.7, Math.min(1.8, factor))` — allows up to +80% correction
and down to -30%. A +80% adjustment is massive and likely wrong. If the AI
consistently underestimates by 80%, the prompt is broken, not the calibration.
A more sensible cap: max(0.75, min(1.4, factor)) — max +40%, min -25%.
Beyond that range, the problem is systematic and needs a prompt fix, not
a per-user calibration.

**5. CATEGORY_MAP is too narrow for Spanish food**
The current map covers pasta, chicken, salad, rice, beef, fish, legumes, bread.
Spanish cuisine has systematic blind spots: ibérico products (jamón, chorizo,
morcilla), embutidos, tapas categories (montadito, pincho), tortilla (different
from French omelette), frituras (croquetas, calamares), and processed/packaged
Spanish foods. The map should be extended.

**6. No confidence display for users**
Users have no visibility into whether calibration is active or how strong it is.
This matters because: (a) it would increase motivation to correct, (b) it would
explain why estimates changed for the same dish over time, (c) it would let users
understand the system and trust it more.

The fix: a small indicator in the entry save flow — "La IA ha aprendido de
X correcciones" — and a calibration status in the Profile page showing the
current confidence level and whether it's active.

**7. The `accepted_without_change` signal is underused**
When a user accepts an AI estimate without changing it, this is a positive signal
that the AI was correct. Currently these count as 0.3 effective signal toward
confidence but their `bias` is treated as 0. This is correct in spirit but
the signal could be stronger: a run of 5 consecutive accepted-without-change
entries should actively reduce the global_bias toward zero (the AI is improving).
Currently it only dilutes the bias through averaging — it doesn't actively pull
the model toward zero.

---

### Improvement Plan

**P1 — Outlier filter before bias calculation**

In `calculateCalibrationProfile`, before computing any factor, filter out
corrections where the absolute correction percentage exceeds 150%:

```js
const sanitized = corrections.filter(c => {
  if (c.accepted_without_change) return true; // always keep acceptances
  const pct = Math.abs(c.correction_pct || 0);
  return pct <= 1.5; // discard if user changed by more than 150%
});
```

Use `sanitized` for all bias calculations, keep the original array for
`data_points` count. This is a surgical, low-risk change.

**P1 — Tighten the overcorrection cap**

Change line in `applyCalibration`:
```js
factor = Math.max(0.7, Math.min(1.8, factor)); // current
factor = Math.max(0.75, Math.min(1.4, factor)); // proposed
```

This prevents edge cases where early noisy corrections produce extreme adjustments
that make the app feel broken.

**P1 — Raise food factor minimum samples from 2 to 5**

In `calculateCalibrationProfile`, change:
```js
if (catItems.length >= 2) { // current
if (catItems.length >= 5) { // proposed
```

Same for `meal_factors`: raise from `>= 2` to `>= 3`.

**P1 — Extend CATEGORY_MAP with Spanish foods**

Add to the existing map:
```js
jamon: 'iberico', serrano: 'iberico', lomo: 'iberico', chorizo: 'embutido',
salchichon: 'embutido', morcilla: 'embutido', fuet: 'embutido',
croquetas: 'fritura', calamares: 'fritura', patatas_fritas: 'fritura',
gambas: 'marisco', mejillones: 'marisco', almejas: 'marisco',
tortilla_espanola: 'tortilla', tortilla_patatas: 'tortilla',
lentejas: 'legumbres', garbanzos: 'legumbres', alubias: 'legumbres',
```

**P2 — Time-based decay weighting**

Replace index-based recency weighting with date-based decay.
Each correction gets a weight based on how many days ago it happened:
```js
const daysSince = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
const weight = Math.pow(0.97, daysSince); // halves every ~23 days
```

This requires `created_at` to be included in the calibration query, which
means a small change to the SQL query in `calibration.js` route.
The behavioral change: users whose diet has changed in the last month get
a calibration that quickly adapts to their new patterns.

**P2 — User-facing calibration visibility**

In the Profile page, add a small "Motor de calibración" section:
- If < 2 corrections: "Aún aprendiendo — corrige las estimaciones para activarlo"
- If confidence 0.05-0.3: "Aprendiendo — X correcciones registradas"
- If confidence 0.3-0.7: "Activo — estimaciones ajustadas a tus patrones"
- If confidence > 0.7: "Bien calibrado — X correcciones, alta confianza"

Optionally show which food categories have specific factors learned
("Sabe que tiendes a comer más pasta de lo estimado (+18%)").

This already exists partially in the Admin overlay and the assistant context
(Phase 5 of ASSISTANT_REWORK) — the user-facing version is new.

**P2 — Active pull toward zero for accepted entries**

When a user accepts without changing, currently the entry contributes a bias of 0
to the weighted mean, which passively dilutes the global_bias over time.
The improvement: accepted entries contribute a small active signal toward zero:
```js
const biasSignal = c.accepted_without_change
  ? -(globalBias * 0.05) // gentle pull toward 0
  : calcMixedBias(c);     // actual correction signal
```

This means: if the model has overcorrected and the user is consistently accepting
estimates, the bias gradually self-corrects rather than just being diluted.

**P3 — Per-meal personal dictionary (cross-system)**

See System 2 P2 above. The calibration engine and the text analysis memory system
should share the same correction history. A correction from a photo entry
about "pasta carbonara" should inform the text analysis model's estimate for
"pasta carbonara" and vice versa. This requires a unified correction store
that both systems read from.

---

## Cross-Cutting Improvements

### Signal quality: what makes a good correction

The calibration engine is only as good as the corrections it receives.
Currently any change from AI estimate to user final value is treated as a
correction signal. But some corrections are more reliable than others:
- User changed the calories AND saved immediately → high-quality signal
- User changed calories, then edited again, then deleted → noise
- User reduced by exactly 100kcal → probably rounding, lower signal quality

Consider adding a correction quality score and weighting accordingly.

### The cold start problem across all three systems

New users get zero benefit from calibration, generic portion estimates, and
no personal food dictionary. The app feels less personal until they've used it
enough to generate signal.

A possible mitigation: at the end of onboarding, ask 3 questions about eating style:
1. "¿Comes más bien en casa o fuera?" (Home / Restaurant / Mixed)
2. "¿Cómo describes tus raciones?" (Pequeñas / Normales / Generosas)
3. "¿Sigues algún tipo de dieta?" (Sin restricciones / Mediterránea / Alta proteína / Vegetariana)

These become a lightweight prior for the calibration model — a starting bias
before any corrections are made. Not a full calibration, but it shifts the
default estimates in the right direction from day one.

### Correction friction is too high

The current correction flow requires the user to edit the entry after saving —
tap the entry, find the calorie field, change it, save. This is enough friction
that most users who notice an error simply ignore it rather than correct it.

A better flow: immediately after saving an AI-analyzed entry, show a quick
"¿Parece correcto? [Sí] [Ajustar]" prompt. If they tap "Ajustar", a slider
or quick number input appears. Two taps instead of four navigation steps.
More corrections → better calibration → better accuracy → more trust.

This is a client-side UX change but it has a direct impact on calibration quality.

---

## Suggested Implementation Order

| # | Change | System | Effort | Impact |
|---|--------|--------|--------|--------|
| 1 | Pre-photo context taps (location + plate size) | Photo | Medium | Very High |
| 2 | Oil/sauce rules in photo prompt | Photo | Low | High |
| 3 | Spanish food reference table in photo prompt | Photo | Low | High |
| 4 | Spanish portion anchors in text prompt | Text | Low | High |
| 5 | Menú del día explicit rule | Text | Low | High |
| 6 | Cooking method inference rule | Text | Low | Medium |
| 7 | Outlier filter in calibration | Calibration | Low | Medium |
| 8 | Tighten overcorrection cap | Calibration | Low | Medium |
| 9 | Raise food factor minimum samples | Calibration | Low | Medium |
| 10 | Extend CATEGORY_MAP Spanish foods | Calibration | Low | Medium |
| 11 | Post-save quick correction prompt (UX) | Cross | Medium | Very High |
| 12 | Calibration visibility in Profile | Calibration | Medium | Medium |
| 13 | Time-based decay weighting | Calibration | Medium | Medium |
| 14 | Low-confidence follow-up question | Text | High | High |
| 15 | Personal food dictionary | Cross | High | High |
| 16 | Onboarding eating style prior | Cross | Medium | Medium |
| 17 | Two-photo mode | Photo | High | Medium |
