// ============================================================
//  TESTS — calibratePlan
//  Ejecutar: cd worker && npx vitest run src/utils/__tests__/calibratePlan.test.js
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  calibrateMeals,
  scaleIngredientsGrams,
  recomputeTotals,
} from '../calibratePlan.js';

describe('scaleIngredientsGrams', () => {
  it('escala gramos con factor 1.2', () => {
    expect(scaleIngredientsGrams('60g avena · 150g yogur', 1.2))
      .toBe('72g avena · 180g yogur');
  });

  it('no toca números sin sufijo "g"', () => {
    expect(scaleIngredientsGrams('1 plátano · 1 cdta miel', 1.2))
      .toBe('1 plátano · 1 cdta miel');
  });

  it('mezcla gramos + no-gramos correctamente', () => {
    expect(scaleIngredientsGrams('60g avena · 1 plátano · 150g yogur · 1 cdta miel', 1.5))
      .toBe('90g avena · 1 plátano · 225g yogur · 1 cdta miel');
  });

  it('redondea al entero más cercano', () => {
    expect(scaleIngredientsGrams('100g pollo', 1.07))
      .toBe('107g pollo');
    expect(scaleIngredientsGrams('100g pollo', 0.85))
      .toBe('85g pollo');
  });

  it('case insensitive (acepta G mayúscula)', () => {
    expect(scaleIngredientsGrams('60G avena', 1.2)).toBe('72g avena');
  });

  it('factor 1.0 no cambia nada', () => {
    expect(scaleIngredientsGrams('60g avena · 150g yogur', 1.0))
      .toBe('60g avena · 150g yogur');
  });
});

describe('calibrateMeals — tolerancia y extremos', () => {
  it('factor en tolerancia (0.92-1.10) NO escala', () => {
    const meals = [{ kcal: 1000, protein: 50, carbs: 100, fat: 30 }];
    const res = calibrateMeals(meals, 1050); // factor 1.05
    expect(res.calibrated).toBe(false);
    expect(meals[0].kcal).toBe(1000); // sin cambios
  });

  it('factor extremo (>1.4) NO escala, marca extreme', () => {
    const meals = [{ kcal: 500, protein: 25, carbs: 50, fat: 15 }];
    const res = calibrateMeals(meals, 1000); // factor 2.0
    expect(res.calibrated).toBe(false);
    expect(res.extreme).toBe(true);
    expect(res.factor).toBe(2.0);
    expect(res.originalKcal).toBe(500);
    expect(meals[0].kcal).toBe(500);
  });

  it('factor extremo (<0.7) NO escala, marca extreme', () => {
    const meals = [{ kcal: 2000, protein: 100, carbs: 200, fat: 60 }];
    const res = calibrateMeals(meals, 1000); // factor 0.5
    expect(res.calibrated).toBe(false);
    expect(res.extreme).toBe(true);
  });

  it('array vacío → no calibra', () => {
    expect(calibrateMeals([], 1800).calibrated).toBe(false);
  });

  it('targetKcal 0 o negativo → no calibra, marca overBudgetSkipped', () => {
    const meals = [{ kcal: 500 }];
    const r0 = calibrateMeals(meals, 0);
    expect(r0.calibrated).toBe(false);
    expect(r0.overBudgetSkipped).toBe(true);
    const rNeg = calibrateMeals(meals, -100);
    expect(rNeg.calibrated).toBe(false);
    expect(rNeg.overBudgetSkipped).toBe(true);
  });

  it('originalKcal 0 → no calibra (división por cero)', () => {
    const meals = [{ kcal: 0, protein: 0, carbs: 0, fat: 0 }];
    expect(calibrateMeals(meals, 1800).calibrated).toBe(false);
  });
});

describe('calibrateMeals — legacy uniform (target numérico)', () => {
  it('factor 1.2 escala TODO uniformemente (proteína incluida)', () => {
    // Firma legacy: target numérico → escala uniforme (proteína no protegida).
    // Usado solo para compat con tests antiguos, callers nuevos pasan {kcal, protein}.
    const meals = [
      { kcal: 500, protein: 25, carbs: 50, fat: 15, ingredients: '100g arroz · 1 huevo' },
      { kcal: 500, protein: 30, carbs: 40, fat: 18, ingredients: '150g pollo · 200g brócoli' },
      { kcal: 500, protein: 20, carbs: 60, fat: 12, ingredients: '80g pasta · 30g tomate' },
    ];
    const res = calibrateMeals(meals, 1800); // factor 1.2

    expect(res.calibrated).toBe(true);
    expect(res.factor).toBeCloseTo(1.2, 2);

    expect(meals[0].kcal).toBe(600);
    expect(meals[0].protein).toBe(30); // 25 * 1.2 (uniforme)
    expect(meals[0].carbs).toBe(60);
    expect(meals[0].fat).toBe(18);
    expect(meals[0].ingredients).toBe('120g arroz · 1 huevo');

    expect(meals[1].ingredients).toBe('180g pollo · 240g brócoli');
    expect(meals[2].ingredients).toBe('96g pasta · 36g tomate');
  });

  it('factor 0.8 escala hacia abajo uniformemente (legacy)', () => {
    const meals = [
      { kcal: 1000, protein: 50, carbs: 100, fat: 30, ingredients: '200g pasta' },
      { kcal: 1000, protein: 60, carbs: 80,  fat: 40, ingredients: '300g carne' },
    ];
    const res = calibrateMeals(meals, 1600); // factor 0.8

    expect(res.calibrated).toBe(true);
    expect(meals[0].kcal).toBe(800);
    expect(meals[0].protein).toBe(40); // 50 * 0.8 uniforme
    expect(meals[0].ingredients).toBe('160g pasta');
    expect(meals[1].ingredients).toBe('240g carne');
  });
});

describe('calibrateMeals — protein-aware (target {kcal, protein})', () => {
  it('factor 1.2 hacia arriba: proteína protegida, solo C+F suben', () => {
    // Plan infra-calórico: 1500 → 1800. La proteína del plan ya cubre target.
    const meals = [
      { kcal: 500, protein: 30, carbs: 50, fat: 15 },
      { kcal: 500, protein: 40, carbs: 40, fat: 18 },
      { kcal: 500, protein: 30, carbs: 60, fat: 12 },
    ];
    const res = calibrateMeals(meals, { kcal: 1800, protein: 100 });

    expect(res.calibrated).toBe(true);
    // Proteína NO se escala — se queda en 30/40/30
    expect(meals[0].protein).toBe(30);
    expect(meals[1].protein).toBe(40);
    expect(meals[2].protein).toBe(30);
    // kcal sí llega cerca de 1800 (±5% por redondeo)
    const total = meals.reduce((s, m) => s + m.kcal, 0);
    expect(total).toBeGreaterThanOrEqual(1800 * 0.95);
    expect(total).toBeLessThanOrEqual(1800 * 1.05);
  });

  it('factor 0.8 hacia abajo: proteína protegida, solo C+F bajan', () => {
    const meals = [
      { kcal: 1000, protein: 60, carbs: 100, fat: 40 },
      { kcal: 1000, protein: 70, carbs: 80,  fat: 50 },
    ];
    const res = calibrateMeals(meals, { kcal: 1600, protein: 130 });

    expect(res.calibrated).toBe(true);
    // Proteína intacta — 60 y 70
    expect(meals[0].protein).toBe(60);
    expect(meals[1].protein).toBe(70);
    // Total kcal cerca de 1600
    const total = meals.reduce((s, m) => s + m.kcal, 0);
    expect(total).toBeGreaterThanOrEqual(1600 * 0.95);
    expect(total).toBeLessThanOrEqual(1600 * 1.05);
    // Carbs y grasa han bajado
    expect(meals[0].carbs).toBeLessThan(100);
    expect(meals[0].fat).toBeLessThan(40);
  });

  it('escalado de ingredientes + portion_g usa ratio kcal efectivo', () => {
    const meals = [{
      kcal: 400, protein: 30, carbs: 40, fat: 10,
      portion_g: 300,
      ingredients: '150g pollo · 80g arroz · 100g verdura',
    }];
    const res = calibrateMeals(meals, { kcal: 480, protein: 30 });
    expect(res.calibrated).toBe(true);
    // kcal → 480 (factor 1.2 global)
    expect(meals[0].kcal).toBeGreaterThanOrEqual(470);
    expect(meals[0].kcal).toBeLessThanOrEqual(490);
    // portion_g escalado proporcionalmente
    expect(meals[0].portion_g).toBeGreaterThanOrEqual(350);
    expect(meals[0].portion_g).toBeLessThanOrEqual(370);
  });

  it('fallback uniforme si la proteína sola excede el target kcal', () => {
    // Caso patológico: meal con 200g proteína = 800 kcal, target kcal 500.
    // Protección de proteína imposible → se usa fallback uniforme.
    const meals = [{ kcal: 800, protein: 200, carbs: 0, fat: 0 }];
    const res = calibrateMeals(meals, { kcal: 500, protein: 150 });
    // factor 0.625 está en [0.70, 1.40]? NO, 0.625 < 0.70 → extreme, no escala
    expect(res.calibrated).toBe(false);
    expect(res.extreme).toBe(true);
  });

  it('meal sin carbs ni grasa cae a uniforme (sin nada que rebalancear)', () => {
    // Meal solo de proteína pura. factor dentro de rango. Uniforme.
    const meals = [{ kcal: 400, protein: 100, carbs: 0, fat: 0 }];
    const res = calibrateMeals(meals, { kcal: 480, protein: 120 });
    expect(res.calibrated).toBe(true);
    // Sin C/F que escalar → fallback uniforme → protein escala a 120
    expect(meals[0].kcal).toBe(480);
    expect(meals[0].protein).toBe(120);
  });
});

describe('recomputeTotals', () => {
  it('suma kcal/protein/carbs/fat', () => {
    const meals = [
      { kcal: 300, protein: 20, carbs: 30, fat: 8 },
      { kcal: 500, protein: 30, carbs: 50, fat: 15 },
    ];
    const totals = recomputeTotals(meals);
    expect(totals).toEqual({ kcal: 800, protein: 50, carbs: 80, fat: 23 });
  });

  it('maneja meals con campos missing', () => {
    const meals = [
      { kcal: 300 },
      { protein: 20 },
    ];
    const totals = recomputeTotals(meals);
    expect(totals).toEqual({ kcal: 300, protein: 20, carbs: 0, fat: 0 });
  });

  it('array vacío → todo 0', () => {
    expect(recomputeTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
