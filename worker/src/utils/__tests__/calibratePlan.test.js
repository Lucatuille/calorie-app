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

  it('factor extremo (>1.4) NO escala', () => {
    const meals = [{ kcal: 500, protein: 25, carbs: 50, fat: 15 }];
    const res = calibrateMeals(meals, 1000); // factor 2.0
    expect(res.calibrated).toBe(false);
    expect(res.extreme).toBe(true);
    expect(meals[0].kcal).toBe(500);
  });

  it('factor extremo (<0.7) NO escala', () => {
    const meals = [{ kcal: 2000, protein: 100, carbs: 200, fat: 60 }];
    const res = calibrateMeals(meals, 1000); // factor 0.5
    expect(res.calibrated).toBe(false);
    expect(res.extreme).toBe(true);
  });

  it('array vacío → no calibra', () => {
    expect(calibrateMeals([], 1800).calibrated).toBe(false);
  });

  it('targetKcal 0 o negativo → no calibra', () => {
    const meals = [{ kcal: 500 }];
    expect(calibrateMeals(meals, 0).calibrated).toBe(false);
    expect(calibrateMeals(meals, -100).calibrated).toBe(false);
  });

  it('originalKcal 0 → no calibra (división por cero)', () => {
    const meals = [{ kcal: 0, protein: 0, carbs: 0, fat: 0 }];
    expect(calibrateMeals(meals, 1800).calibrated).toBe(false);
  });
});

describe('calibrateMeals — escalamiento real', () => {
  it('escala factor 1.2 (1500 → 1800)', () => {
    const meals = [
      { kcal: 500, protein: 25, carbs: 50, fat: 15, ingredients: '100g arroz · 1 huevo' },
      { kcal: 500, protein: 30, carbs: 40, fat: 18, ingredients: '150g pollo · 200g brócoli' },
      { kcal: 500, protein: 20, carbs: 60, fat: 12, ingredients: '80g pasta · 30g tomate' },
    ];
    const res = calibrateMeals(meals, 1800); // factor exacto 1.2

    expect(res.calibrated).toBe(true);
    expect(res.factor).toBeCloseTo(1.2, 2);

    expect(meals[0].kcal).toBe(600);
    expect(meals[0].protein).toBe(30);
    expect(meals[0].carbs).toBe(60);
    expect(meals[0].fat).toBe(18);
    expect(meals[0].ingredients).toBe('120g arroz · 1 huevo');

    expect(meals[1].kcal).toBe(600);
    expect(meals[1].ingredients).toBe('180g pollo · 240g brócoli');

    expect(meals[2].kcal).toBe(600);
    expect(meals[2].ingredients).toBe('96g pasta · 36g tomate');
  });

  it('escala factor 0.8 (2000 → 1600)', () => {
    const meals = [
      { kcal: 1000, protein: 50, carbs: 100, fat: 30, ingredients: '200g pasta' },
      { kcal: 1000, protein: 60, carbs: 80,  fat: 40, ingredients: '300g carne' },
    ];
    const res = calibrateMeals(meals, 1600); // factor 0.8

    expect(res.calibrated).toBe(true);
    expect(meals[0].kcal).toBe(800);
    expect(meals[0].ingredients).toBe('160g pasta');
    expect(meals[1].kcal).toBe(800);
    expect(meals[1].ingredients).toBe('240g carne');
  });

  it('caso reportado: 1400 con target 1800 → escala factor ~1.29', () => {
    const meals = [
      { kcal: 400, protein: 20, carbs: 50, fat: 10, ingredients: '60g avena · 1 plátano' },
      { kcal: 500, protein: 35, carbs: 45, fat: 12, ingredients: '150g pollo · 80g arroz' },
      { kcal: 200, protein: 10, carbs: 20, fat: 6,  ingredients: '125g yogur' },
      { kcal: 300, protein: 25, carbs: 25, fat: 8,  ingredients: '200g merluza · 100g patata' },
    ];
    const res = calibrateMeals(meals, 1800);

    expect(res.calibrated).toBe(true);
    const total = meals.reduce((s, m) => s + m.kcal, 0);
    expect(total).toBeGreaterThanOrEqual(1800 * 0.97); // dentro de ±3% por redondeo
    expect(total).toBeLessThanOrEqual(1800 * 1.03);
  });

  it('preserva ingredientes con mezcla de unidades', () => {
    const meals = [{
      kcal: 400, protein: 20, carbs: 40, fat: 10,
      ingredients: '50g avena · 1 plátano · 200g leche · 1 cdta miel · 30g nueces',
    }];
    const res = calibrateMeals(meals, 480); // factor 1.2
    expect(res.calibrated).toBe(true);
    expect(meals[0].ingredients).toBe('60g avena · 1 plátano · 240g leche · 1 cdta miel · 36g nueces');
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
