import { describe, expect, it } from 'vitest';
import { relevanceMultiplier } from './relevance.js';
import { xpForNextLevel } from './progression.js';

describe('relevanceMultiplier', () => {
  it('caps under-leveled reward at 3.0', () => {
    // 8 levels below → min(3.0, 1 + 0.25*8) = 3.0 (spec §4.5 example)
    expect(relevanceMultiplier(10, 2)).toBe(3.0);
  });

  it('returns 1.0 when on-level', () => {
    expect(relevanceMultiplier(5, 5)).toBe(1.0);
  });

  it('floors over-leveled reward at 0.05', () => {
    // far above → clamped to 0.05, making old-content farm useless (spec §4.5)
    expect(relevanceMultiplier(1, 20)).toBe(0.05);
  });

  it('scales linearly inside the bands', () => {
    expect(relevanceMultiplier(6, 4)).toBeCloseTo(1.5); // +2 → 1 + 0.25*2
    expect(relevanceMultiplier(4, 6)).toBeCloseTo(0.6); // -2 → 1 + 0.20*-2
  });
});

describe('xpForNextLevel', () => {
  it('follows 100 × current level', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(19)).toBe(1900);
  });
});
