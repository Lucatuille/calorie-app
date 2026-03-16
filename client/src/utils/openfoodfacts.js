// ============================================================
//  OPEN FOOD FACTS — fetchProductByBarcode, calculateNutrition
// ============================================================

function fetchWithTimeout(url, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  );
  return Promise.race([fetch(url), timeout]);
}

async function fetchOnce(barcode, onDebug) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  onDebug?.(`→ GET ${url}`);

  const response = await fetchWithTimeout(url, 12000);
  onDebug?.(`← HTTP ${response.status}`);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  onDebug?.(`JSON status: ${data.status} (1=encontrado, 0=no encontrado)`);
  return data;
}

export async function fetchProductByBarcode(barcode, onDebug) {
  let data;
  try {
    data = await fetchOnce(barcode, onDebug);
  } catch (err) {
    onDebug?.(`✗ Error: ${err.name} — ${err.message}`);
    if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.message === 'timeout') {
      onDebug?.('Reintentando...');
      try {
        data = await fetchOnce(barcode, onDebug);
      } catch (err2) {
        onDebug?.(`✗ Reintento fallido: ${err2.message}`);
        return 'timeout';
      }
    } else {
      return 'error';
    }
  }

  try {
    if (data.status !== 1) return null;

    const product    = data.product;
    const nutriments = product.nutriments ?? {};

    const kcal100 = nutriments['energy-kcal_100g'] != null
      ? Math.round(nutriments['energy-kcal_100g'])
      : nutriments['energy_100g'] != null
        ? Math.round(nutriments['energy_100g'] / 4.184)
        : undefined;

    onDebug?.(`✓ Producto: "${product.product_name}" — ${kcal100 ?? '?'} kcal/100g`);

    return {
      barcode,
      name:     product.product_name || product.product_name_es || 'Producto desconocido',
      brand:    product.brands || '',
      image:    product.image_front_small_url || null,
      quantity: parseFloat(product.quantity) || 100,
      per_100g: {
        calories: kcal100,
        protein:  nutriments['proteins_100g']      != null ? Math.round(nutriments['proteins_100g']      * 10) / 10 : undefined,
        carbs:    nutriments['carbohydrates_100g'] != null ? Math.round(nutriments['carbohydrates_100g'] * 10) / 10 : undefined,
        fat:      nutriments['fat_100g']           != null ? Math.round(nutriments['fat_100g']           * 10) / 10 : undefined,
      },
    };
  } catch (err) {
    onDebug?.(`✗ Parse error: ${err.message}`);
    return 'error';
  }
}

export function calculateNutrition(product, grams) {
  const f = grams / 100;
  const p = product.per_100g;
  return {
    calories: p.calories != null ? Math.round(p.calories * f)           : null,
    protein:  p.protein  != null ? Math.round(p.protein  * f * 10) / 10 : null,
    carbs:    p.carbs    != null ? Math.round(p.carbs    * f * 10) / 10 : null,
    fat:      p.fat      != null ? Math.round(p.fat      * f * 10) / 10 : null,
  };
}
