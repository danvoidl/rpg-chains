import { describe, expect, it } from 'vitest';
import {
  TRAIL_COLUMNS,
  TRAIL_WIDTH,
  cellPosition,
  isOnTrailGrid,
  nearestCell,
  snapToTrail,
} from './trail.js';

describe('trail grid (Fase 5 plan decision 17)', () => {
  it('splits the fixed width into five columns', () => {
    expect(TRAIL_COLUMNS).toBe(5);
    expect(cellPosition({ column: TRAIL_COLUMNS - 1, row: 0 }).x).toBeLessThan(TRAIL_WIDTH);
  });

  it('snaps to the nearest cell, clamped into the trail', () => {
    expect(snapToTrail({ x: 100, y: 140 })).toEqual({ x: 80, y: 100 });
    expect(nearestCell({ x: 2000, y: -50 })).toEqual({ column: 4, row: 0 });
    expect(nearestCell({ x: -30, y: 1260 })).toEqual({ column: 0, row: 13 });
  });

  it('tells grid positions apart', () => {
    expect(isOnTrailGrid({ x: 320, y: 700 })).toBe(true);
    expect(isOnTrailGrid({ x: 100, y: 0 })).toBe(false);
    expect(isOnTrailGrid({ x: 400, y: 0 })).toBe(false); // past the last column
  });
});
