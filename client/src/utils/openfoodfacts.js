// ============================================================
//  OPEN FOOD FACTS — fetchProductByBarcode, calculateNutrition
// ============================================================

export async function fetchProductByBarcode(barcode) {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) throw new Error('Network error');

    const data = await response.json();
    if (data.status !== 1) return null; // producto no encontrado

    const product    = data.product;
    const nutriments = product.nutriments ?? {};

    const kcal100 = nutriments['energy-kcal_100g'] != null
      ? Math.round(nutriments['energy-kcal_100g'])
      : nutriments['energy_100g'] != null
        ? Math.round(nutriments['energy_100g'] / 4.184)
        : undefined;

    return {
      barcode,
      name:     product.product_name || product.product_name_es || 'Producto desconocido',
      brand:    product.brands || '',
      image:    product.image_front_small_url || null,
      quantity: parseFloat(product.quantity) || 100,
      per_100g: {
        calories: kcal100,
        protein:  nutriments['proteins_100g']       != null ? Math.round(nutriments['proteins_100g']       * 10) / 10 : undefined,
        carbs:    nutriments['carbohydrates_100g']  != null ? Math.round(nutriments['carbohydrates_100g']  * 10) / 10 : undefined,
        fat:      nutriments['fat_100g']            != null ? Math.round(nutriments['fat_100g']            * 10) / 10 : undefined,
      },
    };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'timeout';
    return 'error';
  }
}

export function calculateNutrition(product, grams) {
  const f = grams / 100;
  const p = product.per_100g;
  return {
    calories: p.calories != null ? Math.round(p.calories * f)         : null,
    protein:  p.protein  != null ? Math.round(p.protein  * f * 10) / 10 : null,
    carbs:    p.carbs    != null ? Math.round(p.carbs    * f * 10) / 10 : null,
    fat:      p.fat      != null ? Math.round(p.fat      * f * 10) / 10 : null,
  };
}
