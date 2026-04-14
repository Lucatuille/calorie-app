// ============================================================
//  TESTS — chef-week prompt (computeDaysToPlan + parseWeekPlanResponse)
//  Ejecutar: cd worker && npx vitest run src/prompts/__tests__/chef-week.test.js
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  computeDaysToPlan,
  parseWeekPlanResponse,
  buildWeekPlanMessage,
  SYSTEM_PROMPT_WEEK,
} from '../chef-week.js';

// ── computeDaysToPlan ───────────────────────────────────────

describe('computeDaysToPlan', () => {
  // Día de la semana: 0=domingo, 1=lunes, ..., 6=sábado

  it('lunes → 7 días (lun-dom)', () => {
    const monday = new Date('2026-04-13T10:00:00'); // lunes
    const days = computeDaysToPlan(monday);
    expect(days).toHaveLength(7);
    expect(days[0].day_name).toBe('lunes');
    expect(days[6].day_name).toBe('domingo');
  });

  it('martes → 6 días (mar-dom)', () => {
    const tuesday = new Date('2026-04-14T10:00:00');
    const days = computeDaysToPlan(tuesday);
    expect(days).toHaveLength(6);
    expect(days[0].day_name).toBe('martes');
    expect(days[5].day_name).toBe('domingo');
  });

  it('miércoles → 5 días', () => {
    const wed = new Date('2026-04-15T10:00:00');
    const days = computeDaysToPlan(wed);
    expect(days).toHaveLength(5);
    expect(days[0].day_name).toBe('miércoles');
  });

  it('sábado → 2 días (sáb, dom)', () => {
    const sat = new Date('2026-04-18T10:00:00');
    const days = computeDaysToPlan(sat);
    expect(days).toHaveLength(2);
    expect(days[0].day_name).toBe('sábado');
    expect(days[1].day_name).toBe('domingo');
  });

  it('domingo → 1 día', () => {
    const sun = new Date('2026-04-19T10:00:00');
    const days = computeDaysToPlan(sun);
    expect(days).toHaveLength(1);
    expect(days[0].day_name).toBe('domingo');
  });

  it('fechas ISO correctas en orden consecutivo', () => {
    const tuesday = new Date('2026-04-14T10:00:00');
    const days = computeDaysToPlan(tuesday);
    expect(days[0].date).toBe('2026-04-14');
    expect(days[1].date).toBe('2026-04-15');
    expect(days[5].date).toBe('2026-04-19');
  });

  it('sin skipMealTypes → ningún día es parcial', () => {
    const tuesday = new Date('2026-04-14T10:00:00');
    const days = computeDaysToPlan(tuesday);
    for (const d of days) {
      expect(d.isPartial).toBe(false);
      expect(d.skipMealTypes).toEqual([]);
    }
  });

  it('con skipMealTypes marca primer día como parcial', () => {
    const tuesday = new Date('2026-04-14T10:00:00');
    const days = computeDaysToPlan(tuesday, ['desayuno', 'comida']);
    expect(days[0].isPartial).toBe(true);
    expect(days[0].skipMealTypes).toEqual(['desayuno', 'comida']);
    // Los días siguientes NO son parciales
    for (let i = 1; i < days.length; i++) {
      expect(days[i].isPartial).toBe(false);
    }
  });
});

// ── parseWeekPlanResponse ───────────────────────────────────

describe('parseWeekPlanResponse', () => {
  it('parsea JSON puro válido', () => {
    const raw = JSON.stringify({
      days: [
        {
          date: '2026-04-14',
          day_name: 'martes',
          meals: [
            { type: 'desayuno', name: 'Avena', kcal: 400, protein: 20, carbs: 50, fat: 10 },
            { type: 'comida',   name: 'Pechuga', kcal: 500, protein: 40, carbs: 40, fat: 12 },
          ],
        },
      ],
    });
    const result = parseWeekPlanResponse(raw);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].totals.kcal).toBe(900);
    expect(result.days[0].totals.protein).toBe(60);
    expect(result.week_totals.kcal).toBe(900);
  });

  it('strips markdown code block', () => {
    const raw = '```json\n' + JSON.stringify({
      days: [{ date: '2026-04-14', day_name: 'martes', meals: [{ name: 'X', kcal: 100 }] }],
    }) + '\n```';
    const result = parseWeekPlanResponse(raw);
    expect(result.days).toHaveLength(1);
  });

  it('calcula totals por día (no confía en el modelo)', () => {
    const raw = JSON.stringify({
      days: [
        {
          date: '2026-04-14',
          day_name: 'martes',
          meals: [
            { name: 'A', kcal: 100, protein: 10, carbs: 15, fat: 5 },
            { name: 'B', kcal: 200, protein: 20, carbs: 25, fat: 8 },
          ],
          totals: { kcal: 9999 }, // el modelo mintió
        },
      ],
    });
    const result = parseWeekPlanResponse(raw);
    expect(result.days[0].totals.kcal).toBe(300); // recalculado
    expect(result.days[0].totals.protein).toBe(30);
  });

  it('calcula week_totals sumando días', () => {
    const raw = JSON.stringify({
      days: [
        { date: '2026-04-14', day_name: 'martes',    meals: [{ name: 'A', kcal: 100, protein: 10 }] },
        { date: '2026-04-15', day_name: 'miércoles', meals: [{ name: 'B', kcal: 200, protein: 20 }] },
      ],
    });
    const result = parseWeekPlanResponse(raw);
    expect(result.week_totals.kcal).toBe(300);
    expect(result.week_totals.protein).toBe(30);
  });

  it('añade defaults para meals con campos faltantes', () => {
    const raw = JSON.stringify({
      days: [
        { date: '2026-04-14', day_name: 'martes', meals: [{ name: 'X', kcal: 100 }] },
      ],
    });
    const result = parseWeekPlanResponse(raw);
    const meal = result.days[0].meals[0];
    expect(meal.type).toBe('otro');
    expect(meal.protein).toBe(0);
    expect(meal.ingredients).toBe('');
  });

  it('lanza si no hay days', () => {
    expect(() => parseWeekPlanResponse('{}')).toThrow(/vacío/i);
    expect(() => parseWeekPlanResponse('{"days":[]}')).toThrow(/vacío/i);
  });

  it('lanza si un día no tiene date o day_name', () => {
    const raw = JSON.stringify({
      days: [{ meals: [{ name: 'X', kcal: 100 }] }],
    });
    expect(() => parseWeekPlanResponse(raw)).toThrow(/incompleto/i);
  });

  it('lanza si meals no es array', () => {
    const raw = JSON.stringify({
      days: [{ date: '2026-04-14', day_name: 'martes', meals: 'oops' }],
    });
    expect(() => parseWeekPlanResponse(raw)).toThrow(/meals no es array/i);
  });

  it('lanza si un meal no tiene name o kcal', () => {
    const raw = JSON.stringify({
      days: [
        { date: '2026-04-14', day_name: 'martes', meals: [{ name: 'X' }] }, // sin kcal
      ],
    });
    expect(() => parseWeekPlanResponse(raw)).toThrow(/incompleto/i);
  });

  it('lanza en JSON inválido', () => {
    expect(() => parseWeekPlanResponse('{not json')).toThrow();
  });
});

// ── buildWeekPlanMessage (inyección de contexto) ────────────

describe('buildWeekPlanMessage', () => {
  const baseUser = {
    target_calories: 2000, target_protein: 150,
    target_carbs: 200, target_fat: 67, weight: 70, goal_weight: 65,
  };
  const baseDays = [
    { date: '2026-04-14', day_name: 'martes', isPartial: false, skipMealTypes: [] },
  ];

  it('incluye bloque PERFIL con targets', () => {
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: baseDays,
      todayMeals: [], frequentMeals: [], preferences: null,
      context: '', recentEntries: [], recentPlannedDishes: [],
    });
    expect(msg).toContain('=== PERFIL ===');
    expect(msg).toContain('2000 kcal');
    expect(msg).toContain('150');
  });

  it('marca día parcial con tipos ya registrados', () => {
    const days = [
      { date: '2026-04-14', day_name: 'martes', isPartial: true, skipMealTypes: ['desayuno', 'comida'] },
    ];
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: days,
      todayMeals: [], frequentMeals: [], preferences: null,
      context: '', recentEntries: [], recentPlannedDishes: [],
    });
    expect(msg).toContain('PARCIAL');
    expect(msg).toContain('desayuno, comida');
    expect(msg).toContain('SOLO los que faltan');
  });

  it('inyecta preferencias dietéticas como reglas duras', () => {
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: baseDays,
      todayMeals: [], frequentMeals: [],
      preferences: { diet: 'vegan', allergies: ['gluten'], dislikes: 'cilantro' },
      context: '', recentEntries: [], recentPlannedDishes: [],
    });
    expect(msg).toContain('REGLAS DURAS');
    expect(msg).toContain('Vegano');
    expect(msg).toContain('gluten');
    expect(msg).toContain('cilantro');
  });

  it('sin preferencias inyecta "sin restricciones"', () => {
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: baseDays,
      todayMeals: [], frequentMeals: [], preferences: null,
      context: '', recentEntries: [], recentPlannedDishes: [],
    });
    expect(msg).toContain('Sin restricciones');
  });

  it('top 20 de frequent_meals máximo', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      name: `plato-${i}`, times: 10, avg_kcal: 500,
    }));
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: baseDays,
      todayMeals: [], frequentMeals: many, preferences: null,
      context: '', recentEntries: [], recentPlannedDishes: [],
    });
    expect(msg).toContain('plato-0');
    expect(msg).toContain('plato-19');
    expect(msg).not.toContain('plato-20');
  });

  it('incluye contexto libre del usuario', () => {
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: baseDays,
      todayMeals: [], frequentMeals: [], preferences: null,
      context: 'viajo jueves y viernes',
      recentEntries: [], recentPlannedDishes: [],
    });
    expect(msg).toContain('CONTEXTO DEL USUARIO');
    expect(msg).toContain('viajo jueves y viernes');
  });

  it('bloque variedad con platos recientes', () => {
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: baseDays,
      todayMeals: [], frequentMeals: [], preferences: null,
      context: '',
      recentEntries: [
        { date: '2026-04-13', name: 'Pechuga con arroz' },
      ],
      recentPlannedDishes: ['Pollo al curry', 'Salmón al horno'],
    });
    expect(msg).toContain('EVITAR REPETICIÓN');
    expect(msg).toContain('Pechuga con arroz');
    expect(msg).toContain('Pollo al curry');
    expect(msg).toContain('Salmón al horno');
  });

  it('omite bloque variedad si no hay datos recientes', () => {
    const msg = buildWeekPlanMessage({
      user: baseUser, daysToPlan: baseDays,
      todayMeals: [], frequentMeals: [], preferences: null,
      context: '', recentEntries: [], recentPlannedDishes: [],
    });
    expect(msg).not.toContain('EVITAR REPETICIÓN');
  });
});

describe('SYSTEM_PROMPT_WEEK', () => {
  it('contiene reglas críticas', () => {
    expect(SYSTEM_PROMPT_WEEK).toContain('JSON válido');
    expect(SYSTEM_PROMPT_WEEK).toContain('VARIEDAD');
    expect(SYSTEM_PROMPT_WEEK).toContain('PREFERENCIAS DIETÉTICAS');
    expect(SYSTEM_PROMPT_WEEK).toContain('FALTAN');
  });
});
