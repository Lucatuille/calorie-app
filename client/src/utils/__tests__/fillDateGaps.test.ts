// ============================================================
//  TESTS — fillDateGaps
//  Ejecutar: cd client && npx vitest run src/utils/__tests__/fillDateGaps.test.ts
// ============================================================

import { describe, it, expect } from 'vitest';
import { fillDateGaps, shiftISODate } from '../fillDateGaps';

describe('shiftISODate', () => {
  it('resta días correctamente', () => {
    expect(shiftISODate('2026-04-15', -1)).toBe('2026-04-14');
    expect(shiftISODate('2026-04-15', -7)).toBe('2026-04-08');
  });

  it('maneja cruces de mes', () => {
    expect(shiftISODate('2026-05-01', -1)).toBe('2026-04-30');
    expect(shiftISODate('2026-03-01', -1)).toBe('2026-02-28'); // 2026 no bisiesto
  });

  it('maneja cruces de año', () => {
    expect(shiftISODate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('suma días también', () => {
    expect(shiftISODate('2026-04-15', 1)).toBe('2026-04-16');
  });
});

describe('fillDateGaps', () => {
  type Entry = { id: number; calories: number };

  it('grupos vacíos → devuelve vacío', () => {
    expect(fillDateGaps([])).toEqual([]);
  });

  it('solo 1 día con entry (hoy) → no rellena nada', () => {
    const groups: [string, Entry[]][] = [
      ['2026-04-15', [{ id: 1, calories: 500 }]],
    ];
    const result = fillDateGaps(groups, 60, '2026-04-15');
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('2026-04-15');
  });

  it('hoy sin entries + ayer con entries → rellena hoy como vacío', () => {
    const groups: [string, Entry[]][] = [
      ['2026-04-14', [{ id: 1, calories: 500 }]],
    ];
    const result = fillDateGaps(groups, 60, '2026-04-15');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(['2026-04-15', []]);      // hoy vacío
    expect(result[1][0]).toBe('2026-04-14');
    expect(result[1][1]).toHaveLength(1);               // ayer lleno
  });

  it('huecos entre entries lejanas se rellenan', () => {
    // Hoy es 15 abril. Entry hace 3 días (12 abr) y 6 días (9 abr).
    const groups: [string, Entry[]][] = [
      ['2026-04-12', [{ id: 1, calories: 500 }]],
      ['2026-04-09', [{ id: 2, calories: 600 }]],
    ];
    const result = fillDateGaps(groups, 60, '2026-04-15');
    // 15, 14, 13, 12, 11, 10, 09 = 7 días
    expect(result).toHaveLength(7);
    const dates = result.map(r => r[0]);
    expect(dates).toEqual([
      '2026-04-15', '2026-04-14', '2026-04-13',
      '2026-04-12', '2026-04-11', '2026-04-10',
      '2026-04-09',
    ]);
    // 12 y 09 con entries; resto vacíos
    expect(result[0][1]).toEqual([]);             // 15
    expect(result[3][1]).toHaveLength(1);         // 12
    expect(result[6][1]).toHaveLength(1);         // 09
    expect(result[1][1]).toEqual([]);             // 14 vacío
  });

  it('respeta el orden DESC', () => {
    const groups: [string, Entry[]][] = [
      ['2026-04-14', [{ id: 1, calories: 500 }]],
      ['2026-04-12', [{ id: 2, calories: 300 }]],
    ];
    const result = fillDateGaps(groups, 60, '2026-04-15');
    const dates = result.map(r => r[0]);
    // Debe estar ordenado DESC
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] < dates[i - 1]).toBe(true);
    }
  });

  it('cap: entry más antiguo >maxFillDays atrás → solo rellena hasta el floor', () => {
    // Hoy 15 abril. Entry hace 90 días y entry hace 2 días.
    // maxFillDays=7 → rellenamos solo entre hoy y hoy-6. El entry viejo se muestra sin huecos extra.
    const groups: [string, Entry[]][] = [
      ['2026-04-13', [{ id: 1, calories: 500 }]],        // dentro del rango
      ['2026-01-15', [{ id: 2, calories: 400 }]],        // muy antiguo
    ];
    const result = fillDateGaps(groups, 7, '2026-04-15');
    // Rango rellenado: 15 -> 09 (7 días): 7 filas
    // + 1 entry antigua = 8 filas total
    expect(result).toHaveLength(8);
    // Los primeros 7 son del rango rellenado
    expect(result[0][0]).toBe('2026-04-15');
    expect(result[6][0]).toBe('2026-04-09');
    // El último es la entry antigua, sin huecos antes
    expect(result[7][0]).toBe('2026-01-15');
  });

  it('no inventa días futuros', () => {
    const groups: [string, Entry[]][] = [
      ['2026-04-15', [{ id: 1, calories: 500 }]],
    ];
    const result = fillDateGaps(groups, 60, '2026-04-15');
    expect(result.every(([d]) => d <= '2026-04-15')).toBe(true);
  });

  it('caso común: usuario que registra todos los días (últimos 7)', () => {
    const groups: [string, Entry[]][] = [];
    for (let i = 0; i < 7; i++) {
      groups.push([shiftISODate('2026-04-15', -i), [{ id: i, calories: 500 }]]);
    }
    const result = fillDateGaps(groups, 60, '2026-04-15');
    // Todos los días ya están, no se añade nada
    expect(result).toHaveLength(7);
    expect(result.every(r => r[1].length > 0)).toBe(true);
  });

  it('caso real: usuario registra hoy pero no ayer ni antesdeayer', () => {
    const groups: [string, Entry[]][] = [
      ['2026-04-15', [{ id: 1, calories: 2000 }]],
      ['2026-04-12', [{ id: 2, calories: 1800 }]],
    ];
    const result = fillDateGaps(groups, 60, '2026-04-15');
    // 15, 14, 13, 12 = 4 filas
    expect(result).toHaveLength(4);
    expect(result[0][1]).toHaveLength(1);  // hoy con entries
    expect(result[1][1]).toEqual([]);      // ayer vacío
    expect(result[2][1]).toEqual([]);      // antes vacío
    expect(result[3][1]).toHaveLength(1);  // 12 abr
  });
});
