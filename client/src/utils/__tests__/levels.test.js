import { describe, it, expect } from 'vitest';
import { isPro, isFree, isWaitlist, getAiLimit, getBadgeStyle, LEVEL_CONFIG, PRO_LEVELS } from '../levels';

// ── isPro ──────────────────────────────────────────────────
describe('isPro', () => {
  it('returns true for Founder (1)', () => { expect(isPro(1)).toBe(true); });
  it('returns true for Pro (2)', () => { expect(isPro(2)).toBe(true); });
  it('returns true for Admin (99)', () => { expect(isPro(99)).toBe(true); });
  it('returns false for Free (3)', () => { expect(isPro(3)).toBe(false); });
  it('returns false for Waitlist (0)', () => { expect(isPro(0)).toBe(false); });
  it('returns false for null', () => { expect(isPro(null)).toBe(false); });
  it('returns false for undefined', () => { expect(isPro(undefined)).toBe(false); });
  it('returns false for unknown level (5)', () => { expect(isPro(5)).toBe(false); });
});

// ── isFree ─────────────────────────────────────────────────
describe('isFree', () => {
  it('returns true for Free (3)', () => { expect(isFree(3)).toBe(true); });
  it('returns false for Pro (2)', () => { expect(isFree(2)).toBe(false); });
  it('returns false for Founder (1)', () => { expect(isFree(1)).toBe(false); });
  it('returns false for Admin (99)', () => { expect(isFree(99)).toBe(false); });
  it('returns false for null', () => { expect(isFree(null)).toBe(false); });
});

// ── isWaitlist ─────────────────────────────────────────────
describe('isWaitlist', () => {
  it('returns true for Waitlist (0)', () => { expect(isWaitlist(0)).toBe(true); });
  it('returns false for Free (3)', () => { expect(isWaitlist(3)).toBe(false); });
  it('returns false for null', () => { expect(isWaitlist(null)).toBe(false); });
});

// ── getAiLimit ─────────────────────────────────────────────
describe('getAiLimit', () => {
  it('returns 0 for Waitlist', () => { expect(getAiLimit(0)).toBe(0); });
  it('returns 15 for Founder (1)', () => { expect(getAiLimit(1)).toBe(15); });
  it('returns 30 for Pro (2)', () => { expect(getAiLimit(2)).toBe(30); });
  it('returns 3 for Free (3)', () => { expect(getAiLimit(3)).toBe(3); });
  it('returns null (unlimited) for Admin (99)', () => { expect(getAiLimit(99)).toBe(null); });
  it('returns 3 for unknown level', () => { expect(getAiLimit(999)).toBe(3); });
  it('returns 3 for undefined', () => { expect(getAiLimit(undefined)).toBe(3); });
});

// ── getBadgeStyle ──────────────────────────────────────────
describe('getBadgeStyle', () => {
  it('returns dark style for Admin (99)', () => {
    expect(getBadgeStyle(99)).toEqual({ background: '#1a1a1a', color: '#ffffff' });
  });
  it('returns green style for Founder (1)', () => {
    expect(getBadgeStyle(1)).toEqual({ background: '#1e3a2f', color: '#a8d5b5' });
  });
  it('returns purple style for Pro (2)', () => {
    expect(getBadgeStyle(2)).toEqual({ background: '#1a1a2e', color: '#c9b8ff' });
  });
  it('returns null for Free (3)', () => { expect(getBadgeStyle(3)).toBe(null); });
  it('returns null for unknown level', () => { expect(getBadgeStyle(999)).toBe(null); });
});

// ── LEVEL_CONFIG structure ─────────────────────────────────
describe('LEVEL_CONFIG', () => {
  it('has all expected levels', () => {
    expect(Object.keys(LEVEL_CONFIG).sort()).toEqual(['0', '1', '2', '3', '99']);
  });
  it('Waitlist cannot access', () => { expect(LEVEL_CONFIG[0].can_access).toBe(false); });
  it('Free can access', () => { expect(LEVEL_CONFIG[3].can_access).toBe(true); });
  it('every level has a name', () => {
    Object.values(LEVEL_CONFIG).forEach(c => expect(c.name).toBeTruthy());
  });
});

// ── PRO_LEVELS ─────────────────────────────────────────────
describe('PRO_LEVELS', () => {
  it('contains 1, 2, 99', () => {
    expect(PRO_LEVELS).toEqual(expect.arrayContaining([1, 2, 99]));
  });
  it('does not contain 0 or 3', () => {
    expect(PRO_LEVELS).not.toContain(0);
    expect(PRO_LEVELS).not.toContain(3);
  });
});
