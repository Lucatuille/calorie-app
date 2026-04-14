// ============================================================
//  TESTS — mealTypeInfer
//  Ejecutar: cd worker && npx vitest run src/utils/__tests__/mealTypeInfer.test.js
// ============================================================

import { describe, it, expect } from 'vitest';
import { resolveMealType, resolveMealTypesRegistered } from '../mealTypeInfer.js';

describe('resolveMealType — meal_type explícito', () => {
  it('devuelve español tal cual', () => {
    expect(resolveMealType({ meal_type: 'desayuno' })).toBe('desayuno');
    expect(resolveMealType({ meal_type: 'comida' })).toBe('comida');
    expect(resolveMealType({ meal_type: 'merienda' })).toBe('merienda');
    expect(resolveMealType({ meal_type: 'cena' })).toBe('cena');
  });

  it('traduce inglés a español', () => {
    expect(resolveMealType({ meal_type: 'breakfast' })).toBe('desayuno');
    expect(resolveMealType({ meal_type: 'lunch' })).toBe('comida');
    expect(resolveMealType({ meal_type: 'snack' })).toBe('merienda');
    expect(resolveMealType({ meal_type: 'dinner' })).toBe('cena');
  });

  it('es case-insensitive', () => {
    expect(resolveMealType({ meal_type: 'BREAKFAST' })).toBe('desayuno');
    expect(resolveMealType({ meal_type: ' Cena ' })).toBe('cena');
  });

  it('devuelve null si meal_type es "other" y no hay created_at', () => {
    expect(resolveMealType({ meal_type: 'other' })).toBe(null);
  });

  it('devuelve null si meal_type es desconocido sin hora', () => {
    expect(resolveMealType({ meal_type: 'brunch' })).toBe(null);
  });
});

describe('resolveMealType — inferencia por hora (Europe/Madrid)', () => {
  // Nota: Madrid es UTC+1 invierno, UTC+2 verano.
  // Uso fechas de verano (abril) → UTC+2.

  it('UTC 06:30 → 08:30 Madrid → desayuno', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 06:30:00',
    })).toBe('desayuno');
  });

  it('UTC 08:30 → 10:30 Madrid → desayuno', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 08:30:00',
    })).toBe('desayuno');
  });

  it('UTC 12:00 → 14:00 Madrid → comida', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 12:00:00',
    })).toBe('comida');
  });

  it('UTC 16:00 → 18:00 Madrid → merienda', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 16:00:00',
    })).toBe('merienda');
  });

  it('UTC 17:30 → 19:30 Madrid → cena', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 17:30:00',
    })).toBe('cena');
  });

  it('UTC 22:00 → 00:00 Madrid del día siguiente → desayuno (hora=0)', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 22:00:00',
    })).toBe('desayuno');
  });

  it('meal_type vacío string también infiere', () => {
    expect(resolveMealType({
      meal_type: '',
      created_at: '2026-04-14 12:00:00',
    })).toBe('comida');
  });

  it('meal_type null infiere', () => {
    expect(resolveMealType({
      meal_type: null,
      created_at: '2026-04-14 12:00:00',
    })).toBe('comida');
  });

  it('acepta timestamp numérico (unix ms)', () => {
    // 2026-04-14 12:00:00 UTC = ms
    const ms = Date.UTC(2026, 3, 14, 12, 0, 0); // month 0-indexed
    expect(resolveMealType({
      meal_type: 'other',
      created_at: ms,
    })).toBe('comida');
  });

  it('acepta formato ISO con T', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14T12:00:00Z',
    })).toBe('comida');
  });

  it('created_at inválido → null', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: 'not a date',
    })).toBe(null);
  });

  it('created_at undefined → null', () => {
    expect(resolveMealType({ meal_type: 'other' })).toBe(null);
  });

  it('invierno: UTC 09:00 → 10:00 Madrid (UTC+1) → desayuno', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-01-15 09:00:00',
    })).toBe('desayuno');
  });

  it('invierno: UTC 14:00 → 15:00 Madrid → comida', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-01-15 14:00:00',
    })).toBe('comida');
  });
});

describe('resolveMealTypesRegistered', () => {
  it('devuelve array vacío para entradas vacías', () => {
    expect(resolveMealTypesRegistered([])).toEqual([]);
    expect(resolveMealTypesRegistered(null)).toEqual([]);
    expect(resolveMealTypesRegistered(undefined)).toEqual([]);
  });

  it('deduplica tipos', () => {
    const entries = [
      { meal_type: 'breakfast' },
      { meal_type: 'desayuno' },
      { meal_type: 'lunch' },
    ];
    const result = resolveMealTypesRegistered(entries);
    expect(result.sort()).toEqual(['comida', 'desayuno']);
  });

  it('combina explícitos e inferidos', () => {
    const entries = [
      { meal_type: 'breakfast' },                                  // → desayuno
      { meal_type: 'other', created_at: '2026-04-14 12:00:00' },   // → comida
      { meal_type: 'dinner' },                                      // → cena
    ];
    const result = resolveMealTypesRegistered(entries);
    expect(result.sort()).toEqual(['cena', 'comida', 'desayuno']);
  });

  it('ignora entries sin tipo y sin hora', () => {
    const entries = [
      { meal_type: 'breakfast' },
      { meal_type: 'other' },                 // sin created_at → null
      { name: 'misterio' },                    // sin nada → null
    ];
    expect(resolveMealTypesRegistered(entries)).toEqual(['desayuno']);
  });

  it('ejemplo real — usuario registró desayuno sin tipo explícito', () => {
    // Caso reportado: usuario registra "tostadas con pavo" sin seleccionar
    // meal_type, sistema usa 'other', hora 9am local (7am UTC verano).
    const entries = [
      {
        meal_type: 'other',
        name: '2 tostadas con pavo',
        created_at: '2026-04-14 07:00:00',
      },
      {
        meal_type: 'comida',
        name: 'Lentejas',
      },
    ];
    const result = resolveMealTypesRegistered(entries);
    expect(result.sort()).toEqual(['comida', 'desayuno']);
  });
});
