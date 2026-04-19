// ============================================================
//  scaleIngredients — escalado de gramos/ml en un string de
//  ingredientes. Paridad con scaleIngredientsGrams del worker
//  (worker/src/utils/calibratePlan.js).
//
//  Uso: cuando el user ajusta el factor de porción en Calculator
//  al registrar desde un plan del Chef, también re-escribimos los
//  ingredientes para que "150g pollo · 80g arroz" se convierta en
//  "225g pollo · 120g arroz" si el factor es 1.5×. Antes quedaban
//  incoherentes con los macros escalados.
//
//  Soporta:
//   - "60g avena" / "60G avena"
//   - "30ml aceite"
//   - Decimales con punto: "1.5g sal"
//   - Decimales con coma (locale ES): "1,5g sal"
//
//  NO toca:
//   - Números sin unidad g/ml ("4 huevos", "1 plátano", "1 cdta miel")
//
//  Output siempre entero (1,5g × 1.2 = 2g, no 1.8g).
// ============================================================

export function scaleIngredientsGrams(text: string, factor: number): string {
  if (!text) return text;
  return String(text).replace(/(\d+(?:[.,]\d+)?)(g|ml)\b/gi, (_match, num: string, unit: string) => {
    const value = parseFloat(num.replace(',', '.'));
    const scaled = Math.round(value * factor);
    return `${scaled}${unit.toLowerCase()}`;
  });
}
