import { describe, expect, it } from 'vitest';
import { deriveStats } from './derive-stats.js';

const guardian = { baseHp: 120, baseEnergy: 40, hpPerLevel: 12, energyPerLevel: 3 };
const none = { strength: 0, dexterity: 0, intelligence: 0 };

describe('deriveStats (spec §4.1, §4.3)', () => {
  it('is the class base at level 1 with no points', () => {
    expect(deriveStats(guardian, 1, none)).toEqual({ maxHp: 120, maxEnergy: 40 });
  });

  it('adds the class gain for every level above 1', () => {
    expect(deriveStats(guardian, 5, none)).toEqual({ maxHp: 168, maxEnergy: 52 });
  });

  it('adds attribute gains: +4 hp per strength, +2 per dexterity, +3 energy per intelligence', () => {
    expect(deriveStats(guardian, 1, { strength: 2, dexterity: 3, intelligence: 4 })).toEqual({
      maxHp: 120 + 8 + 6,
      maxEnergy: 40 + 12,
    });
  });
});
