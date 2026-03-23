import { describe, it, expect } from 'vitest';
import {
  ADHERENCE_TOLERANCE, MEAL_HOURS, MAX_IMAGE_PX,
  JPEG_QUALITY, MAX_TEXT_LENGTH, MAX_SUPPLEMENTS,
} from '../constants';

describe('constants', () => {
  it('ADHERENCE_TOLERANCE is 250', () => { expect(ADHERENCE_TOLERANCE).toBe(250); });
  it('MAX_IMAGE_PX is 900', () => { expect(MAX_IMAGE_PX).toBe(900); });
  it('JPEG_QUALITY is between 0 and 1', () => {
    expect(JPEG_QUALITY).toBeGreaterThan(0);
    expect(JPEG_QUALITY).toBeLessThanOrEqual(1);
  });
  it('MAX_TEXT_LENGTH is 500', () => { expect(MAX_TEXT_LENGTH).toBe(500); });
  it('MAX_SUPPLEMENTS is a positive number', () => {
    expect(MAX_SUPPLEMENTS).toBeGreaterThan(0);
  });
});

describe('MEAL_HOURS', () => {
  it('has breakfast, lunch, snack, dinner', () => {
    expect(Object.keys(MEAL_HOURS).sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snack']);
  });
  it('ranges are [start, end] tuples', () => {
    Object.values(MEAL_HOURS).forEach(([start, end]) => {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(24);
      expect(start).toBeLessThan(end);
    });
  });
  it('covers hours 6-24 without gaps', () => {
    const sorted = Object.values(MEAL_HOURS).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i][0]).toBe(sorted[i - 1][1]); // next start = previous end
    }
    expect(sorted[0][0]).toBe(6);
    expect(sorted[sorted.length - 1][1]).toBe(24);
  });
});
