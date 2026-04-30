# Plantilla — Artículo "Calorías de [plato]"

Plantilla para crear nuevos artículos de la serie **Calorías de platos** (datos verificados BEDCA, contenido denso, estilo wide sobrio).

## Antes de empezar

1. **Verificar BEDCA** — entrar en https://www.bedca.net y obtener kcal/proteína/grasa/carbo por 100 g de cada ingrediente principal
2. **Calcular receta de referencia** — receta clásica, cantidades estándar para 4-6 personas (o 20 unidades, etc.)
3. **Obtener total kcal y kcal/100 g** — sumar ingrediente a ingrediente
4. **Identificar el factor de variabilidad** — qué hace que el plato varíe ±15-30 % (aceite, ración, método de cocción…)
5. **Definir las 4 situaciones del hero** — narrativa de menos a más kcal o por contexto (casa / restaurante / bar / etc.)

## Datos requeridos

Antes de empezar a escribir, ten estos datos calculados:

```
Plato: ___________________
Receta de referencia: ___________________
Yield: ___ raciones / ___ unidades

Por porción estándar:
  - kcal: ___
  - proteína: ___ g
  - carbos: ___ g
  - grasa: ___ g
  - peso: ___ g
  - rango: ___ – ___ kcal

Por 100 g:
  - kcal: ___

Las 4 situaciones del hero (kcal · peso · contexto):
  1. ___________________
  2. ___________________
  3. ___________________
  4. ___________________

Range visualization (3 puntos según factor X):
  - bajo: ___ kcal (~___% factor)
  - estándar: ___ kcal (~___% factor)
  - alto: ___ kcal (~___% factor)
```

## Cómo usar la plantilla

1. **Copiar** `client/public/blog/calorias-croquetas.html` como referencia (es el template real, ya validado)
2. **Cambiar slug** en URL: `calorias-[plato]`
3. **Reemplazar todos los datos** del head (meta description, schemas BlogPosting/Recipe/FAQPage)
4. **Reescribir el body** manteniendo la estructura:
   - Title corto + subtitle italic
   - Lead con gancho de 1 dato sorprendente
   - 4 cards (sin emojis, solo tipografía)
   - Range viz con 3 markers
   - H2 metodología + tabla aportación por ingrediente
   - H2 factor de variabilidad + tabla
   - H2 mito común (si aplica) + tabla
   - H2 caseras vs bar / industrial / etc.
   - H2 estimar sin báscula → tabla de referencias visuales
   - H2 FAQ con accordion `<details>` (8 preguntas SEO)
   - Tabla nutricional completa final
   - CTA + disclaimer + autor + relacionados
5. **NO tocar** el CSS — usar `<link rel="stylesheet" href="/blog/blog-data.css">`
6. **Validar** Rich Results Test antes de publicar
7. **Actualizar** sitemap + index del blog

## Estructura del artículo (referencia)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <!-- SEO meta + Umami -->
  <!-- Schema BlogPosting con datePublished, image, author, publisher -->
  <!-- Schema Recipe con prepTime, cookTime, totalTime, ingredients, instructions, nutrition -->
  <!-- Schema FAQPage con 8 preguntas reales -->
  <link rel="stylesheet" href="/blog/blog-data.css">
</head>
<body>
  <nav>...</nav>

  <article class="article-wrap">
    <div class="article-meta">...</div>
    <h1 class="article-title">Calorías del [plato]</h1>
    <p class="article-subtitle">[Tagline editorial corta]</p>
    <p class="article-lead">[Gancho de 1 dato sorprendente]</p>

    <div class="article-body">
      <!-- 4 cards -->
      <div class="cards">...</div>

      <!-- Range viz -->
      <div class="range">...</div>

      <!-- Body con H2 -->
      <h2 id="metodologia">De dónde salen estas calorías</h2>
      ...
      <div class="table-wrap">
        <table class="data">...</table>
      </div>

      <!-- FAQ accordion -->
      <h2 id="faq">Preguntas frecuentes</h2>
      <div class="faq-list">
        <details>
          <summary>...</summary>
          <p>...</p>
        </details>
        <!-- 8 preguntas -->
      </div>

      <!-- Tabla técnica completa -->
      <h2 id="tabla-completa">Tabla nutricional completa por situación</h2>
      <div class="table-wrap"><table class="data">...</table></div>

      <!-- CTA + disclaimer + autor + relacionados -->
    </div>
  </article>

  <footer>...</footer>
</body>
</html>
```

## Reglas del estilo wide sobrio

- **Sin emojis** en cualquier parte del contenido
- **Sin colores brillantes** — solo verde Caliro como acento mínimo
- **Sin gradientes** ni decoración visual
- **Tablas limpias** — clase `.data` + wrapper `.table-wrap`. Highlight de fila con `class="highlight"`. Fila Caliro con `class="caliro"`. Total con `class="total"`
- **Notes/callouts** unificados con `.note` (un solo patrón)
- **FAQ siempre** accordion nativo `<details><summary>` (no JS)
- **Comparativas con apps** (MFP) usan `<span class="tag-text">` para descripciones
- **Reading time honesto** — calcular para 200 wpm, redondear a min más cercano

## Checklist antes de publicar

- [ ] BEDCA verificado para todos los ingredientes
- [ ] Cálculos sumados y validados (kcal totales, % por ingrediente, kcal/100 g)
- [ ] 3 schemas válidos en https://search.google.com/test/rich-results
- [ ] Imagen OG presente (`/og-image.png` por defecto, o crear específica)
- [ ] Slug correcto: `calorias-[plato]` (ej. `calorias-paella`)
- [ ] Mobile testeado (DevTools → modo dispositivo)
- [ ] Sitemap actualizado con nueva URL + lastmod actual
- [ ] Card en `/blog/index.html` añadida con orden cronológico (más nueva arriba)
- [ ] `dateModified` en home/blog del sitemap actualizado
- [ ] Search Console → solicitar indexación tras deploy

## Ideas para próximos artículos

Por orden de potencial SEO + estacionalidad:

1. **Calorías de la paella** — alto volumen búsqueda, plato icónico
2. **Calorías del bocadillo de jamón** — long-tail útil para almuerzo/desayuno
3. **Calorías del cocido / lentejas** — invierno, búsqueda alta
4. **Calorías de las patatas bravas** — tapa muy buscada
5. **Calorías de la ensaladilla rusa** — verano, búsqueda alta
6. **Calorías del gazpacho** — verano, salud-conscious

Cada uno sigue exactamente esta plantilla.
