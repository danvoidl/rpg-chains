import { describe, expect, it } from 'vitest';
import { damageReduction, finalDamage, rawDamage } from './damage.js';

describe('damage formula (spec §4.2)', () => {
  it('matches the reference reduction points', () => {
    expect(damageReduction(60)).toBeCloseTo(0.333, 2);
    expect(damageReduction(120)).toBe(0.5);
    expect(damageReduction(240)).toBeCloseTo(0.667, 2);
  });

  it('never reaches 100% reduction', () => {
    expect(damageReduction(100000)).toBeLessThan(1);
  });

  it('applies defense to raw damage', () => {
    expect(finalDamage(100, 120)).toBe(50);
  });

  it('scales raw damage with the weapon attribute', () => {
    expect(rawDamage(10, 20, 1.5)).toBe(40);
  });
});
