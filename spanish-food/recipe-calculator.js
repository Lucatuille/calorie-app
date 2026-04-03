#!/usr/bin/env node
// ============================================================
//  Recipe Calculator
//  Reads a recipe JSON + ingredients DB → calculates all macros
//
//  Usage:
//    node spanish-food/recipe-calculator.js spanish-food/recipes/tortilla-espanola.json
//
//  Reads ingredients from:
//    spanish-food/ingredients/base_ingredients.json (USDA)
//    spanish-food/ingredients/bedca_manual.json (Spanish-specific)
// ============================================================

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_FILE   = join(__dirname, 'ingredients', 'base_ingredients.json');
const BEDCA_FILE  = join(__dirname, 'ingredients', 'bedca_manual.json');
const CACHE_FILE  = join(__dirname, 'ingredients', 'usda_cache.json');
const SEEDS_DIR   = join(__dirname, 'seeds');

mkdirSync(SEEDS_DIR, { recursive: true });

// ── Load all ingredient sources ────────────────────────────
function loadIngredients() {
  const ingredients = {};

  // USDA base ingredients
  if (existsSync(BASE_FILE)) {
    const base = JSON.parse(readFileSync(BASE_FILE, 'utf-8'));
    for (const [key, val] of Object.entries(base)) {
      ingredients[key] = val;
    }
  }

  // USDA cache (for single extractions)
  if (existsSync(CACHE_FILE)) {
    const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    for (const [key, val] of Object.entries(cache)) {
      if (!val.error && !ingredients[key]) ingredients[key] = val;
    }
  }

  // BEDCA manual (Spanish-specific)
  if (existsSync(BEDCA_FILE)) {
    const bedca = JSON.parse(readFileSync(BEDCA_FILE, 'utf-8'));
    for (const [key, val] of Object.entries(bedca)) {
      ingredients[key] = val;
    }
  }

  return ingredients;
}

// ── Calculate recipe ───────────────────────────────────────
function calculateRecipe(recipe, ingredients) {
  let totalKcal = 0, totalProt = 0, totalCarb = 0, totalFat = 0, totalFiber = 0;
  let totalWeight = 0;
  const details = [];
  const missing = [];

  for (const ing of recipe.ingredientes) {
    const key = ing.nombre_usda;
    const data = ingredients[key];

    if (!data || !data.por_100g) {
      missing.push(key);
      continue;
    }

    const g = ing.cantidad_g;
    const factor = (ing.factor_coccion || 1.0);
    const d = data.por_100g;

    const kcal = (d.kcal * g / 100) * factor;
    const prot = (d.proteina_g * g / 100) * factor;
    const carb = (d.carbos_g * g / 100) * factor;
    const fat  = (d.grasa_g * g / 100) * factor;
    const fib  = (d.fibra_g || 0) * g / 100 * factor;

    totalKcal += kcal;
    totalProt += prot;
    totalCarb += carb;
    totalFat  += fat;
    totalFiber += fib;
    totalWeight += g;

    details.push({
      nombre: ing.nombre_usda,
      nombre_es: data.nombre_es || ing.nombre_usda,
      g,
      factor,
      kcal: Math.round(kcal),
      nota: ing.nota || '',
    });
  }

  if (missing.length) {
    return { error: true, missing };
  }

  const raciones = recipe.raciones || 1;
  const porcionG = recipe.porcion_g;

  // Per portion
  const perPortion = {
    kcal: Math.round(totalKcal / raciones),
    proteina_g: Math.round(totalProt / raciones * 10) / 10,
    carbos_g: Math.round(totalCarb / raciones * 10) / 10,
    grasa_g: Math.round(totalFat / raciones * 10) / 10,
    fibra_g: Math.round(totalFiber / raciones * 10) / 10,
  };

  // Per 100g (based on portion weight)
  const per100g = {
    kcal: Math.round(perPortion.kcal / porcionG * 100),
    proteina: Math.round(perPortion.proteina_g / porcionG * 100 * 10) / 10,
    carbos: Math.round(perPortion.carbos_g / porcionG * 100 * 10) / 10,
    grasa: Math.round(perPortion.grasa_g / porcionG * 100 * 10) / 10,
  };

  // kcal range based on varianza
  const varianza = (recipe.varianza_pct || 12) / 100;
  const kcalMin = Math.round(perPortion.kcal * (1 - varianza));
  const kcalMax = Math.round(perPortion.kcal * (1 + varianza));

  // Porciones guia with calculated kcal
  const porcionesGuia = (recipe.porciones_guia || []).map(p => ({
    desc: p.desc,
    g: p.g,
    kcal: Math.round((p.g / porcionG) * perPortion.kcal),
  }));

  return {
    details,
    totalWeight,
    raciones,
    perPortion,
    per100g,
    kcalMin,
    kcalMax,
    porcionesGuia,
  };
}

// ── Generate SQL ───────────────────────────────────────────
function generateSQL(recipe, calc) {
  const esc = s => s ? s.replace(/'/g, "''") : '';
  const p = calc.perPortion;
  const h = calc.per100g;

  return `INSERT OR REPLACE INTO spanish_dishes (
  nombre, categoria, aliases, token_principal, tokens_secundarios, tokens_exclusion,
  porcion_g, porcion_desc, kcal_ref, kcal_min, kcal_max,
  proteina_g, carbos_g, grasa_g, fibra_g,
  kcal_per_100g, proteina_per_100g, carbos_per_100g, grasa_per_100g,
  fuente_primaria, confianza, notas_claude,
  porciones_guia, referencias_visuales
) VALUES (
  '${esc(recipe.nombre)}', '${esc(recipe.categoria)}',
  '${esc(JSON.stringify(recipe.aliases || []))}',
  '${esc(recipe.token_principal)}',
  '${esc(JSON.stringify(recipe.tokens_secundarios || []))}',
  '${esc(JSON.stringify(recipe.tokens_exclusion || []))}',
  ${recipe.porcion_g}, '${esc(recipe.porcion_desc)}',
  ${p.kcal}, ${calc.kcalMin}, ${calc.kcalMax},
  ${p.proteina_g}, ${p.carbos_g}, ${p.grasa_g}, ${p.fibra_g || 'NULL'},
  ${h.kcal}, ${h.proteina}, ${h.carbos}, ${h.grasa},
  '${esc(recipe.fuente_primaria)}', '${esc(recipe.confianza)}',
  ${recipe.notas_claude ? `'${esc(recipe.notas_claude)}'` : 'NULL'},
  '${esc(JSON.stringify(calc.porcionesGuia))}',
  ${recipe.referencias_visuales ? `'${esc(recipe.referencias_visuales)}'` : 'NULL'}
);`;
}

// ── Display results ────────────────────────────────────────
function displayResults(recipe, calc) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${recipe.nombre.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}`);

  console.log(`\n  Desglose de ingredientes:`);
  for (const d of calc.details) {
    console.log(`    ${d.nombre_es.padEnd(28)} ${String(d.g).padStart(5)}g → ${String(d.kcal).padStart(5)} kcal${d.factor !== 1 ? ` (×${d.factor})` : ''}`);
  }
  console.log(`    ${'─'.repeat(46)}`);
  console.log(`    ${'TOTAL'.padEnd(28)} ${String(Math.round(calc.totalWeight)).padStart(5)}g → ${String(calc.perPortion.kcal * calc.raciones).padStart(5)} kcal`);
  console.log(`    Raciones: ${calc.raciones}`);

  console.log(`\n  Por porción (${recipe.porcion_g}g):`);
  console.log(`    Calorías: ${calc.perPortion.kcal} kcal [rango: ${calc.kcalMin} - ${calc.kcalMax}]`);
  console.log(`    Proteína: ${calc.perPortion.proteina_g}g`);
  console.log(`    Carbos:   ${calc.perPortion.carbos_g}g`);
  console.log(`    Grasa:    ${calc.perPortion.grasa_g}g`);

  console.log(`\n  Por 100g:`);
  console.log(`    Calorías: ${calc.per100g.kcal} kcal`);
  console.log(`    Proteína: ${calc.per100g.proteina}g`);
  console.log(`    Carbos:   ${calc.per100g.carbos}g`);
  console.log(`    Grasa:    ${calc.per100g.grasa}g`);

  if (calc.porcionesGuia.length) {
    console.log(`\n  Porciones guía:`);
    for (const p of calc.porcionesGuia) {
      console.log(`    ${p.desc.padEnd(22)} ${String(p.g).padStart(4)}g = ${String(p.kcal).padStart(5)} kcal`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
}

// ── Prompt for confirmation ────────────────────────────────
function askConfirmation(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  const recipeFile = process.argv[2];

  if (!recipeFile) {
    console.error('Usage: node spanish-food/recipe-calculator.js <recipe-file.json>');
    process.exit(1);
  }

  if (!existsSync(recipeFile)) {
    console.error(`❌ File not found: ${recipeFile}`);
    process.exit(1);
  }

  const recipe = JSON.parse(readFileSync(recipeFile, 'utf-8'));
  const ingredients = loadIngredients();

  console.log(`\n🍳 Calculando: ${recipe.nombre}`);
  console.log(`   Ingredientes: ${recipe.ingredientes.length}`);
  console.log(`   Fuentes cargadas: ${Object.keys(ingredients).length} ingredientes`);

  const calc = calculateRecipe(recipe, ingredients);

  if (calc.error) {
    console.error(`\n❌ Ingredientes no encontrados en la base de datos:`);
    for (const m of calc.missing) {
      console.error(`   → "${m}"`);
    }
    console.error(`\n   Opciones:`);
    console.error(`   1. Extraer de USDA: node spanish-food/usda-extractor.js "${calc.missing[0]}"`);
    console.error(`   2. Añadir manualmente a spanish-food/ingredients/bedca_manual.json`);
    process.exit(1);
  }

  displayResults(recipe, calc);

  const answer = await askConfirmation('\n  ¿Los valores te parecen correctos? (y/n): ');

  if (answer === 'y' || answer === 'si' || answer === 'sí') {
    const sql = generateSQL(recipe, calc);
    const pendingFile = join(SEEDS_DIR, 'pending.sql');
    appendFileSync(pendingFile, sql + '\n\n');
    console.log(`\n  ✓ SQL generado → ${pendingFile}`);
    console.log(`    Ejecutar: cd worker && npx wrangler d1 execute calorie-app-db --file=../spanish-food/seeds/pending.sql --remote`);
  } else {
    console.log(`\n  ⏸ No guardado. Ajusta la receta y vuelve a ejecutar.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
