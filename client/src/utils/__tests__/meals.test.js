import { describe, it, expect } from 'vitest';
import { MEAL_TYPES, getMeal } from '../meals';

describe('MEAL_TYPES', () => {
  it('has 5 meal types', () => { expect(MEAL_TYPES).toHaveLength(5); });
  it('includes breakfast, lunch, dinner, snack, other', () => {
    const ids = MEAL_TYPES.map(m => m.id);
    expect(ids).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'other']);
  });
  it('every type has id, label, and icon', () => {
    MEAL_TYPES.forEach(m => {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.icon).toBeTruthy();
    });
  });
});

describe('getMeal', () => {
  it('returns breakfast for "breakfast"', () => {
    expect(getMeal('breakfast')).toEqual({ id: 'breakfast', label: 'Desayuno', icon: '🌅' });
  });
  it('returns lunch for "lunch"', () => {
    expect(getMeal('lunch').label).toBe('Comida');
  });
  it('returns dinner for "dinner"', () => {
    expect(getMeal('dinner').label).toBe('Cena');
  });
  it('returns snack for "snack"', () => {
    expect(getMeal('snack').label).toBe('Snack');
  });
  it('returns "Otro" for "other"', () => {
    expect(getMeal('other').label).toBe('Otro');
  });
  it('falls back to "Otro" for unknown type', () => {
    expect(getMeal('pizza').label).toBe('Otro');
  });
  it('falls back to "Otro" for null', () => {
    expect(getMeal(null).label).toBe('Otro');
  });
  it('falls back to "Otro" for undefined', () => {
    expect(getMeal(undefined).label).toBe('Otro');
  });
});
