#!/usr/bin/env node
// ============================================================
//  Seed Generator — converts recipe JSONs → D1 SQL INSERT
//  Usage: node spanish-food/seed-generator.js
//  Reads: spanish-food/recipes/*.json (calculated, ready to seed)
//  Outputs: worker/migrations/spanish-dishes-auto.sql
// ============================================================

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = join(__dirname, 'recipes');
const OUTPUT_FILE = join(__dirname, '..', 'worker', 'migrations', 'spanish-dishes-auto.sql');

const files = readdirSync(RECIPES_DIR).filter(f => f.endsWith('.json'));

if (!files.length) {
  console.log('No recipe files found in spanish-food/recipes/');
  process.exit(0);
}

const inserts = [];

for (const file of files) {
  const raw = readFileSync(join(RECIPES_DIR, file), 'utf-8');
  const r = JSON.parse(raw);

  // Validate required fields
  const required = ['nombre', 'categoria', 'token_principal', 'porcion_g', 'porcion_desc',
    'kcal_ref', 'kcal_min', 'kcal_max', 'proteina_g', 'carbos_g', 'grasa_g',
    'kcal_per_100g', 'proteina_per_100g', 'carbos_per_100g', 'grasa_per_100g',
    'fuente_primaria', 'confianza'];

  const missing = required.filter(f => r[f] == null);
  if (missing.length) {
    console.error(`❌ ${file}: missing fields: ${missing.join(', ')}`);
    console.error('   This recipe needs calculation first. Skip.');
    continue;
  }

  const esc = (s) => s ? s.replace(/'/g, "''") : '';

  const sql = `INSERT OR REPLACE INTO spanish_dishes (
  nombre, categoria, subcategoria,
  aliases, token_principal, tokens_secundarios, tokens_exclusion,
  porcion_g, porcion_desc,
  kcal_ref, kcal_min, kcal_max, proteina_g, carbos_g, grasa_g, fibra_g,
  kcal_per_100g, proteina_per_100g, carbos_per_100g, grasa_per_100g,
  variantes, notas_claude, factores_variables,
  fuente_primaria, fuentes_validacion, confianza, metodo_calculo,
  porciones_guia, referencias_visuales, revisado_por
) VALUES (
  '${esc(r.nombre)}', '${esc(r.categoria)}', ${r.subcategoria ? `'${esc(r.subcategoria)}'` : 'NULL'},
  '${esc(JSON.stringify(r.aliases || []))}', '${esc(r.token_principal)}', '${esc(JSON.stringify(r.tokens_secundarios || []))}', '${esc(JSON.stringify(r.tokens_exclusion || []))}',
  ${r.porcion_g}, '${esc(r.porcion_desc)}',
  ${r.kcal_ref}, ${r.kcal_min}, ${r.kcal_max}, ${r.proteina_g}, ${r.carbos_g}, ${r.grasa_g}, ${r.fibra_g || 'NULL'},
  ${r.kcal_per_100g}, ${r.proteina_per_100g}, ${r.carbos_per_100g}, ${r.grasa_per_100g},
  '${esc(JSON.stringify(r.variantes || []))}', ${r.notas_claude ? `'${esc(r.notas_claude)}'` : 'NULL'}, ${r.factores_variables ? `'${esc(r.factores_variables)}'` : 'NULL'},
  '${esc(r.fuente_primaria)}', '${esc(JSON.stringify(r.fuentes_validacion || []))}', '${esc(r.confianza)}', ${r.metodo_calculo ? `'${esc(r.metodo_calculo)}'` : 'NULL'},
  '${esc(JSON.stringify(r.porciones_guia || []))}', ${r.referencias_visuales ? `'${esc(r.referencias_visuales)}'` : 'NULL'}, ${r.revisado_por ? `'${esc(r.revisado_por)}'` : 'NULL'}
);`;

  inserts.push(sql);
  console.log(`✓ ${r.nombre} (${r.kcal_ref} kcal / ${r.porcion_g}g)`);
}

if (inserts.length) {
  writeFileSync(OUTPUT_FILE, inserts.join('\n\n') + '\n');
  console.log(`\n→ Generated ${OUTPUT_FILE} with ${inserts.length} dishes`);
  console.log(`  Run: cd worker && npx wrangler d1 execute calorie-app-db --file=migrations/spanish-dishes-auto.sql --remote`);
}
