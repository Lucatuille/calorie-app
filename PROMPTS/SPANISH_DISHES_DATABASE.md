# Base de Datos de Platos Españoles — Caliro
## Documento de referencia para implementación profesional

---

## 1. Filosofía y objetivos

### Por qué este proyecto importa

Claude Vision y Haiku son modelos entrenados mayoritariamente con datos anglosajones.
Donde fallan sistemáticamente en comida española:

- Subestiman el aceite de oliva — España usa aceite con generosidad real,
  no la "cucharadita" que asume un modelo americano
- No conocen porciones españolas — una ración de lentejas en España son
  300-350g cocinadas, no los 180g de una "serving" americana
- Confunden preparaciones — "tortilla" puede ser española (600 kcal)
  o francesa (145 kcal), y el contexto no siempre lo aclara
- Ignoran el sofrito — la base de aceite+cebolla+tomate de casi todo
  plato español aporta 80-120 kcal que Claude omite sistemáticamente

Este proyecto no es un diccionario de calorías — es un sistema de
corrección de sesgo cultural para hacer que Caliro sea genuinamente
más preciso para usuarios españoles.

### Principios de calidad

1. Datos calculados, no copiados — cada valor viene de una receta
   de referencia calculada desde ingredientes, no de copiar un número de internet
2. Rangos, no valores únicos — kcal_min / kcal_ref / kcal_max siempre
3. Fuentes verificables — cada dato tiene fuente citada
4. Porciones españolas reales — no serving sizes americanos
5. Honestidad sobre incertidumbre — si un plato varía mucho,
   se documenta la varianza

---

## 2. Fuentes de datos — jerarquía de confianza

### Nivel 1 — Fuentes oficiales españolas (máxima confianza)

BEDCA — Base de Datos Española de Composición de Alimentos
- URL: bedca.net
- Organismo: Ministerio de Sanidad, Consumo y Bienestar Social
- Contenido: composición nutricional por 100g de ingrediente crudo/cocinado
- Uso: valores base de ingredientes para calcular recetas
- Limitación: tiene ingredientes pero pocos platos preparados completos

AESAN — Agencia Española de Seguridad Alimentaria y Nutrición
- URL: aesan.gob.es
- Contenido: tablas de composición, estudios ENIDE
- Uso: validación cruzada con BEDCA

CESNID — Centre d'Ensenyament Superior de Nutrició i Dietètica
- Tablas de composición de alimentos para uso clínico
- Especialmente útil para platos preparados catalanes/mediterráneos

### Nivel 2 — Fuentes científicas (alta confianza)

Tablas de composición de alimentos de Moreiras et al.
- El libro de referencia estándar en nutrición clínica española
- Edición actualizada: "Tablas de composición de alimentos" (Pirámide)
- Incluye platos preparados con recetas estándar españolas

USDA FoodData Central
- Útil para ingredientes genéricos (huevos, carnes, legumbres secas)
- NO usar para platos preparados — porciones y preparaciones son americanas

### Nivel 3 — Fuentes de validación (confianza media)

FatSecret España (fatsecret.es)
- Base de datos colaborativa pero con muchas entradas verificadas
- Usar para validación: si la media de 10+ entradas españolas
  coincide con tu cálculo en +-15%, es una buena señal
- NO usar como fuente primaria

### Nivel 4 — NO usar como fuente

- MyFitnessPal (demasiada varianza, entradas no verificadas)
- ChatGPT/Claude para generar los datos (sesgo circular)
- Webs de recetas con "información nutricional" automática
- Etiquetas de productos equivalentes (no es el plato casero)

---

## 3. Proceso de curación — paso a paso para cada plato

### Paso 1 — Definir la receta de referencia española

Objetivo: una receta que represente lo que cocina una familia española media.
No la versión light, no la gourmet, no la de restaurante.

Criterios:
- Ingredientes que se compran en cualquier supermercado español
- Proporciones que usa una cocinera española media
- Sin reducciones de aceite ni sustituciones saludables
- Tamaño de ración que se sirve realmente en una mesa española

Ejemplo: Tortilla española (4 raciones)
  Patatas: 600g (peladas, en láminas)
  Huevos: 5 unidades L (275g)
  Aceite de oliva para freír: 150ml (se absorben ~45ml)
  Sal: al gusto
  Peso total cocinado: ~520g
  Porciones: 4
  Peso por porción: ~130g

### Paso 2 — Calcular desde ingredientes con BEDCA

Para cada ingrediente, buscar en BEDCA la composición por 100g y calcular.

Ejemplo cálculo tortilla española (4 raciones):

Patatas fritas en aceite:
  600g patata cruda con BEDCA patata frita en aceite: 268 kcal/100g
  600g x 268/100 = 1.608 kcal

Huevos:
  5 huevos L = 275g sin cascara
  BEDCA huevo cocido: 147 kcal/100g
  275g x 147/100 = 404 kcal (ajuste coccion -5% = 384 kcal)

Aceite absorbido:
  Absorcion estimada 30-35% del aceite usado
  150ml x 32% = 48ml = 43g aceite
  BEDCA aceite oliva: 899 kcal/100g
  43g x 899/100 = 387 kcal

TOTAL: 1.608 + 384 + 387 = 2.379 kcal
Por porcion (4): 595 kcal ~ 600 kcal
Por 100g: 600/130 x 100 = 462 kcal/100g

### Paso 3 — Validacion cruzada

Con el calculo propio hecho, contrastar contra 3 fuentes:

Ejemplo tortilla española:
  Calculo propio:          600 kcal / 130g = 462 kcal/100g
  BEDCA plato preparado:   440-480 kcal/100g (dentro del rango)
  Moreiras et al.:         ~420 kcal/100g (receta mas ligera)
  FatSecret España media:  380-500 kcal/racion (alta varianza, esperada)

  CONCLUSION: Rango 420-480 kcal/100g validado
  Valor ref: 462 kcal/100g
  Porcion estandar: 130g
  kcal_ref por porcion: 600 kcal
  kcal_min: 530 kcal
  kcal_max: 680 kcal

### Paso 4 — Documentar variantes

Ejemplo tortilla española:
  Con cebolla: +15-20 kcal/porcion
  Mini tortilla (pincho): aprox 200 kcal
  Tortilla de restaurante: +80-100 kcal
  Media tortilla: x2 = ~1.200 kcal

### Paso 5 — Definir aliases y tokens

Ejemplo tortilla española:
  nombre: "tortilla española"
  aliases: ["tortilla de patatas", "tortilla de patata", "tortilla con cebolla",
            "tortilla casera", "pincho de tortilla", "trozo de tortilla"]
  token_principal: "tortilla"
  tokens_secundarios: ["patata", "patatas"]
  tokens_exclusion: ["francesa", "de maiz", "mexicana"]

### Paso 6 — Escribir el contexto para Claude

Este es el texto que se inyecta en el prompt:

CONTEXTO VERIFICADO — TORTILLA ESPAÑOLA:
Fuente: BEDCA + Tablas Moreiras et al. (calculo desde ingredientes)
Plato: Tortilla española (con patata y huevo)
Porcion de referencia: 130g (porcion individual española estandar)

Valores por porcion de referencia (130g):
  Energia: 600 kcal [rango: 530-680 segun tamaño y cantidad de aceite]
  Proteina: 12.4g
  Carbohidratos: 22.8g
  Grasa: 36.2g

Notas para ajuste:
- "Trozo pequeño" o "pincho": ~200 kcal
- "Racion grande" o "media tortilla": ~900 kcal
- "Con cebolla": +20 kcal
- Tortilla de restaurante suele ser mas gruesa: +15%
- El aceite es el componente mas variable

IMPORTANTE: La tortilla española siempre lleva aceite de oliva
para freir la patata. NO confundir con tortilla francesa
(solo huevo, sin patata, ~145 kcal).

---

## 4. Los 75 platos — plan completo

### Categoria A — Huevos y tortillas (error alto en Claude)

Tortilla española        | 130g | 600 kcal | prioridad maxima
Tortilla francesa        |  80g | 145 kcal | prioridad maxima
Huevos fritos (2 uds)   | 120g | 290 kcal | prioridad maxima
Huevos revueltos        | 100g | 185 kcal | alta
Huevo cocido (1 ud)     |  50g |  78 kcal | media
Huevos a la flamenca    | 200g | 320 kcal | alta
Huevos rotos            | 220g | 580 kcal | maxima

### Categoria B — Pan y desayunos españoles (muy unicos)

Pan con tomate y aceite     |  80g | 195 kcal | maxima
Tostada con aceite          |  60g | 165 kcal | maxima
Tostada mantequilla mermelada|  65g | 195 kcal | alta
Bocadillo de jamon serrano  | 180g | 415 kcal | maxima
Bocadillo de tortilla       | 220g | 580 kcal | maxima
Bocadillo de lomo           | 180g | 430 kcal | alta
Bocadillo de calamares      | 190g | 460 kcal | alta
Churros (racion)            | 100g | 290 kcal | alta
Churros con chocolate       | 250g | 510 kcal | alta

### Categoria C — Arroces (porciones muy variables)

Paella valenciana           | 350g | 520 kcal | maxima
Arroz con pollo             | 300g | 480 kcal | maxima
Arroz negro                 | 300g | 440 kcal | alta
Arroz caldoso con mariscos  | 350g | 380 kcal | alta
Arroz al horno              | 300g | 510 kcal | alta
Arroz con leche             | 200g | 240 kcal | alta

### Categoria D — Legumbres (porciones españolas vs americanas)

Lentejas con chorizo        | 350g | 480 kcal | maxima
Cocido madrileño (plato)    | 400g | 620 kcal | maxima
Fabada asturiana            | 350g | 580 kcal | maxima
Garbanzos con espinacas     | 300g | 340 kcal | alta
Potaje de vigilia           | 300g | 380 kcal | alta
Judias blancas con chorizo  | 350g | 520 kcal | alta

### Categoria E — Carnes españolas

Croquetas caseras (3 uds)   | 120g | 290 kcal | maxima
Albondigas en salsa (6 uds) | 220g | 380 kcal | maxima
Pollo al ajillo             | 250g | 420 kcal | alta
Pollo a la española         | 250g | 380 kcal | alta
Lomo a la plancha           | 150g | 240 kcal | media
Filete de ternera           | 150g | 265 kcal | media
Chuletas de cerdo           | 180g | 380 kcal | alta
Carrilleras en salsa        | 200g | 420 kcal | alta
Rabo de toro                | 200g | 480 kcal | alta

### Categoria F — Pescados y mariscos

Merluza rebozada            | 180g | 320 kcal | maxima
Merluza a la plancha        | 180g | 185 kcal | alta
Boquerones en vinagre       | 100g | 130 kcal | alta
Gambas al ajillo            | 200g | 280 kcal | maxima
Pulpo a la gallega          | 200g | 220 kcal | alta
Calamares a la romana       | 150g | 310 kcal | maxima
Bacalao al pil-pil          | 200g | 340 kcal | alta
Bacalao a la vizcaina       | 200g | 310 kcal | alta
Sardinas a la plancha       | 150g | 230 kcal | alta
Atun con tomate             | 200g | 220 kcal | alta

### Categoria G — Sopas y cremas

Gazpacho                    | 250ml | 105 kcal | maxima
Salmorejo                   | 200ml | 195 kcal | maxima
Caldo de cocido             | 250ml |  45 kcal | alta
Sopa de fideos              | 250ml | 145 kcal | alta
Sopa de ajo                 | 250ml | 185 kcal | alta
Crema de verduras           | 250ml | 110 kcal | alta

### Categoria H — Tapas y aperitivos

Patatas bravas (racion)     | 150g | 285 kcal | maxima
Patatas alioli (racion)     | 150g | 310 kcal | maxima
Jamon serrano (racion)      |  50g | 145 kcal | alta
Jamon iberico (racion)      |  50g | 175 kcal | alta
Queso manchego (racion)     |  60g | 220 kcal | alta
Aceitunas (racion)          |  50g |  90 kcal | media
Ensaladilla rusa            | 150g | 280 kcal | maxima
Pimientos del piquillo      | 100g |  75 kcal | media

### Categoria I — Platos regionales unicos

Pisto manchego              | 200g | 160 kcal | alta
Migas                       | 200g | 380 kcal | alta
Papas con mojo (canario)    | 200g | 240 kcal | alta
Empanada gallega (porcion)  | 120g | 320 kcal | alta
Crema catalana              | 150g | 210 kcal | alta
Flan casero                 | 120g | 175 kcal | alta
Natillas                    | 150g | 190 kcal | alta

---

## 5. Factores de coccion criticos

Estos son los factores que mas afectan la precision y que Claude ignora:

### Aceite de oliva — el factor mas importante

Absorcion de aceite segun metodo:
  Frituray en aceite abundante (patatas, croquetas): 8-12% del peso final
  Salteado/rehogado: 3-5% del peso del ingrediente
  Sofrito de cebolla+tomate (base española): 15-20g aceite por racion
  Pan con aceite (frotado): 8-12g por rebanada media

Regla practica para Claude:
  Una racion de sofrito base que aparece en casi todo plato español: +80-100 kcal

### Mermas por coccion

Carne roja a la plancha: -25 a -35% (pierde agua y grasa)
Pollo a la plancha: -20 a -30%
Pescado a la plancha: -15 a -20%
Legumbres secas cocidas: +150% peso (absorben agua)
  100g lentejas secas = 250g lentejas cocidas
Arroz cocido: +200% peso
  100g arroz seco = 300g arroz cocido
Pasta cocida: +150% peso
  100g pasta seca = 250g pasta cocida

### Porciones españolas de referencia

Legumbres cocinadas: 300-400g por plato
Arroz cocinado (plato principal): 300-350g
Pasta cocinada (primer plato): 200-250g
Carne (segundo plato): 150-200g
Pescado (segundo plato): 150-200g
Sopa/crema (primer plato): 250-300ml
Ensalada (primer plato): 150-200g
Pan de acompañamiento: 50-80g

---

## 6. Schema SQL completo

CREATE TABLE spanish_dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identificacion
  nombre TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  subcategoria TEXT,

  -- Matching
  aliases TEXT NOT NULL DEFAULT '[]',
  token_principal TEXT NOT NULL,
  tokens_secundarios TEXT DEFAULT '[]',
  tokens_exclusion TEXT DEFAULT '[]',

  -- Porcion de referencia
  porcion_g INTEGER NOT NULL,
  porcion_desc TEXT NOT NULL,

  -- Macros por porcion de referencia
  kcal_ref INTEGER NOT NULL,
  kcal_min INTEGER NOT NULL,
  kcal_max INTEGER NOT NULL,
  proteina_g REAL NOT NULL,
  carbos_g REAL NOT NULL,
  grasa_g REAL NOT NULL,
  fibra_g REAL,

  -- Macros por 100g (para ajustes proporcionales)
  kcal_per_100g REAL NOT NULL,
  proteina_per_100g REAL NOT NULL,
  carbos_per_100g REAL NOT NULL,
  grasa_per_100g REAL NOT NULL,

  -- Variantes (JSON array de objetos)
  -- [{"nombre": "con cebolla", "kcal_delta": 20, "nota": "..."}]
  variantes TEXT DEFAULT '[]',

  -- Contexto para Claude
  notas_claude TEXT,
  factores_variables TEXT,

  -- Metadata de calidad
  fuente_primaria TEXT NOT NULL,
  fuentes_validacion TEXT DEFAULT '[]',
  confianza TEXT NOT NULL CHECK(confianza IN ('alta', 'media', 'baja')),
  metodo_calculo TEXT,

  -- Control
  creado_en INTEGER NOT NULL DEFAULT (unixepoch()),
  actualizado_en INTEGER NOT NULL DEFAULT (unixepoch()),
  revisado_por TEXT
);

CREATE INDEX idx_sd_nombre ON spanish_dishes(nombre);
CREATE INDEX idx_sd_categoria ON spanish_dishes(categoria);
CREATE INDEX idx_sd_token ON spanish_dishes(token_principal);

---

## 7. Algoritmo de matching — implementacion JavaScript

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/\b(me|he|he comido|comi|tome|un|una|unos|unas|el|la|los|las|de|con|sin|y|al|a|en)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchDish(userInput, dishes) {
  const input = normalize(userInput);
  const scores = [];

  for (const dish of dishes) {
    const exclusions = JSON.parse(dish.tokens_exclusion || '[]');
    
    // Si contiene token de exclusion, ignorar completamente
    if (exclusions.some(excl => input.includes(normalize(excl)))) continue;
    
    let score = 0;
    const dishNorm = normalize(dish.nombre);
    const aliases = JSON.parse(dish.aliases || '[]');
    const secondary = JSON.parse(dish.tokens_secundarios || '[]');

    // Nivel 1: Match exacto nombre
    if (dishNorm === input) { score = 100; }
    
    // Nivel 2: Match exacto en alias
    else if (aliases.some(a => normalize(a) === input)) { score = 95; }
    
    // Nivel 3: Todos los tokens del nombre en el input
    else if (dishNorm.split(' ').every(t => input.includes(t))) { score = 85; }
    
    // Nivel 4: Token principal + al menos un secundario
    else if (input.includes(dish.token_principal) && 
             secondary.some(s => input.includes(normalize(s)))) { score = 75; }
    
    // Nivel 5: Solo token principal (ambiguo)
    else if (input.includes(dish.token_principal)) { score = 50; }

    if (score > 0) scores.push({ dish, score });
  }

  scores.sort((a, b) => b.score - a.score);
  
  if (!scores.length) return null;
  
  const best = scores[0];
  
  if (best.score >= 85) return { dish: best.dish, confidence: 'high' };
  if (best.score >= 75) return { dish: best.dish, confidence: 'medium' };
  if (best.score >= 50) return { dish: best.dish, confidence: 'low' };
  
  return null;
}

---

## 8. Inyeccion en el prompt de Claude — templates

### Match de alta confianza (score >= 85)

DATOS OFICIALES VERIFICADOS — USAR COMO BASE OBLIGATORIA:
Fuente: {fuente_primaria}
Plato identificado: {nombre}
Porcion de referencia: {porcion_g}g ({porcion_desc})

Valores por porcion de referencia:
  Calorias: {kcal_ref} kcal [rango verificado: {kcal_min}-{kcal_max} kcal]
  Proteina: {proteina_g}g
  Carbohidratos: {carbos_g}g
  Grasa: {grasa_g}g

Instruccion: Estos valores son datos oficiales españoles verificados.
Usaros como base. Ajusta proporcionalmente si el usuario indica
cantidad diferente a la porcion de referencia.
{notas_claude}

### Match de confianza media (score 75-84)

POSIBLE COINCIDENCIA EN BASE DE DATOS ESPAÑOLA:
Plato probable: {nombre} ({porcion_g}g = {kcal_ref} kcal)
Confianza: MEDIA — verifica por contexto antes de usar.
{notas_claude}
Si el plato coincide, usa estos valores como base.

### Match de baja confianza (score 50-74)

POSIBLE REFERENCIA (verificar con el usuario):
El texto menciona "{token_principal}" — podria ser {nombre}.
Si es asi: {porcion_g}g = {kcal_ref} kcal [{kcal_min}-{kcal_max}]
Indica en las notas de tu respuesta si hay ambiguedad.

---

## 9. Casos especiales y desambiguacion

### El problema "tortilla"

Si meal_type = desayuno o almuerzo ligero:
  probabilidad 70% tortilla francesa, 30% española
Si meal_type = comida o cena:
  probabilidad 85% tortilla española, 15% francesa
Si texto dice "de patata/s" o "española":
  100% tortilla española
Si texto dice "francesa" o "solo huevo":
  100% tortilla francesa (NO hacer match con la española)

### El problema "arroz"

Sin contexto: asumir arroz blanco como guarnico (170 kcal/100g cocido)
Con "paella": paella valenciana
Con "leche": arroz con leche
Con "negro" o "tinta": arroz negro

### El problema "ensalada"

Sin especificar: ensalada mixta española (100 kcal/100g)
  (lechuga, tomate, atun, aceitunas, huevo)
"Cesar": 150-200 kcal/100g
"Ensaladilla": ir a ensaladilla rusa (280 kcal/150g)

---

## 10. Testing — casos de prueba obligatorios

Los inputs reales que hay que testear antes de lanzar:

// DEBEN matchear correctamente
"tortilla española" -> tortilla española, 600 kcal
"me he comido tortilla de patatas" -> tortilla española, 600 kcal
"pan con tomate" -> pan con tomate y aceite, 195 kcal
"pa amb tomàquet" -> pan con tomate y aceite, 195 kcal
"lentejas con chorizo" -> lentejas con chorizo, 480 kcal
"un plato de lentejas" -> lentejas con chorizo, 480 kcal
"gambas al ajillo" -> gambas al ajillo, 280 kcal
"bravas" -> patatas bravas, 285 kcal
"ensaladilla" -> ensaladilla rusa, 280 kcal
"bocata de jamon" -> bocadillo de jamon serrano, 415 kcal

// DEBEN dar match de baja confianza (ambiguos)
"tortilla" -> tortilla española, confidence: low
"arroz" -> no match o arroz blanco generico

// NO deben matchear (falsos positivos)
"tortilla mexicana" -> null
"wrap de tortilla" -> null
"pasta con gambas" -> null (gambas si, no "al ajillo")
"tortilla francesa" -> null (exclusion)

---

## 11. Seed SQL — primeros 10 platos listos para insertar

-- Insertar despues de crear la tabla
-- Verificar los valores contra BEDCA antes de insertar en produccion

INSERT INTO spanish_dishes VALUES (
  NULL, 'tortilla española', 'huevos', NULL,
  '["tortilla de patatas","tortilla de patata","tortilla con cebolla","tortilla casera","pincho de tortilla","trozo de tortilla"]',
  'tortilla', '["patata","patatas"]', '["francesa","maiz","mexicana","wrap"]',
  130, 'porcion individual (cuña mediana de 4-6 raciones)',
  600, 530, 680, 12.4, 22.8, 36.2, 1.8,
  462, 9.5, 17.5, 27.8,
  '[{"nombre":"con cebolla","kcal_delta":20},{"nombre":"pincho","kcal_delta":-400},{"nombre":"media tortilla","kcal_delta":600}]',
  'Porcion estandar española = cuña de tortilla de 4-6 raciones. Siempre lleva aceite de oliva. Si dice pequeña: 400 kcal. Grande: 750 kcal. NO confundir con tortilla francesa.',
  'Aceite es componente mas variable. Restaurantes usan mas aceite que casa.',
  'BEDCA + Moreiras et al.', '["AESAN","FatSecret España"]', 'alta',
  'Receta ref: 600g patata + 5 huevos + 43ml aceite absorbido. Calculo desde BEDCA.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'pan con tomate y aceite', 'pan_desayunos', NULL,
  '["pan con tomate","pa amb tomàquet","pan tumaca","tostada con tomate","pan tomate aceite","pan con tomate y aceite de oliva"]',
  'tomate', '["pan","aceite"]', '["mantequilla","mermelada","jamon"]',
  80, 'rebanada mediana con tomate y aceite',
  195, 155, 240, 4.2, 28.5, 7.8, 2.1,
  244, 5.2, 35.6, 9.8,
  '[{"nombre":"con jamon","kcal_delta":80},{"nombre":"tostada pequeña","kcal_delta":-50},{"nombre":"generoso en aceite","kcal_delta":40}]',
  'Porcion: 50g pan + 20g tomate frotado + 10g aceite oliva. Aceite es variable mas importante. En Barcelona suele ser mas generoso.',
  'Cantidad de aceite varia mucho segun region y persona.',
  'BEDCA ingredientes + calculo manual', '["AESAN"]', 'alta',
  'Pan 50g=130kcal + tomate 20g=4kcal + aceite 10g=90kcal = 224kcal ajustado 195kcal.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'bocadillo de jamon serrano', 'pan_desayunos', NULL,
  '["bocata de jamon","bocadillo de jamon","bocata jamon serrano","sandwich de jamon serrano"]',
  'bocadillo', '["jamon","jamon serrano"]', '["york","dulce","cocido","pavo"]',
  180, 'bocadillo estandar (barra 1/4 + jamon)',
  415, 360, 490, 24.8, 48.2, 13.5, 2.8,
  231, 13.8, 26.8, 7.5,
  '[{"nombre":"grande","kcal_delta":80},{"nombre":"con aceite","kcal_delta":80},{"nombre":"con tomate","kcal_delta":15}]',
  'Estandar: 110g pan barra + 70g jamon serrano. Sin aceite por defecto. Si dice con aceite: +80 kcal.',
  'Tamaño del pan es muy variable.',
  'BEDCA ingredientes', '["AESAN","FatSecret España"]', 'alta',
  'Pan barra 110g=285kcal + jamon serrano 70g (BEDCA 250kcal/100g)=175kcal = 460kcal ajustado 415kcal.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'patatas bravas', 'tapas', NULL,
  '["bravas","patatas con salsa brava","patatas en salsa picante","patatas bravas con alioli"]',
  'bravas', '["patatas"]', '[]',
  150, 'racion estandar de tapas',
  285, 240, 360, 4.2, 32.5, 15.8, 3.2,
  190, 2.8, 21.7, 10.5,
  '[{"nombre":"con alioli","kcal_delta":60},{"nombre":"con alioli y brava","kcal_delta":50},{"nombre":"media racion","kcal_delta":-140}]',
  'Racion: 120g patata frita + 30g salsa brava. La salsa tiene aceite — no ignorarla. Si dice con alioli ademas: +60 kcal.',
  'Salsa brava varia mucho entre establecimientos.',
  'BEDCA + calculo manual fritura', '["FatSecret España"]', 'alta',
  'Patata frita 120g (268kcal/100g BEDCA)=322kcal + salsa brava 30g=45kcal = 367kcal ajustado conservador 285kcal.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'lentejas con chorizo', 'legumbres', NULL,
  '["lentejas","lentejas estofadas","lentejas con morcilla","potaje de lentejas","lentejas a la española","lentejas guisadas"]',
  'lentejas', '["chorizo","morcilla"]', '[]',
  350, 'plato individual (primer plato español)',
  480, 400, 560, 28.4, 52.8, 14.2, 14.8,
  137, 8.1, 15.1, 4.1,
  '[{"nombre":"sin chorizo","kcal_delta":-80},{"nombre":"con morcilla","kcal_delta":20},{"nombre":"plato pequeño","kcal_delta":-130}]',
  'ATENCION: Porcion española de lentejas = 350g cocinadas, NO 180g. Claude subestima la porcion. 100g lentejas secas = 250g cocidas. Sofrito base ya incluido.',
  'Porcion es el error mas frecuente en este plato.',
  'BEDCA + Moreiras + calculo receta', '["AESAN"]', 'alta',
  'Receta ref por racion: 120g lentejas secas + 50g chorizo + sofrito. Calculo desde BEDCA = 480kcal.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'gazpacho', 'sopas', NULL,
  '["gazpacho andaluz","gazpacho casero","sopa fria de tomate"]',
  'gazpacho', '[]', '["caliente","manchego"]',
  250, 'vaso o bowl estandar (250ml)',
  105, 80, 145, 1.8, 8.5, 6.2, 1.5,
  42, 0.7, 3.4, 2.5,
  '[{"nombre":"industrial brick","kcal_delta":-20},{"nombre":"con picatostes","kcal_delta":60},{"nombre":"salmorejo","kcal_delta":90}]',
  'Casero lleva mas aceite que el brick. Diferenciarlo del salmorejo: mas denso, lleva pan, ~195kcal/200ml.',
  'Version casera vs industrial tiene diferencia notable.',
  'BEDCA + Moreiras', '["AESAN"]', 'alta',
  'Receta 1L: 800g tomate+100g pepino+50g pimiento+100ml aceite oliva = ~420kcal/L = 105kcal/250ml.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'croquetas caseras', 'carnes', NULL,
  '["croquetas","croquetas de jamon","croquetas de pollo","croquetas de bacalao","croqueta"]',
  'croquetas', '["jamon","pollo","bacalao"]', '[]',
  120, 'racion de 3 croquetas medianas (~40g c/u)',
  290, 250, 340, 9.8, 22.4, 18.6, 1.2,
  242, 8.2, 18.7, 15.5,
  '[{"nombre":"1 croqueta","kcal_delta":-193},{"nombre":"de restaurante grandes","kcal_delta":60},{"nombre":"de bacalao","kcal_delta":-20}]',
  'Croqueta casera media 40g = ~97 kcal. Racion estandar = 3 uds. Bar/restaurante suelen ser 50-60g c/u.',
  'Tamaño varia mucho. Rebozado y fritura = 40% de calorias totales.',
  'BEDCA + calculo rebozado y fritura', '["FatSecret España"]', 'media',
  'Bechamel jamon 60g=120kcal + rebozado 20g=55kcal + aceite absorbido 8g=72kcal = ~97kcal/croqueta x3 = 290kcal.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'paella valenciana', 'arroces', NULL,
  '["paella","paella de pollo y conejo","paella mixta","arroz con pollo y conejo"]',
  'paella', '["arroz","pollo"]', '["marisco"]',
  350, 'racion individual (plato principal)',
  520, 440, 620, 28.4, 64.5, 14.8, 2.8,
  149, 8.1, 18.4, 4.2,
  '[{"nombre":"paella de marisco","kcal_delta":-60},{"nombre":"mixta","kcal_delta":0},{"nombre":"racion pequeña","kcal_delta":-150}]',
  'Racion española de paella como plato principal = 350g. El arroz absorbe el aceite del sofrito. Valenciana = pollo + conejo + judias + garrofon.',
  'Racion real española es mayor que el estandar americano.',
  'BEDCA + Moreiras', '["AESAN"]', 'media',
  'Receta ref: 90g arroz seco (=270g cocido)+80g pollo+40g conejo+30g verduras+sofrito 15ml aceite = 520kcal.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'gambas al ajillo', 'pescados', NULL,
  '["gambas al ajillo","gambas con ajo","cazuela de gambas","gambas en cazuelita","langostinos al ajillo"]',
  'gambas', '["ajillo","ajo"]', '[]',
  200, 'cazuelita estandar (tapa o entrante)',
  280, 220, 340, 24.8, 2.2, 18.5, 0.2,
  140, 12.4, 1.1, 9.3,
  '[{"nombre":"como plato principal","kcal_delta":140},{"nombre":"con pan para mojar","kcal_delta":130}]',
  'Las gambas al ajillo tienen MUCHO aceite — no ignorarlo. 200g = 120g gambas + 80ml aceite+ajo. Aceite = 60% de calorias. Si mojan pan: +130 kcal.',
  'El aceite es el error principal de Claude con este plato.',
  'BEDCA ingredientes + calculo aceite', '["FatSecret España"]', 'alta',
  'Gambas peladas 120g=96kcal + aceite oliva 30ml generoso=240kcal + ajo=7kcal = 343kcal ajustado conservador 280kcal.',
  unixepoch(), unixepoch(), 'Luca'
);

INSERT INTO spanish_dishes VALUES (
  NULL, 'salmorejo', 'sopas', NULL,
  '["salmorejo cordobes","crema de tomate española","salmorejo con jamon"]',
  'salmorejo', '[]', '["gazpacho"]',
  200, 'bol individual estandar (200ml)',
  195, 165, 240, 4.8, 18.5, 11.2, 1.8,
  98, 2.4, 9.3, 5.6,
  '[{"nombre":"con jamon y huevo","kcal_delta":80},{"nombre":"sin guarnicion","kcal_delta":0},{"nombre":"vaso pequeño","kcal_delta":-80}]',
  'El salmorejo NO es gazpacho. Es mas denso, lleva pan, mas aceite, y se sirve en bol no en vaso. Diferencia clave: el pan aporta ~40 kcal extra vs gazpacho.',
  'Confusion frecuente con gazpacho. Son platos distintos.',
  'BEDCA + calculo manual', '["Moreiras"]', 'alta',
  'Receta 1L: 800g tomate+150g pan+120ml aceite = ~980kcal/L = 195kcal/200ml.',
  unixepoch(), unixepoch(), 'Luca'
);

---

## 12. Mantenimiento y expansion

### Cuando añadir un plato nuevo

1. Aparece en registros de usuarios con frecuencia (>5 veces/semana)
2. La estimacion de Claude difiere >20% del valor real calculado
3. Es un plato genuinamente español con porciones unicas

### Revision periodica (cada 3 meses)

- Revisar platos donde el motor de calibracion haya hecho mas correcciones
  (señal de que el dato curado puede ser incorrecto)
- Actualizar variantes segun feedback de usuarios
- Añadir aliases nuevos que aparezcan en los registros

### CHANGELOG_DISHES.md

Mantener un log con:
- Fecha de cada cambio
- Plato modificado
- Valor anterior y nuevo
- Motivo del cambio
- Fuente
