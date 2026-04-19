// ============================================================
//  TESTS — mealTypeInfer
//  Ejecutar: cd worker && npx vitest run src/utils/__tests__/mealTypeInfer.test.js
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  resolveMealType,
  resolveMealTypesRegistered,
  resolveMealItems,
  normalizeDishName,
} from '../mealTypeInfer.js';

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

  it('UTC 11:00 → 13:00 Madrid → comida (ventana 13+)', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 11:00:00',
    })).toBe('comida');
  });

  it('UTC 10:30 → 12:30 Madrid → desayuno (desayuno tardío ES)', () => {
    expect(resolveMealType({
      meal_type: 'other',
      created_at: '2026-04-14 10:30:00',
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
      created_at: '2026-04-14 12:00:00',  // 14:00 Madrid → comida
    })).toBe('comida');
  });

  it('meal_type null infiere', () => {
    expect(resolveMealType({
      meal_type: null,
      created_at: '2026-04-14 12:00:00',  // 14:00 Madrid → comida
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

describe('resolveMealType — hora MANDA sobre meal_type explícito', () => {
  // Decisión 2026-04-14: el explícito suele ser default del form.
  // La hora factual (created_at) manda cuando ambos existen.

  it('meal_type=lunch a las 11:56 Madrid → desayuno (no comida)', () => {
    // Caso reportado: "2 Tostadas con pavo" creada a las 09:56 UTC
    // (= 11:56 Madrid verano) con meal_type='lunch' por default del form.
    // DEBE detectarse como desayuno para filtrar bien el slot.
    expect(resolveMealType({
      meal_type: 'lunch',
      created_at: '2026-04-14 09:56:03',
    })).toBe('desayuno');
  });

  it('meal_type=breakfast a las 14h Madrid → comida (la hora manda)', () => {
    expect(resolveMealType({
      meal_type: 'breakfast',
      created_at: '2026-04-14 12:00:00',
    })).toBe('comida');
  });

  it('meal_type=dinner a las 10h Madrid → desayuno', () => {
    expect(resolveMealType({
      meal_type: 'dinner',
      created_at: '2026-04-14 08:00:00',
    })).toBe('desayuno');
  });

  it('meal_type explícito solo se usa si NO hay created_at válido', () => {
    expect(resolveMealType({ meal_type: 'breakfast' })).toBe('desayuno');
    expect(resolveMealType({ meal_type: 'breakfast', created_at: 'invalid' })).toBe('desayuno');
    expect(resolveMealType({ meal_type: 'lunch',     created_at: null })).toBe('comida');
  });

  it('ventana desayuno <13h (patrón español, cubre desayuno tardío)', () => {
    // UTC 10:59 = 12:59 Madrid → desayuno (<13h)
    expect(resolveMealType({ meal_type: 'other', created_at: '2026-04-14 10:59:00' })).toBe('desayuno');
    // UTC 11:00 = 13:00 Madrid → comida (>=13h)
    expect(resolveMealType({ meal_type: 'other', created_at: '2026-04-14 11:00:00' })).toBe('comida');
  });

  it('desayuno tardío 12:30 Madrid se clasifica como desayuno', () => {
    // Caso real: usuario registra desayuno a las 12:30 → form default = 'lunch'
    // → created_at = 10:30 UTC (verano) = 12:30 Madrid → DEBE ser 'desayuno'
    // para que Chef no regenere otro desayuno.
    expect(resolveMealType({
      meal_type: 'lunch',  // default del form a esa hora
      created_at: '2026-04-14 10:30:00',
    })).toBe('desayuno');
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
    // Usuario registra "tostadas con pavo" sin seleccionar meal_type,
    // sistema usa 'other', hora 9am local (7am UTC verano).
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

  it('ejemplo real (bug 2026-04-14) — desayuno con meal_type=lunch por default', () => {
    // Caso encontrado en D1: ambas entries tienen meal_type='lunch'.
    // La primera es desayuno (tostadas a las 11:56 Madrid), la segunda
    // es comida real (arroz a las 14:46). Antes se deduplicaba a solo
    // 'comida' y Sonnet rellenaba desayuno. Ahora la hora manda:
    // 11:56 → desayuno, 14:46 → comida.
    const entries = [
      { meal_type: 'lunch', name: '2 Tostadas con pavo',           created_at: '2026-04-14 09:56:03' },
      { meal_type: 'lunch', name: 'Arroz salteado con zanahoria…', created_at: '2026-04-14 12:46:39' },
    ];
    const result = resolveMealTypesRegistered(entries);
    expect(result.sort()).toEqual(['comida', 'desayuno']);
  });
});

describe('normalizeDishName', () => {
  it('lowercase + trim', () => {
    expect(normalizeDishName('  Pollo al Curry  ')).toBe('pollo al curry');
  });

  it('quita tildes', () => {
    expect(normalizeDishName('Plátano con Açúcar')).toBe('platano con acucar');
  });

  it('colapsa espacios múltiples', () => {
    expect(normalizeDishName('Arroz   con    pollo')).toBe('arroz con pollo');
  });

  it('valores vacíos → cadena vacía', () => {
    expect(normalizeDishName(null)).toBe('');
    expect(normalizeDishName(undefined)).toBe('');
    expect(normalizeDishName('')).toBe('');
    expect(normalizeDishName('   ')).toBe('');
  });
});

describe('resolveMealItems', () => {
  it('devuelve array vacío para entradas vacías', () => {
    expect(resolveMealItems([])).toEqual([]);
    expect(resolveMealItems(null)).toEqual([]);
    expect(resolveMealItems(undefined)).toEqual([]);
  });

  it('incluye type + name + normalized_name', () => {
    const entries = [
      { meal_type: 'breakfast', name: '2 Tostadas con Pavo' },
    ];
    expect(resolveMealItems(entries)).toEqual([
      { type: 'desayuno', name: '2 Tostadas con Pavo', normalized_name: '2 tostadas con pavo' },
    ]);
  });

  it('NO deduplica — dos entries mismo tipo distinto nombre = 2 items', () => {
    // Importante: si user comió 2 snacks, ambos aparecen. El frontend
    // compara por (type + normalized_name) para marcar solo si coincide.
    const entries = [
      { meal_type: 'snack', name: 'Manzana', created_at: '2026-04-14 15:00:00' },
      { meal_type: 'snack', name: 'Almendras', created_at: '2026-04-14 16:00:00' },
    ];
    const result = resolveMealItems(entries);
    expect(result).toHaveLength(2);
    expect(result[0].normalized_name).toBe('manzana');
    expect(result[1].normalized_name).toBe('almendras');
  });

  it('ignora entries sin nombre', () => {
    const entries = [
      { meal_type: 'breakfast', name: 'Tostadas' },
      { meal_type: 'lunch' },              // sin name
      { meal_type: 'dinner', name: '' },   // name vacío
      { meal_type: 'snack', name: '   ' }, // solo espacios
    ];
    const result = resolveMealItems(entries);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tostadas');
  });

  it('ignora entries cuyo tipo no se puede resolver', () => {
    const entries = [
      { meal_type: 'other', name: 'Sin hora' },      // sin created_at → null
      { meal_type: 'breakfast', name: 'Desayuno OK' },
    ];
    const result = resolveMealItems(entries);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Desayuno OK');
  });

  it('caso real — hamburguesa a las 17h inferida como merienda', () => {
    // Bug reportado 2026-04-19: user come "comida tardía como snack" a las
    // 17h. resolveMealType infiere 'merienda' por la hora. El frontend NO
    // debe marcar el Yogur griego del plan como registrado porque el
    // nombre es distinto (hamburguesa ≠ yogur griego con nueces).
    const entries = [
      {
        meal_type: 'snack',
        name: 'Hamburguesa doble',
        created_at: '2026-04-19 15:00:00',  // 17h Madrid verano → merienda
      },
    ];
    const result = resolveMealItems(entries);
    expect(result).toEqual([
      {
        type: 'merienda',
        name: 'Hamburguesa doble',
        normalized_name: 'hamburguesa doble',
      },
    ]);
  });
});
