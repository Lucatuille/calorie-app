# Prompt para Claude Code — Fuentes de datos para Base de Datos de Platos Españoles

## Contexto del proyecto

Estoy construyendo una base de datos de platos españoles para Caliro, una app de nutrición con IA.
El objetivo es inyectar datos nutricionales verificados en el prompt de Claude cuando un usuario
describe o fotografía un plato español, para corregir el sesgo anglosajón del modelo.

La tabla `spanish_dishes` ya existe en D1 con su schema completo.
El sistema de matching y la inyección en el prompt ya están implementados.

Lo que falta: los datos nutricionales reales de cada plato.

---

## El problema de las fuentes

**BEDCA** (bedca.net) — la fuente oficial española del Ministerio de Sanidad — no tiene
descarga en Excel ni API. Solo es consulta web alimento por alimento. No es automatizable.

**AESAN** tiene un Excel descargable pero es de productos comerciales envasados (yogures,
galletas, conservas) — no sirve para ingredientes crudos ni platos caseros.

**La solución**: usar la API gratuita de USDA FoodData Central para ingredientes genéricos
(huevo, patata, aceite, carne, pescado) y BEDCA web solo para ingredientes específicamente
españoles que no existan en USDA (jamón serrano, chorizo, morcilla).

Los valores de ingredientes genéricos en USDA son prácticamente idénticos a BEDCA —
son los mismos análisis de laboratorio internacionales. La diferencia entre bases de datos
está en los platos preparados, no en los ingredientes crudos.

---

## Lo que necesito que hagas

### PASO 1 — Construir el extractor de USDA

Crea un script Node.js en `spanish-food/usda-extractor.js` que:

1. Consulte la API de USDA FoodData Central:
   ```
   GET https://api.nal.usda.gov/fdc/v1/foods/search
   ?query={ingrediente}
   &dataType=SR Legacy,Foundation
   &api_key=DEMO_KEY
   ```
   Usar `SR Legacy` y `Foundation` — son las categorías con datos de ingredientes crudos
   más fiables. Evitar `Branded` (productos comerciales) y `Survey` (estimaciones).

2. Para cada ingrediente devuelva un objeto limpio:
   ```json
   {
     "nombre_busqueda": "egg whole raw",
     "nombre_usda": "Egg, whole, raw, fresh",
     "fdcId": 171287,
     "fuente": "SR Legacy",
     "por_100g": {
       "kcal": 143,
       "proteina_g": 12.6,
       "carbos_g": 0.72,
       "grasa_g": 9.51,
       "fibra_g": 0
     }
   }
   ```

3. Si hay varios resultados para la misma búsqueda, seleccionar el de mayor confianza
   siguiendo esta prioridad: Foundation > SR Legacy > Survey FNDDS.

4. Guarde el resultado en `spanish-food/ingredients/usda_cache.json` para no
   repetir llamadas a la API.

La API key DEMO_KEY funciona para pruebas (límite 30 req/hora).
Si necesito más velocidad puedo registrarme gratis en api.nal.usda.gov para
obtener una key sin límite.

### PASO 2 — Extraer los ingredientes base

Usando el script del PASO 1, extrae estos ingredientes y guárdalos en
`spanish-food/ingredients/base_ingredients.json`:

Ingredientes a buscar (usa estas queries exactas para mejores resultados):
```
"egg whole raw"                    → huevo entero crudo
"potato raw"                       → patata cruda
"olive oil"                        → aceite de oliva
"wheat bread"                      → pan de trigo (barra)
"pork loin raw"                    → lomo de cerdo crudo
"chicken thigh raw"                → muslo de pollo crudo
"beef ground raw"                  → carne picada ternera cruda
"cod raw"                          → bacalao fresco crudo
"hake raw"                         → merluza cruda
"shrimp raw"                       → gambas crudas
"tomato raw"                       → tomate crudo
"onion raw"                        → cebolla cruda
"garlic raw"                       → ajo crudo
"lentils raw"                      → lentejas crudas
"chickpeas raw"                    → garbanzos crudos
"white rice raw"                   → arroz blanco crudo
"pasta raw"                        → pasta cruda
"milk whole"                       → leche entera
"flour wheat"                      → harina de trigo
"breadcrumbs"                      → pan rallado
"green beans raw"                  → judías verdes crudas
"potato fried in oil"              → patata frita en aceite
```

Para estos ingredientes específicamente españoles, USDA no tendrá
datos fiables — los buscaré manualmente en BEDCA y los añadiré al JSON:
```
jamón serrano
chorizo español
morcilla
sobrasada
```

### PASO 3 — Crear el calculador de recetas

Crea `spanish-food/recipe-calculator.js` que:

1. Lea `spanish-food/ingredients/base_ingredients.json`
2. Lea un archivo de receta JSON (ver formato abajo)
3. Calcule los macros totales de la receta
4. Divida por número de raciones → macros por porción
5. Calcule macros por 100g
6. Genere kcal_min y kcal_max aplicando los factores de varianza
7. Genere el objeto JSON final listo para insertar en spanish_dishes

**Formato de archivo de receta** (lo que yo proveo):
```json
{
  "nombre": "Tortilla española",
  "categoria": "huevos",
  "raciones": 4,
  "porcion_g": 130,
  "porcion_desc": "porción individual española estándar",
  "ingredientes": [
    {
      "nombre_usda": "potato fried in oil",
      "cantidad_g": 600,
      "nota": "patata ya frita, peso cocinado"
    },
    {
      "nombre_usda": "egg whole raw",
      "cantidad_g": 275,
      "nota": "5 huevos L sin cáscara, ajuste cocción -5%",
      "factor_coccion": 0.95
    },
    {
      "nombre_usda": "olive oil",
      "cantidad_g": 43,
      "nota": "aceite absorbido durante fritura (~30% del total usado)"
    }
  ],
  "varianza_pct": 12,
  "aliases": ["tortilla de patatas", "tortilla de patata", "tortilla casera"],
  "token_principal": "tortilla",
  "tokens_secundarios": ["patata", "patatas"],
  "tokens_exclusion": ["francesa", "de maiz", "mexicana"],
  "porciones_guia": [
    {"desc": "pincho bar", "g": 50},
    {"desc": "cuña pequeña", "g": 90},
    {"desc": "cuña estándar", "g": 130},
    {"desc": "cuña grande", "g": 180},
    {"desc": "media tortilla", "g": 260}
  ],
  "referencias_visuales": "Tortilla entera: 22-24cm diámetro, 3cm altura, ~600g total. Una cuña = 1/4 tortilla. Si ocupa 2/3 del plato: cuña grande ~180g. Pincho en plato pequeño de bar: ~50g.",
  "notas_claude": "La tortilla española siempre lleva aceite de oliva para freír la patata. NO confundir con tortilla francesa (solo huevo, ~145 kcal). Pincho: ~200 kcal. Media tortilla: ~900 kcal.",
  "fuente_primaria": "USDA SR Legacy + cálculo desde ingredientes",
  "confianza": "alta"
}
```

**Lo que calcula el script automáticamente:**
- `kcal_ref`, `proteina_g`, `carbos_g`, `grasa_g` (por porción)
- `kcal_per_100g`, `proteina_per_100g`, `carbos_per_100g`, `grasa_per_100g`
- `kcal_min` = kcal_ref × (1 - varianza_pct/100)
- `kcal_max` = kcal_ref × (1 + varianza_pct/100)
- `porciones_guia` kcal: para cada porción en porciones_guia,
  calcula (g / porcion_g) × kcal_ref y añade el campo `kcal`

**Output del script**: muestra en consola:
```
=== TORTILLA ESPAÑOLA ===
Por porción (130g):
  Calorías: 598 kcal [rango: 526 - 670]
  Proteína: 12.4g
  Carbos: 22.8g
  Grasa: 36.1g

Por 100g:
  Calorías: 460 kcal
  Proteína: 9.5g
  Carbos: 17.5g
  Grasa: 27.8g

Porciones guía:
  pincho bar (50g): 230 kcal
  cuña pequeña (90g): 414 kcal
  cuña estándar (130g): 598 kcal
  cuña grande (180g): 828 kcal
  media tortilla (260g): 1197 kcal

¿Los valores te parecen correctos? (y/n)
```

Si el usuario confirma con `y`, genera el INSERT SQL y lo añade a
`spanish-food/seeds/pending.sql`.

### PASO 4 — Integrar con seed-generator.js existente

El `seed-generator.js` que ya existe debe poder leer los archivos
de receta de `spanish-food/recipes/` y procesarlos todos en lote:

```
node spanish-food/seed-generator.js
```

Que haga:
1. Lee todos los .json de `spanish-food/recipes/`
2. Para cada uno llama al calculador
3. Muestra los resultados uno a uno pidiendo confirmación
4. Los confirmados los acumula en `spanish-food/seeds/confirmed.sql`
5. Al final muestra un resumen: X platos procesados, Y confirmados, Z pendientes

---

## Lo que NO debe hacer el script

- **No estimar ningún valor nutricional** — solo matemática con los
  datos de USDA. Si un ingrediente no está en `base_ingredients.json`,
  debe parar y avisarme para que lo añada manualmente.

- **No redondar agresivamente** — mantener un decimal en macros,
  números enteros solo en kcal.

- **No modificar la tabla spanish_dishes ni ejecutar migraciones**
  automáticamente — solo generar el SQL para que yo lo revise y ejecute.

---

## Estructura de carpetas esperada

```
spanish-food/
  BEDCA/                    ← para cuando añada datos manuales de BEDCA
  recipes/                  ← archivos JSON de recetas (uno por plato)
    huevos-rotos.json
    tortilla-española.json
    ...
  ingredients/
    base_ingredients.json   ← cache de datos USDA extraídos
    bedca_manual.json       ← ingredientes españoles de BEDCA (jamón, chorizo...)
  seeds/
    pending.sql             ← SQL generado pendiente de revisar
    confirmed.sql           ← SQL aprobado listo para migrar
  usda-extractor.js         ← extrae datos de la API de USDA
  recipe-calculator.js      ← calcula macros desde receta + ingredientes
  seed-generator.js         ← procesa todas las recetas en lote
  calculator.md             ← template de receta (ya existe)
```

---

## Orden de implementación

1. Primero `usda-extractor.js` + extracción de ingredientes base
2. Luego `recipe-calculator.js` con el formato de receta descrito
3. Luego integración con `seed-generator.js`
4. Test completo con la receta de huevos-rotos.json que ya tengo

Muéstrame cada script completo antes de ejecutarlo.
No toques nada de la app principal ni del Worker.
