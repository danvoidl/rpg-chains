import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '@rpg-chains/game-config';
import { applyXp, gainXp, spendPoints, type Progress } from './progression.js';

// Guardian-like: +12 HP and +3 energy per level; strength gives HP, intelligence energy.
const cls = { baseHp: 120, baseEnergy: 40, hpPerLevel: 12, energyPerLevel: 3 };

const fresh: Progress = {
  level: 1,
  xp: 0,
  availablePoints: 0,
  attributes: { strength: 0, dexterity: 0, intelligence: 0 },
  currentHp: 30,
  currentEnergy: 10,
  downed: false,
};

describe('gainXp (spec §4.4)', () => {
  it('keeps the remainder below the next threshold', () => {
    expect(gainXp(1, 40, 50)).toEqual({ level: 1, xp: 90, pointsGained: 0 });
    expect(gainXp(1, 90, 30)).toEqual({ level: 2, xp: 20, pointsGained: 3 });
  });

  it('climbs several levels at once (spec §4.5)', () => {
    // 100 + 200 + 300 = 600 leaves level 3 with 50 to spare.
    expect(gainXp(1, 0, 650)).toEqual({ level: 4, xp: 50, pointsGained: 9 });
  });

  it('stops at the max level, where XP no longer accumulates', () => {
    expect(gainXp(MAX_LEVEL - 1, 0, 1_000_000)).toEqual({
      level: MAX_LEVEL,
      xp: 0,
      pointsGained: 3,
    });
    expect(gainXp(MAX_LEVEL, 0, 500)).toEqual({ level: MAX_LEVEL, xp: 0, pointsGained: 0 });
  });
});

describe('applyXp (plan decision 6)', () => {
  it('raises current HP and energy by what the ceilings rose, without a full heal', () => {
    expect(applyXp(cls, fresh, 120)).toMatchObject({
      level: 2,
      xp: 20,
      availablePoints: 3,
      currentHp: 42,
      currentEnergy: 13,
    });
  });

  it('leaves a downed character at 0 HP', () => {
    const downed = { ...fresh, currentHp: 0, downed: true };
    expect(applyXp(cls, downed, 100)).toMatchObject({ level: 2, currentHp: 0, downed: true });
  });
});

describe('spendPoints (plan decision 7)', () => {
  const ready = { ...fresh, availablePoints: 3 };

  it('invests points and raises the resources the attributes feed', () => {
    const spent = spendPoints(cls, ready, { strength: 2, dexterity: 0, intelligence: 1 });
    // Strength: +4 HP per point; intelligence: +3 energy per point (spec §4.1).
    expect(spent).toMatchObject({
      availablePoints: 0,
      attributes: { strength: 2, dexterity: 0, intelligence: 1 },
      currentHp: 38,
      currentEnergy: 13,
    });
  });

  it('refuses more points than available, fractions, negatives and an empty spend', () => {
    const refuse = (spend: { strength: number; dexterity: number; intelligence: number }) =>
      spendPoints(cls, ready, spend);
    expect(refuse({ strength: 4, dexterity: 0, intelligence: 0 })).toEqual({
      ok: false,
      reason: 'not_enough_points',
    });
    for (const bad of [
      { strength: 0.5, dexterity: 0, intelligence: 0 },
      { strength: -1, dexterity: 2, intelligence: 0 },
      { strength: 0, dexterity: 0, intelligence: 0 },
    ]) {
      expect(refuse(bad)).toEqual({ ok: false, reason: 'invalid_points' });
    }
  });
});
