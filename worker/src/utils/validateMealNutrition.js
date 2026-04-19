// ============================================================
//  validateMealNutrition — coherencia kcal declarado vs ingredientes.
//
//  Problema detectado 2026-04-17: Sonnet a veces devuelve platos con
//  kcal severamente sub-estimado respecto a los ingredientes que él
//  mismo lista. Ejemplo real reportado: "Dorada al horno con verduras
//  — 279 kcal" con 218g dorada + 13ml aceite + verduras. La cena real
//  lleva ~520 kcal; Sonnet se inventa 279.
//
//  Esta util estima kcal desde los gramos/ml de ingredientes usando
//  una tabla de densidades calóricas (cocina mediterránea/española).
//  Si el declarado se desvía >25% del estimado (cuando la cobertura
//  de ingredientes reconocidos es suficiente), flaguea el meal como
//  coherencia sospechosa.
//
//  NO rechaza el plan — emite warning. El usuario decide si regenerar.
//  Razón: la tabla no cubre todo; un false positive sería más molesto
//  que un false negative silencioso.
// ============================================================

/**
 * Tabla de densidades calóricas. Valores por 100g (sólidos) o por ml
 * (líquidos). Pragmática, no exhaustiva — cubre los ingredientes
 * frecuentes de cocina mediterránea/española que suele sugerir Chef.
 *
 * Orden importa en el matching: keywords más específicos primero
 * (ej. "pechuga de pollo" antes que "pollo"), para evitar que el match
 * genérico gane sobre el específico.
 *
 * density: kcal por 100g (sólidos) o kcal por ml (líquidos).
 * unit:    'g' sólido, 'ml' líquido.
 */
const DENSITY_TABLE = [
  // ── LÍQUIDOS / GRASAS (ml) ──────────────────────────────────
  { keywords: ['aove', 'aceite de oliva virgen extra', 'aceite oliva', 'aceite'], density: 9.0,  unit: 'ml' },
  { keywords: ['mantequilla'],                                                    density: 7.2,  unit: 'ml' }, // 720 kcal/100g ≈ 7.2/ml
  { keywords: ['nata'],                                                           density: 3.4,  unit: 'ml' },
  { keywords: ['leche desnatada'],                                                density: 0.35, unit: 'ml' },
  { keywords: ['leche semi', 'leche semidesnatada'],                              density: 0.47, unit: 'ml' },
  { keywords: ['leche entera', 'leche'],                                          density: 0.62, unit: 'ml' },
  { keywords: ['caldo de pollo', 'caldo de verduras', 'caldo'],                   density: 0.12, unit: 'ml' },
  { keywords: ['vinagre'],                                                        density: 0.20, unit: 'ml' },
  { keywords: ['zumo de naranja', 'zumo'],                                        density: 0.45, unit: 'ml' },

  // ── CARNES (g, kcal/100g) ───────────────────────────────────
  { keywords: ['pechuga de pollo', 'pechuga pollo'],         density: 165, unit: 'g' },
  { keywords: ['muslo de pollo', 'muslo pollo'],             density: 180, unit: 'g' },
  { keywords: ['pollo'],                                     density: 170, unit: 'g' },
  { keywords: ['pechuga de pavo', 'pechuga pavo', 'pavo'],   density: 110, unit: 'g' },
  // 'solomillo' genérico ambiguo (cerdo 143 vs ternera 160) — solo matcheamos
  // explícitos. Lo mismo para 'lomo'.
  { keywords: ['solomillo de cerdo'],                        density: 143, unit: 'g' },
  { keywords: ['lomo de cerdo', 'lomo'],                     density: 165, unit: 'g' },
  { keywords: ['cerdo'],                                     density: 242, unit: 'g' },
  // Específicos primero, general al final. Si "ternera" fuera antes, matchearía
  // "carne picada de ternera" y daría 150 kcal/100g (falso bajo — era el bug
  // del banner rojo false positive en hamburguesa).
  { keywords: ['solomillo de ternera'],                      density: 160, unit: 'g' },
  { keywords: ['carne picada'],                              density: 200, unit: 'g' },
  { keywords: ['vacuno', 'filete'],                          density: 220, unit: 'g' },
  { keywords: ['ternera magra', 'ternera'],                  density: 150, unit: 'g' },
  { keywords: ['jamón serrano', 'jamon serrano'],            density: 250, unit: 'g' },
  { keywords: ['jamón cocido', 'jamon cocido', 'fiambre'],   density: 125, unit: 'g' },
  { keywords: ['chorizo'],                                   density: 450, unit: 'g' },

  // ── PESCADOS (g) ────────────────────────────────────────────
  { keywords: ['merluza'],                                   density: 85,  unit: 'g' },
  { keywords: ['bacalao fresco', 'bacalao'],                 density: 82,  unit: 'g' },
  { keywords: ['lubina'],                                    density: 95,  unit: 'g' },
  { keywords: ['dorada'],                                    density: 195, unit: 'g' }, // entera con piel
  { keywords: ['salmón', 'salmon'],                          density: 208, unit: 'g' },
  { keywords: ['atún fresco', 'atun fresco'],                density: 144, unit: 'g' },
  { keywords: ['atún en aceite', 'atun en aceite'],          density: 189, unit: 'g' },
  { keywords: ['atún al natural', 'atun al natural', 'atún', 'atun'], density: 108, unit: 'g' },
  { keywords: ['sardinas'],                                  density: 208, unit: 'g' },
  { keywords: ['boquerones'],                                density: 130, unit: 'g' },
  { keywords: ['gambas', 'langostinos'],                     density: 85,  unit: 'g' },
  { keywords: ['calamares'],                                 density: 92,  unit: 'g' },
  { keywords: ['pulpo'],                                     density: 82,  unit: 'g' },
  { keywords: ['mejillones'],                                density: 86,  unit: 'g' },

  // ── HUEVOS / LÁCTEOS (g) ────────────────────────────────────
  { keywords: ['clara de huevo', 'clara'],                   density: 50,  unit: 'g' },
  { keywords: ['yema de huevo', 'yema'],                     density: 320, unit: 'g' },
  { keywords: ['huevo'],                                     density: 143, unit: 'g' }, // 1 huevo ~50g ~72kcal
  // Yogur griego: rango real 60-150 kcal/100g según marca (full fat vs 0%
  // vs sin lactosa, que suele ser más ligero). 90 es punto medio pragmático
  // que evita false positives con las variedades light/sin lactosa más
  // populares sin inflar demasiado con full-fat.
  { keywords: ['yogur griego', 'yogur proteico'],            density: 90,  unit: 'g' },
  { keywords: ['yogur natural', 'yogur'],                    density: 61,  unit: 'g' },
  { keywords: ['queso fresco batido', 'requesón', 'requeson'], density: 75, unit: 'g' },
  { keywords: ['queso fresco'],                              density: 98,  unit: 'g' },
  { keywords: ['queso mozzarella', 'mozzarella'],            density: 280, unit: 'g' },
  { keywords: ['queso curado', 'manchego'],                  density: 380, unit: 'g' },
  { keywords: ['queso'],                                     density: 350, unit: 'g' }, // fallback genérico queso curado

  // ── CEREALES / PASTA / PAN (g) ──────────────────────────────
  // Default NO modificador = cocido. Razón: en un plato servido, "90g arroz"
  // casi siempre significa el peso YA cocido, no crudo. Tratar crudo como
  // default inflaba kcal por 2.5-3× y disparaba false positives del validador
  // (ver screenshot 2026-04-19: arroz con pollo 628 declarado vs 873 estimado).
  // "arroz crudo" / "pasta cruda" explícitos siguen matcheando su densidad real.
  { keywords: ['arroz crudo'],                               density: 365, unit: 'g' },
  { keywords: ['arroz cocido', 'arroz'],                     density: 130, unit: 'g' }, // default = cocido
  { keywords: ['pasta cruda', 'espaguetis crudos', 'macarrones crudos'], density: 370, unit: 'g' },
  { keywords: ['pasta cocida', 'espaguetis cocidos', 'pasta', 'espaguetis', 'macarrones', 'fideos', 'tallarines'], density: 131, unit: 'g' },
  { keywords: ['pan integral'],                              density: 245, unit: 'g' },
  { keywords: ['pan'],                                       density: 265, unit: 'g' },
  { keywords: ['tostada'],                                   density: 380, unit: 'g' },
  // Avena se queda en crudo: en desayuno se pesa seca antes de cocinar,
  // Sonnet típicamente dice "60g avena" = 60g en crudo.
  { keywords: ['avena'],                                     density: 380, unit: 'g' },
  { keywords: ['quinoa cruda'],                              density: 368, unit: 'g' },
  { keywords: ['quinoa cocida', 'quinoa'],                   density: 120, unit: 'g' }, // default = cocida
  { keywords: ['cuscús', 'cuscus', 'couscous'],              density: 112, unit: 'g' }, // cocido

  // ── LEGUMBRES (g) ───────────────────────────────────────────
  { keywords: ['lentejas cocidas'],                          density: 115, unit: 'g' },
  { keywords: ['lentejas'],                                  density: 115, unit: 'g' }, // Sonnet casi siempre habla cocidas en plato
  { keywords: ['garbanzos cocidos'],                         density: 140, unit: 'g' },
  { keywords: ['garbanzos'],                                 density: 140, unit: 'g' },
  // 'judías verdes' PRIMERO — antes de cualquier row que mencione 'judías'.
  // Sin esto, "100g judías verdes" matchearía 'judías' (125 kcal legumbre)
  // en vez de la verdura (31 kcal). El orden de rows gana.
  { keywords: ['judías verdes', 'judias verdes'],            density: 31,  unit: 'g' },
  { keywords: ['alubias cocidas', 'judías cocidas', 'judias cocidas'], density: 125, unit: 'g' },
  { keywords: ['alubias', 'judías', 'judias'],               density: 125, unit: 'g' },
  { keywords: ['tofu'],                                      density: 76,  unit: 'g' },
  { keywords: ['tempeh'],                                    density: 190, unit: 'g' },
  { keywords: ['seitán', 'seitan'],                          density: 150, unit: 'g' },

  // ── VERDURAS (g, kcal/100g bajos) ───────────────────────────
  { keywords: ['brócoli', 'brocoli'],                        density: 35,  unit: 'g' },
  { keywords: ['coliflor'],                                  density: 25,  unit: 'g' },
  { keywords: ['calabacín', 'calabacin'],                    density: 17,  unit: 'g' },
  { keywords: ['berenjena'],                                 density: 25,  unit: 'g' },
  { keywords: ['espinacas', 'espinaca'],                     density: 23,  unit: 'g' },
  { keywords: ['lechuga', 'canónigos', 'canonigos', 'rúcula', 'rucula'], density: 15, unit: 'g' },
  { keywords: ['tomate cherry', 'tomate'],                   density: 18,  unit: 'g' },
  { keywords: ['zanahoria'],                                 density: 40,  unit: 'g' },
  { keywords: ['pimiento'],                                  density: 26,  unit: 'g' },
  { keywords: ['cebolla'],                                   density: 40,  unit: 'g' },
  { keywords: ['ajo'],                                       density: 150, unit: 'g' }, // seco, pero cantidades muy pequeñas
  { keywords: ['champiñones', 'champiñon', 'setas', 'seta'], density: 22,  unit: 'g' },
  // judías verdes: entrada duplicada arriba en LEGUMBRES section — el orden
  // ahí es crítico para no perder contra el keyword 'judías' de alubias.
  { keywords: ['espárragos', 'esparragos'],                  density: 20,  unit: 'g' },
  { keywords: ['patata'],                                    density: 77,  unit: 'g' },
  { keywords: ['boniato'],                                   density: 86,  unit: 'g' },
  { keywords: ['aguacate'],                                  density: 160, unit: 'g' },
  { keywords: ['maíz', 'maiz'],                              density: 86,  unit: 'g' },
  { keywords: ['guisantes'],                                 density: 81,  unit: 'g' },
  { keywords: ['alcachofa'],                                 density: 47,  unit: 'g' },

  // ── FRUTAS (g) ──────────────────────────────────────────────
  { keywords: ['plátano', 'platano', 'banana'],              density: 90,  unit: 'g' },
  { keywords: ['manzana'],                                   density: 52,  unit: 'g' },
  { keywords: ['pera'],                                      density: 58,  unit: 'g' },
  { keywords: ['naranja'],                                   density: 47,  unit: 'g' },
  { keywords: ['mandarina'],                                 density: 53,  unit: 'g' },
  { keywords: ['fresas', 'fresa'],                           density: 32,  unit: 'g' },
  { keywords: ['arándanos', 'arandanos'],                    density: 57,  unit: 'g' },
  { keywords: ['uvas'],                                      density: 69,  unit: 'g' },
  { keywords: ['melocotón', 'melocoton'],                    density: 39,  unit: 'g' },
  { keywords: ['sandía', 'sandia'],                          density: 30,  unit: 'g' },
  { keywords: ['melón', 'melon'],                            density: 34,  unit: 'g' },
  { keywords: ['kiwi'],                                      density: 61,  unit: 'g' },

  // ── FRUTOS SECOS / SEMILLAS (g, densos) ─────────────────────
  { keywords: ['almendras'],                                 density: 579, unit: 'g' },
  { keywords: ['nueces'],                                    density: 654, unit: 'g' },
  { keywords: ['avellanas'],                                 density: 628, unit: 'g' },
  { keywords: ['anacardos'],                                 density: 553, unit: 'g' },
  { keywords: ['pistachos'],                                 density: 562, unit: 'g' },
  { keywords: ['cacahuetes'],                                density: 567, unit: 'g' },
  { keywords: ['semillas de chía', 'chía', 'chia'],          density: 486, unit: 'g' },
  { keywords: ['semillas de lino', 'lino'],                  density: 534, unit: 'g' },

  // ── OTROS COMUNES (g) ───────────────────────────────────────
  { keywords: ['miel'],                                      density: 304, unit: 'g' },
  { keywords: ['azúcar', 'azucar'],                          density: 387, unit: 'g' },
  { keywords: ['chocolate negro'],                           density: 546, unit: 'g' },
  { keywords: ['cacao'],                                     density: 228, unit: 'g' },
  { keywords: ['mermelada'],                                 density: 250, unit: 'g' },
];

/**
 * Normaliza texto para matching: minúsculas, sin tildes, espacios colapsados.
 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsea un ingrediente tipo "150g pechuga de pollo" o "30ml aceite de oliva".
 * Soporta decimales con `.` o `,`, unidades g/ml, case insensitive.
 *
 * @returns {{ qty: number, unit: 'g'|'ml', text: string } | null}
 *   null si no hay cantidad con unidad reconocible (ej. "1 diente ajo", "al gusto").
 */
function parseIngredient(raw) {
  const match = String(raw || '').match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  if (!match) return null;
  const qty = parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = match[2].toLowerCase();
  // text = el ingrediente sin la cantidad, para matchear keyword
  const text = normalize(raw.replace(match[0], ' '));
  return { qty, unit, text };
}

/**
 * Encuentra densidad para un texto de ingrediente.
 * Intenta keywords por orden (específicos primero). Case-insensitive, sin tildes.
 * @returns {{ density: number, unit: 'g'|'ml', matched: string } | null}
 */
function findDensity(text) {
  const norm = normalize(text);
  for (const row of DENSITY_TABLE) {
    for (const kw of row.keywords) {
      const nkw = normalize(kw);
      if (norm.includes(nkw)) {
        return { density: row.density, unit: row.unit, matched: nkw };
      }
    }
  }
  return null;
}

/**
 * Estima las kcal del meal sumando ingredientes reconocidos.
 *
 * @param {string} ingredientsText — string "150g pollo · 80g arroz · 30ml aceite"
 * @returns {{
 *   estimate: number,        — kcal totales estimadas de lo reconocido
 *   matched:  number,        — cuántos ingredientes con qty+unit se reconocieron
 *   total:    number,        — total de ingredientes con qty+unit (denominador de cobertura)
 *   coverage: number,        — matched / total (0..1), 0 si total === 0
 *   details:  Array<{raw, qty, unit, keyword, kcal}>  — traza para debug
 * }}
 */
export function estimateKcalFromIngredients(ingredientsText) {
  const details = [];
  let estimate = 0;
  let matched = 0;
  let total = 0;

  if (!ingredientsText) {
    return { estimate: 0, matched: 0, total: 0, coverage: 0, details };
  }

  const parts = String(ingredientsText).split('·').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const parsed = parseIngredient(part);
    if (!parsed) continue; // "1 diente ajo", "sal al gusto" — no cuentan

    total++;

    const hit = findDensity(parsed.text);
    if (!hit) {
      details.push({ raw: part, qty: parsed.qty, unit: parsed.unit, keyword: null, kcal: 0 });
      continue;
    }

    // Si la unidad del ingrediente no coincide con la densidad (ej: alguien
    // escribió '10g aceite' en vez de 10ml), ignoramos ese ingrediente para
    // evitar falsos positivos. Raro pero posible.
    if (hit.unit !== parsed.unit) {
      details.push({ raw: part, qty: parsed.qty, unit: parsed.unit, keyword: hit.matched, kcal: 0, unitMismatch: true });
      continue;
    }

    // g → qty/100 × density, ml → qty × density
    const kcal = hit.unit === 'g'
      ? (parsed.qty / 100) * hit.density
      : parsed.qty * hit.density;

    estimate += kcal;
    matched++;
    details.push({ raw: part, qty: parsed.qty, unit: parsed.unit, keyword: hit.matched, kcal: Math.round(kcal) });
  }

  const coverage = total > 0 ? matched / total : 0;
  return { estimate: Math.round(estimate), matched, total, coverage, details };
}

/**
 * Valida un meal: si el kcal declarado se desvía >25% del estimado
 * y la cobertura de ingredientes reconocidos es suficiente, devuelve
 * datos para un warning.
 *
 * @param {{ kcal: number, ingredients: string, name?: string }} meal
 * @param {object} opts
 * @param {number} [opts.thresholdPct=25] — % de desviación mínima para flaguear
 * @param {number} [opts.minCoverage=0.6] — cobertura mínima de ingredientes
 * @param {number} [opts.minEstimate=150] — estimado mínimo (evita flags en
 *                                           platos muy pequeños donde el ruido domina)
 * @returns {{
 *   suspicious: boolean,
 *   declared: number,
 *   estimate: number,
 *   diff_pct: number,       — (declared - estimate) / estimate (negativo = Sonnet subestimó)
 *   coverage: number,
 *   matched: number,
 * }}
 */
export function validateMealCoherence(meal, opts = {}) {
  const {
    thresholdPct = 25,
    minCoverage  = 0.6,
    minEstimate  = 150,
  } = opts;

  const declared = Number(meal?.kcal) || 0;
  const est = estimateKcalFromIngredients(meal?.ingredients || '');

  const result = {
    suspicious: false,
    declared,
    estimate: est.estimate,
    diff_pct: 0,
    coverage: est.coverage,
    matched:  est.matched,
  };

  // Nada que evaluar si no hay estimate suficiente o cobertura insuficiente
  if (est.estimate < minEstimate || est.coverage < minCoverage || declared <= 0) {
    return result;
  }

  const diffPct = ((declared - est.estimate) / est.estimate) * 100;
  result.diff_pct = Math.round(diffPct);

  if (Math.abs(diffPct) >= thresholdPct) {
    result.suspicious = true;
  }

  return result;
}

/**
 * Valida todos los meals de un plan y devuelve los sospechosos.
 * Útil para construir el warning `kcal_mismatch` agregado.
 *
 * @param {Array} meals
 * @returns {Array<{ name, declared, estimate, diff_pct }>} sospechosos
 */
export function findCoherenceIssues(meals) {
  if (!Array.isArray(meals)) return [];
  const issues = [];
  for (const meal of meals) {
    const v = validateMealCoherence(meal);
    if (v.suspicious) {
      issues.push({
        name:     meal?.name || 'sin nombre',
        declared: v.declared,
        estimate: v.estimate,
        diff_pct: v.diff_pct,
      });
    }
  }
  return issues;
}
