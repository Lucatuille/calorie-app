#!/usr/bin/env node
// ============================================================
//  USDA FoodData Central Extractor
//  Queries the USDA API and caches results locally.
//
//  Usage:
//    node spanish-food/usda-extractor.js                  — extract all base ingredients
//    node spanish-food/usda-extractor.js "egg whole raw"  — extract single ingredient
//
//  API key: set USDA_API_KEY env var or paste in .env file
//  Docs: https://fdc.nal.usda.gov/api-guide
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, 'ingredients', 'usda_cache.json');
const BASE_FILE  = join(__dirname, 'ingredients', 'base_ingredients.json');
const INGREDIENTS_DIR = join(__dirname, 'ingredients');

// Ensure directories exist
mkdirSync(INGREDIENTS_DIR, { recursive: true });

// ── API Key ────────────────────────────────────────────────
function getApiKey() {
  // Check env var first
  if (process.env.USDA_API_KEY) return process.env.USDA_API_KEY;

  // Check .env file in spanish-food/
  const envPath = join(__dirname, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(/USDA_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }

  console.error('❌ No API key found.');
  console.error('   Set USDA_API_KEY env var or create spanish-food/.env with:');
  console.error('   USDA_API_KEY=your_key_here');
  process.exit(1);
}

// ── Cache ──────────────────────────────────────────────────
function loadCache() {
  if (existsSync(CACHE_FILE)) {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  }
  return {};
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ── USDA API ───────────────────────────────────────────────
const NUTRIENT_IDS = {
  energy:  1008,  // Energy (kcal)
  protein: 1003,  // Protein (g)
  fat:     1004,  // Total fat (g)
  carbs:   1005,  // Carbohydrate (g)
  fiber:   1079,  // Fiber (g)
};

async function searchUSDA(query, apiKey) {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', query);
  url.searchParams.set('dataType', 'SR Legacy,Foundation');
  url.searchParams.set('pageSize', '5');
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`USDA API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.foods || [];
}

function extractNutrients(food) {
  const nutrients = {};
  for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
    // Search API returns nutrientId; some data types also use nutrientNumber as string
    const found = food.foodNutrients?.find(n =>
      n.nutrientId === id || n.nutrientNumber === String(id)
    );
    nutrients[key] = found ? Math.round(found.value * 10) / 10 : 0;
  }
  return nutrients;
}

function selectBestResult(foods) {
  if (!foods.length) return null;

  // Prefer results that actually have energy data
  // SR Legacy has better nutrient coverage in search API than Foundation
  const withEnergy = foods.filter(f => {
    const e = f.foodNutrients?.find(n => n.nutrientId === 1008 || n.nutrientNumber === '1008');
    return e && e.value > 0;
  });

  const pool = withEnergy.length ? withEnergy : foods;

  // Among those with energy, prefer SR Legacy (more complete) then Foundation
  const priority = { 'SR Legacy': 0, Foundation: 1 };
  pool.sort((a, b) => {
    const pa = priority[a.dataType] ?? 99;
    const pb = priority[b.dataType] ?? 99;
    return pa - pb;
  });

  return pool[0];
}

async function extractIngredient(query, apiKey) {
  const foods = await searchUSDA(query, apiKey);
  const best = selectBestResult(foods);

  if (!best) {
    return { query, error: 'No results found' };
  }

  const nutrients = extractNutrients(best);

  return {
    nombre_busqueda: query,
    nombre_usda: best.description,
    fdcId: best.fdcId,
    fuente: best.dataType,
    por_100g: {
      kcal: nutrients.energy,
      proteina_g: nutrients.protein,
      carbos_g: nutrients.carbs,
      grasa_g: nutrients.fat,
      fibra_g: nutrients.fiber,
    },
  };
}

// ── Base ingredients list ──────────────────────────────────
const BASE_QUERIES = [
  { query: 'egg whole raw',            nombre_es: 'Huevo entero crudo' },
  { query: 'potato raw',               nombre_es: 'Patata cruda' },
  { query: 'olive oil',                nombre_es: 'Aceite de oliva' },
  { query: 'wheat bread',              nombre_es: 'Pan de trigo (barra)' },
  { query: 'pork loin raw',            nombre_es: 'Lomo de cerdo crudo' },
  { query: 'chicken breast meat raw',   nombre_es: 'Pechuga de pollo cruda' },
  { query: 'chicken thigh meat raw',   nombre_es: 'Muslo de pollo crudo' },
  { query: 'beef ground raw',          nombre_es: 'Carne picada ternera cruda' },
  { query: 'cod raw',                  nombre_es: 'Bacalao fresco crudo' },
  { query: 'hake atlantic raw',         nombre_es: 'Merluza cruda' },
  { query: 'shrimp raw',               nombre_es: 'Gambas crudas' },
  { query: 'tomato raw',               nombre_es: 'Tomate crudo' },
  { query: 'onion raw',                nombre_es: 'Cebolla cruda' },
  { query: 'garlic raw',               nombre_es: 'Ajo crudo' },
  { query: 'lentils raw',              nombre_es: 'Lentejas crudas' },
  { query: 'chickpeas raw',            nombre_es: 'Garbanzos crudos' },
  { query: 'white rice raw',           nombre_es: 'Arroz blanco crudo' },
  { query: 'pasta dry',                nombre_es: 'Pasta cruda' },
  { query: 'milk whole 3.25% fat',     nombre_es: 'Leche entera' },
  { query: 'flour wheat all purpose',  nombre_es: 'Harina de trigo' },
  { query: 'breadcrumbs dry',          nombre_es: 'Pan rallado' },
  { query: 'green beans raw',          nombre_es: 'Judías verdes crudas' },
  { query: 'potato french fries',      nombre_es: 'Patata frita en aceite' },
  { query: 'red bell pepper raw',      nombre_es: 'Pimiento rojo crudo' },
  { query: 'lettuce raw',              nombre_es: 'Lechuga cruda' },
  { query: 'tuna canned in oil',       nombre_es: 'Atún en aceite (conserva)' },
  { query: 'mayonnaise',               nombre_es: 'Mayonesa' },
  { query: 'sugar white',              nombre_es: 'Azúcar blanco' },
  { query: 'butter salted',             nombre_es: 'Mantequilla' },
];

// ── Main ───────────────────────────────────────────────────
async function main() {
  const apiKey = getApiKey();
  const cache = loadCache();
  const singleQuery = process.argv[2];

  if (singleQuery) {
    // Single ingredient mode
    console.log(`🔍 Buscando: "${singleQuery}"...`);
    const result = await extractIngredient(singleQuery, apiKey);
    if (result.error) {
      console.error(`❌ ${result.error}`);
    } else {
      console.log(`✓ ${result.nombre_usda} (${result.fuente})`);
      console.log(`  kcal: ${result.por_100g.kcal} | prot: ${result.por_100g.proteina_g}g | carb: ${result.por_100g.carbos_g}g | fat: ${result.por_100g.grasa_g}g`);
      cache[singleQuery] = result;
      saveCache(cache);
      console.log(`  → Cached in ${CACHE_FILE}`);
    }
    return;
  }

  // Full extraction mode
  console.log(`\n🍳 USDA FoodData Central — Extractor de ingredientes base`);
  console.log(`   ${BASE_QUERIES.length} ingredientes a extraer\n`);

  const results = {};
  let extracted = 0;
  let cached = 0;
  let failed = 0;

  for (const { query, nombre_es } of BASE_QUERIES) {
    // Check cache first
    if (cache[query] && !cache[query].error) {
      results[query] = { ...cache[query], nombre_es };
      cached++;
      console.log(`  ⏩ ${nombre_es} (cached)`);
      continue;
    }

    // Small delay to be nice to the API
    if (extracted > 0) await new Promise(r => setTimeout(r, 200));

    try {
      const result = await extractIngredient(query, apiKey);
      if (result.error) {
        console.log(`  ❌ ${nombre_es}: ${result.error}`);
        failed++;
      } else {
        results[query] = { ...result, nombre_es };
        cache[query] = result;
        extracted++;
        console.log(`  ✓ ${nombre_es}: ${result.por_100g.kcal} kcal/100g (${result.fuente})`);
      }
    } catch (err) {
      console.log(`  ❌ ${nombre_es}: ${err.message}`);
      failed++;
    }
  }

  // Save cache
  saveCache(cache);

  // Save base ingredients (with Spanish names)
  writeFileSync(BASE_FILE, JSON.stringify(results, null, 2));

  console.log(`\n📊 Resultado:`);
  console.log(`   ✓ Extraídos: ${extracted}`);
  console.log(`   ⏩ Del cache: ${cached}`);
  console.log(`   ❌ Fallidos: ${failed}`);
  console.log(`\n   → ${BASE_FILE}`);
  console.log(`   → ${CACHE_FILE}`);

  // Show summary table
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`  ${'Ingrediente'.padEnd(30)} ${'kcal'.padStart(6)} ${'Prot'.padStart(6)} ${'Carb'.padStart(6)} ${'Grasa'.padStart(6)}`);
  console.log(`${'─'.repeat(80)}`);
  for (const [, ing] of Object.entries(results)) {
    if (ing.por_100g) {
      console.log(`  ${(ing.nombre_es || ing.nombre_busqueda).padEnd(30)} ${String(ing.por_100g.kcal).padStart(6)} ${String(ing.por_100g.proteina_g).padStart(6)} ${String(ing.por_100g.carbos_g).padStart(6)} ${String(ing.por_100g.grasa_g).padStart(6)}`);
    }
  }
  console.log(`${'─'.repeat(80)}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
