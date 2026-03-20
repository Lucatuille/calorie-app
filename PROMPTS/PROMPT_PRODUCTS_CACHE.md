# 🗄️ Caché de productos escaneados en D1

## Contexto
Añadir una tabla `products_cache` en D1 que almacena productos escaneados de Open Food Facts. Cuando el usuario escanea un código de barras, se busca primero en D1 (respuesta instantánea). Solo si no está en caché se consulta Open Food Facts, y el resultado se guarda para futuros escaneos. Con el tiempo se construye una base de datos propia de productos relevantes para los usuarios de la app.

---

## 1. BASE DE DATOS — Nueva tabla en D1

**Avisar para ejecutar en D1 Console:**

```sql
CREATE TABLE products_cache (
  barcode         TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  brand           TEXT DEFAULT '',
  image_url       TEXT DEFAULT '',
  quantity        REAL DEFAULT 100,
  quantity_unit   TEXT DEFAULT 'g',
  calories_100g   REAL NOT NULL,
  protein_100g    REAL DEFAULT 0,
  carbs_100g      REAL DEFAULT 0,
  fat_100g        REAL DEFAULT 0,
  source          TEXT DEFAULT 'openfoodfacts',
  scan_count      INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_products_barcode ON products_cache(barcode);
CREATE INDEX idx_products_scan_count ON products_cache(scan_count DESC);
```

**Campos importantes:**
- `barcode` — PRIMARY KEY, el EAN-13/EAN-8 del producto
- `scan_count` — cuántas veces se ha escaneado. Útil para ver los productos más populares en el admin
- `source` — de dónde vienen los datos ('openfoodfacts' o 'manual' si el usuario los introduce)

---

## 2. WORKER — Nuevos endpoints

Crear `worker/src/routes/products.js`:

### GET /api/products/:barcode
Buscar producto en caché:

```js
export async function getProduct(barcode, env) {
  const product = await env.DB.prepare(
    'SELECT * FROM products_cache WHERE barcode = ?'
  ).bind(barcode).first();

  if (!product) return null;

  // Incrementar scan_count
  await env.DB.prepare(
    'UPDATE products_cache SET scan_count = scan_count + 1, updated_at = datetime("now") WHERE barcode = ?'
  ).bind(barcode).run();

  return product;
}
```

### POST /api/products/cache
Guardar producto nuevo en caché (llamado desde el frontend después de consultar Open Food Facts):

```js
export async function cacheProduct(productData, env) {
  const {
    barcode, name, brand, image_url, quantity, quantity_unit,
    calories_100g, protein_100g, carbs_100g, fat_100g, source
  } = productData;

  await env.DB.prepare(`
    INSERT INTO products_cache 
    (barcode, name, brand, image_url, quantity, quantity_unit,
     calories_100g, protein_100g, carbs_100g, fat_100g, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(barcode) DO UPDATE SET
      scan_count = scan_count + 1,
      updated_at = datetime('now')
  `).bind(
    barcode, name, brand || '', image_url || '',
    quantity || 100, quantity_unit || 'g',
    calories_100g, protein_100g || 0,
    carbs_100g || 0, fat_100g || 0,
    source || 'openfoodfacts'
  ).run();
}
```

### GET /api/admin/products (añadir al panel admin)
Stats de productos en caché para el panel admin:

```js
// Devuelve:
{
  total_products: 247,
  top_products: [
    { name: 'Oikos yogur griego', brand: 'Danone', scan_count: 12 },
    { name: 'Coca-Cola Zero', brand: 'Coca-Cola', scan_count: 8 },
    ...
  ]
}
```

Registrar rutas en `worker/src/index.js`:
```js
// Rutas públicas (requieren auth pero no admin):
router.get('/api/products/:barcode', requireAuth, getProduct)
router.post('/api/products/cache', requireAuth, cacheProduct)

// Ruta admin:
router.get('/api/admin/products', requireAdmin, getAdminProductStats)
```

---

## 3. FRONTEND — Actualizar flujo del escáner

En `client/src/utils/openfoodfacts.js`, actualizar `fetchProductByBarcode`:

```js
export async function fetchProductByBarcode(barcode, token) {
  // PASO 1 — Buscar en caché D1 primero
  try {
    const cacheResponse = await fetch(`/api/products/${barcode}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (cacheResponse.ok) {
      const cached = await cacheResponse.json();
      if (cached) {
        // Hit de caché — respuesta instantánea
        return {
          barcode: cached.barcode,
          name: cached.name,
          brand: cached.brand,
          image: cached.image_url,
          quantity: cached.quantity,
          quantity_unit: cached.quantity_unit,
          per_100g: {
            calories: cached.calories_100g,
            protein:  cached.protein_100g,
            carbs:    cached.carbs_100g,
            fat:      cached.fat_100g,
          },
          from_cache: true  // para mostrar un indicador sutil si se quiere
        };
      }
    }
  } catch {} // Si falla el caché, continuar con Open Food Facts

  // PASO 2 — Consultar Open Food Facts
  const product = await fetchFromOpenFoodFacts(barcode);
  
  if (product && product !== 'timeout' && product !== 'error') {
    // PASO 3 — Guardar en caché D1 (fire and forget — no bloquear el UX)
    fetch('/api/products/cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        barcode,
        name: product.name,
        brand: product.brand,
        image_url: product.image,
        quantity: product.quantity,
        quantity_unit: product.quantity_unit,
        calories_100g: product.per_100g.calories,
        protein_100g:  product.per_100g.protein,
        carbs_100g:    product.per_100g.carbs,
        fat_100g:      product.per_100g.fat,
        source: 'openfoodfacts'
      })
    }).catch(() => {}); // silencioso
  }

  return product;
}
```

### Pasar el token al escáner
En `BarcodeScanner.jsx`, asegurarse de que se pasa el token de auth a `fetchProductByBarcode`:

```jsx
// Obtener token del AuthContext
const { token } = useAuth();

// Al detectar código:
const product = await fetchProductByBarcode(decodedText, token);
```

---

## 4. INDICADOR VISUAL SUTIL (opcional pero bonito)

Cuando el producto viene de caché, mostrar un indicador discreto en la pantalla de resultado:

```jsx
{product.from_cache && (
  <span style={{
    fontSize: '11px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }}>
    ⚡ Carga instantánea
  </span>
)}
```

Pequeño, discreto, pero el usuario nota que la app es rápida.

---

## 5. PANEL ADMIN — Añadir sección de productos

En la tab "IA & Uso" del panel admin, añadir una nueva sección:

```
📦 BASE DE DATOS DE PRODUCTOS
─────────────────────────────────────────
Total productos en caché: 247

Top productos más escaneados:
1. Oikos yogur griego (Danone)      12x
2. Coca-Cola Zero (Coca-Cola)        8x
3. Activia fresa (Danone)            6x
4. Leche entera (Hacendado)          5x
5. Pechuga de pavo (ElPozo)          4x
```

Esto te da visibilidad de qué productos usan más tus usuarios — muy útil para entender hábitos.

---

## 6. ORDEN DE IMPLEMENTACIÓN

1. SQL en D1 — avisarme para ejecutar la tabla `products_cache`
2. Crear `worker/src/routes/products.js` con los 3 endpoints
3. Registrar rutas en `worker/src/index.js`
4. Actualizar `GET /api/admin/products` para stats
5. Desplegar Worker: `cd worker && npm run deploy`
6. Actualizar `client/src/utils/openfoodfacts.js` con el nuevo flujo cache-first
7. Pasar token al escáner en `BarcodeScanner.jsx`
8. Añadir indicador "⚡ Carga instantánea" en resultado
9. Añadir sección de productos en panel admin (tab IA & Uso)

---

## 7. RESULTADO ESPERADO

```
Primera vez que escaneas un producto:
→ No está en D1
→ Consulta Open Food Facts (~2-4 segundos)
→ Guarda en D1 silenciosamente
→ Muestra resultado

Segunda vez (mismo producto):
→ Encuentra en D1
→ Respuesta instantánea < 100ms ⚡
→ Muestra "⚡ Carga instantánea"
```

Con el tiempo, los productos más comunes de tus usuarios (yogures, lácteos, productos de supermercado español) estarán siempre en caché. La experiencia se vuelve instantánea para el uso diario.

---

## 8. AL FINALIZAR

- Escanear el mismo producto dos veces — la segunda debe ser notablemente más rápida
- Verificar en D1 Console que la tabla `products_cache` tiene filas
- Verificar que `scan_count` se incrementa en escaneos repetidos
- `git add . && git commit -m "feat: caché de productos escaneados en D1" && git push`
- Marcar en ROADMAP.md como completado
