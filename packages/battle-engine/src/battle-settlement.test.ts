import { describe, expect, it } from 'vitest';
import { settleProfile, type SettledProfile } from './battle-settlement.js';
import { restoreAtCampfire } from './restore.js';

const cls = { baseHp: 120, baseEnergy: 40, hpPerLevel: 12, energyPerLevel: 3 };

const before: SettledProfile = {
  level: 1,
  xp: 90,
  availablePoints: 0,
  attributes: { strength: 0, dexterity: 0, intelligence: 0 },
  currentHp: 120,
  currentEnergy: 40,
  downed: false,
  gold: 50,
  inventory: ['it-potion', 'it-sword', 'it-potion'],
};
const outcome = { profileId: 'p1', currentHp: 70, currentEnergy: 20, downed: false };

describe('settleProfile (Fase 4 plan decisions 3, 5, 10, 12)', () => {
  it('on a victory: resources as the battle ended, consumables out, XP, gold and drops in', () => {
    const settled = settleProfile(cls, before, {
      outcome,
      consumed: ['it-potion'],
      reward: { profileId: 'p1', xp: 30, gold: 12, items: [{ itemId: 'it-fang', name: 'Fang' }] },
      defeat: false,
    });
    // 90 + 30 XP leaves level 1 (100) with 20; the level-up adds 12 HP and 3 energy.
    expect(settled).toEqual({
      ...before,
      level: 2,
      xp: 20,
      availablePoints: 3,
      currentHp: 82,
      currentEnergy: 23,
      gold: 62,
      inventory: ['it-sword', 'it-potion', 'it-fang'],
    });
  });

  it('without a reward (left the battle), keeps only the battle state and the consumption', () => {
    const settled = settleProfile(cls, before, { outcome, consumed: [], defeat: false });
    expect(settled).toEqual({ ...before, currentHp: 70, currentEnergy: 20 });
  });

  it('on a defeat, loses a fifth of the gold and gains nothing, but is back at the campfire restored', () => {
    const downed = { profileId: 'p1', currentHp: 0, currentEnergy: 5, downed: true };
    const settled = settleProfile(
      cls,
      { ...before, gold: 49 },
      { outcome: downed, consumed: ['it-potion'], defeat: true },
    );
    expect(settled).toMatchObject({
      gold: 40,
      level: 1,
      xp: 90,
      downed: false,
      ...restoreAtCampfire(cls, before.level, before.attributes),
      inventory: ['it-sword', 'it-potion'],
    });
  });
});
