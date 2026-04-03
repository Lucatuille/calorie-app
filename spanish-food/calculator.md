# Spanish Dishes Calculator — Workflow

## How to add a new dish

### Step 1: You create a recipe file

Create `spanish-food/recipes/nombre-del-plato.json`:

```json
{
  "nombre": "Huevos rotos",
  "categoria": "Huevos y tortillas",
  
  "receta_referencia": {
    "porciones": 1,
    "nota": "ración individual típica de bar/casa",
    "ingredientes": [
      { "nombre": "patatas fritas en aceite", "g": 150, "bedca": "Patata frita" },
      { "nombre": "huevos",                   "g": 110, "bedca": "Huevo frito", "unidades": 2 },
      { "nombre": "jamón serrano",             "g": 30,  "bedca": "Jamón serrano" },
      { "nombre": "aceite oliva absorbido",    "g": 10,  "bedca": "Aceite de oliva virgen" }
    ]
  },

  "aliases": ["huevos rotos con jamon", "huevos rotos con patatas"],
  "token_principal": "huevos rotos",
  "tokens_secundarios": ["patatas", "jamon"],
  "tokens_exclusion": [],

  "porcion_desc": "ración individual",

  "porciones_guia": [
    { "desc": "media ración", "factor": 0.6 },
    { "desc": "ración estándar", "factor": 1.0 },
    { "desc": "ración grande", "factor": 1.4 }
  ],

  "referencias_visuales": "Plato llano con patatas rotas y huevos encima. Ración estándar = plato mediano cubierto. El huevo roto encima añade color amarillo visible.",

  "notas_claude": "Los huevos rotos SIEMPRE llevan patatas fritas (no cocidas). El jamón es opcional pero muy común. El aceite de la fritura es el componente más variable.",

  "fuente_primaria": "BEDCA + cálculo desde ingredientes",
  "confianza": "alta",

  "validacion_cruzada": {
    "moreiras": null,
    "fatsecret_media": null,
    "notas": "Pendiente de validar"
  }
}
```

### Step 2: Claude calculates

Give me the recipe file and I will:
1. Look up each ingredient in BEDCA (kcal, prot, carb, fat per 100g)
2. Calculate totals for the recipe
3. Divide by portions
4. Calculate per-100g values
5. Apply cooking factors (merma, absorción aceite)
6. Fill in kcal_min/kcal_max (±15% for alta confianza)
7. Calculate porciones_guia kcal from factors
8. Generate the complete SQL INSERT

### Step 3: You review

I'll show you the calculated values before inserting. You check:
- Does the kcal feel right for this dish?
- Are the portions realistic?
- Any variants missing from notas_claude?

### Step 4: I seed to D1

Run the generated SQL migration.

---

## BEDCA Reference Values (common ingredients)

Drop the BEDCA Excel in `spanish-food/BEDCA/`. I'll extract the values we need.

Meanwhile, these are the most-used ingredients (per 100g):

| Ingrediente | kcal | Prot | Carb | Grasa | Fuente |
|---|---|---|---|---|---|
| Aceite oliva virgen | 899 | 0 | 0 | 99.9 | BEDCA |
| Huevo entero crudo | 150 | 12.5 | 0.7 | 10.8 | BEDCA |
| Huevo frito | 210 | 14.0 | 0.8 | 16.8 | BEDCA |
| Patata cruda | 80 | 2.0 | 17.0 | 0.1 | BEDCA |
| Patata frita | 268 | 3.5 | 35.0 | 13.0 | BEDCA |
| Pan blanco barra | 258 | 8.5 | 52.0 | 1.5 | BEDCA |
| Jamón serrano | 241 | 31.0 | 0.5 | 12.5 | BEDCA |
| Jamón ibérico | 350 | 28.0 | 0 | 26.0 | BEDCA |
| Arroz blanco cocido | 130 | 2.7 | 28.0 | 0.3 | BEDCA |
| Arroz blanco seco | 364 | 6.7 | 81.6 | 0.9 | BEDCA |
| Lentejas cocidas | 116 | 9.0 | 16.5 | 0.5 | BEDCA |
| Garbanzos cocidos | 164 | 8.9 | 22.5 | 2.6 | BEDCA |
| Pollo pechuga crudo | 112 | 21.8 | 0 | 2.8 | BEDCA |
| Pollo pechuga plancha | 148 | 29.0 | 0 | 3.5 | BEDCA (est.) |
| Ternera filete crudo | 131 | 20.5 | 0 | 5.5 | BEDCA |
| Chorizo | 380 | 22.0 | 2.0 | 32.0 | BEDCA |
| Merluza cruda | 82 | 17.0 | 0 | 1.5 | BEDCA |
| Gamba cruda | 81 | 17.6 | 0.5 | 1.0 | BEDCA |
| Tomate maduro | 22 | 1.0 | 3.5 | 0.2 | BEDCA |
| Cebolla | 40 | 1.2 | 8.0 | 0.2 | BEDCA |
| Pimiento rojo | 32 | 1.0 | 6.4 | 0.3 | BEDCA |
| Leche entera | 63 | 3.1 | 4.7 | 3.5 | BEDCA |
| Harina trigo | 361 | 10.0 | 75.0 | 1.2 | BEDCA |
| Pan rallado | 380 | 12.0 | 72.0 | 4.5 | BEDCA |

---

## Cooking Factors

| Factor | Valor | Aplica a |
|---|---|---|
| Absorción aceite fritura abundante | 8-12% peso final | Patatas, croquetas, calamares |
| Absorción aceite salteado/rehogado | 3-5% peso ingrediente | Verduras, carnes |
| Sofrito base español (por ración) | +80-100 kcal | Legumbres, arroces, guisos |
| Merma carne roja plancha | -25 a -35% peso | Filetes, chuletas |
| Merma pollo plancha | -20 a -30% peso | Pechuga, muslo |
| Merma pescado plancha | -15 a -20% peso | Merluza, salmón |
| Legumbres secas → cocidas | ×2.5 peso | Lentejas, garbanzos |
| Arroz seco → cocido | ×3.0 peso | Todos los arroces |
| Pasta seca → cocida | ×2.5 peso | Todas las pastas |

---

## Quick Recipe Template (copy-paste)

```json
{
  "nombre": "",
  "categoria": "",
  "receta_referencia": {
    "porciones": 1,
    "nota": "",
    "ingredientes": [
      { "nombre": "", "g": 0, "bedca": "" }
    ]
  },
  "aliases": [],
  "token_principal": "",
  "tokens_secundarios": [],
  "tokens_exclusion": [],
  "porcion_desc": "",
  "porciones_guia": [
    { "desc": "", "factor": 0.6 },
    { "desc": "", "factor": 1.0 },
    { "desc": "", "factor": 1.4 }
  ],
  "referencias_visuales": "",
  "notas_claude": "",
  "fuente_primaria": "BEDCA + cálculo desde ingredientes",
  "confianza": "alta"
}
```
