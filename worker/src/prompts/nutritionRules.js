// ============================================================
//  nutritionRules.js — Reglas compartidas de precisión calórica.
//
//  Objetivo: que el mismo plato ("arroz con pollo 150g") produzca
//  kcal coherentes tanto si viene del analyze (foto/texto) como del
//  planner (Chef día/semana). Antes cada prompt tenía sus propias
//  reglas (o ninguna), y el user notaba la divergencia.
//
//  Uso: importar NUTRITION_RULES_BLOCK y concatenarlo al system
//  prompt de cada endpoint que genera estimaciones calóricas.
//
//  Tokens: ~320 tokens. Los system prompts se cachean en Anthropic
//  (Prompt Caching los primeros 5 min), coste efectivo ~0.
// ============================================================

export const NUTRITION_RULES_BLOCK = `REGLAS DE PRECISIÓN CALÓRICA (aplicar siempre):

· Tabla de referencia kcal/100g — úsala como base, NO como techo:
  pollo/pavo pechuga 120 | muslo pollo 180 | ternera 250 | cerdo 280
  pescado blanco 90 | salmón 200 | atún en aceite 190 | atún natural 115
  huevo 155 (1 huevo M ≈ 80 kcal) | queso curado 400 | queso fresco 110
  arroz cocido 130 | pasta cocida 160 | pan 260 | patata cocida 85
  patata frita 310 | legumbres cocidas 120 | verdura hoja 25
  aceite 880 | mantequilla 720 | frutos secos 600 | chocolate 550
  yogur natural 60 | yogur griego 120 | leche entera 65 | leche desnatada 35
  chorizo 380 | jamón serrano 240 | jamón york 110

· PESO SECO vs COCIDO: cuando el usuario dice "Xg de pasta/arroz/legumbres" SIN especificar "cocido/a" o "hervido/a", asumir peso SECO (lo que pone en la bolsa):
  pasta seca 350 kcal/100g | arroz seco 360 kcal/100g | legumbres secas 350 kcal/100g
  Solo usar valores "cocido" si el texto dice explícitamente "cocido/a" o "hervido/a".

· COCINA ESPAÑOLA — aceite generoso: NO asumir "moderado en aceites". El aceite de oliva es ingrediente principal, no acompañante. Ajustes por método de cocción (añadir al total del plato):
  hervido/vapor: +0 kcal
  plancha/horno: +15-30 kcal
  salteado/rehogado: +80-150 kcal
  sofrito español (aceite + cebolla + tomate): +120-200 kcal
  fritura sartén: +100-180 kcal
  fritura freidora/abundante: +150-250 kcal
  salsa cremosa visible: +100-200 kcal
  aliño generoso en ensalada: +80-150 kcal

· Cocción NO especificada:
  En casa: carnes → sartén con aceite; pescado → rebozado o sartén; patatas → fritas (salvo que diga cocidas); verdura → salteada o rehogada.
  En restaurante: carnes → plancha o sartén con aceite; patatas → fritas; pastas → con sofrito base.

· RESTAURANTE / preparación elaborada: +25-35% vs casero simple (por mantequilla escondida, salsas, raciones mayores). Si ya has sumado grasa de cocción, ya va incluido; no dupliques.

· RACIÓN NORMAL ESPAÑOLA cuando no se especifica cantidad: no seas conservador. Ración de pasta casera = 80-100g secos. Pechuga = 150-180g. Arroz plato hondo = 70-90g secos. Ensalada plato = 200-300g.

· Múltiples alimentos: analiza CADA UNO por separado (proteína + carbo + verdura + salsa/aceite) y SUMA al total. No des el total a ojo sin desglosar.`;
