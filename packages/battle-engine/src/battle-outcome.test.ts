import { describe, expect, it } from 'vitest';
import type { BattleEvent, BattleState } from '@rpg-chains/shared-types';
import { consumedItems, profileOutcomes } from './battle-outcome.js';
import { basicContent, fencers, startWith } from './fixtures/battle-setup.js';
import { restoreAtCampfire } from './restore.js';

function ended(result: 'victory' | 'defeat'): BattleState {
  const { state } = startWith(basicContent(), fencers(2), 'group');
  return {
    ...state,
    result,
    combatants: state.combatants.map((c, i) =>
      i === 0 ? { ...c, currentHp: 17, currentEnergy: 40 } : { ...c, left: true },
    ),
  };
}

describe('profileOutcomes (plan decision 11)', () => {
  it('keeps HP, energy and downed as the battle ended, for those who left too', () => {
    const state = ended('victory');
    const [first, second] = state.combatants;
    expect(profileOutcomes(state)).toEqual([
      { profileId: first!.profileId, currentHp: 17, currentEnergy: 40, downed: false },
      {
        profileId: second!.profileId,
        currentHp: second!.currentHp,
        currentEnergy: second!.currentEnergy,
        downed: false,
      },
    ]);
  });

  it('downs the whole group on a defeat (spec §3.7)', () => {
    expect(profileOutcomes(ended('defeat')).map((o) => [o.currentHp, o.downed])).toEqual([
      [0, true],
      [0, true],
    ]);
  });

  it('refuses a battle still running', () => {
    const { state } = startWith(basicContent(), fencers(1), 'group');
    expect(() => profileOutcomes(state)).toThrow('not resolved');
  });
});

describe('consumedItems', () => {
  it('lists every unit each participant used, repeats included', () => {
    const log: BattleEvent[] = [
      { type: 'ConsumableUsed', profileId: 'p-1', itemId: 'it-potion' },
      { type: 'ConsumableUsed', profileId: 'p-2', itemId: 'it-ether' },
      { type: 'ConsumableUsed', profileId: 'p-1', itemId: 'it-potion' },
      { type: 'BattleResolved', result: 'victory' },
    ];
    expect(Object.fromEntries(consumedItems(log))).toEqual({
      'p-1': ['it-potion', 'it-potion'],
      'p-2': ['it-ether'],
    });
  });
});

describe('restoreAtCampfire', () => {
  it('revives and refills to the derived maximums', () => {
    const cls = { baseHp: 100, baseEnergy: 50, hpPerLevel: 8, energyPerLevel: 5 };
    expect(restoreAtCampfire(cls, 2, { strength: 1, dexterity: 0, intelligence: 1 })).toEqual({
      currentHp: 112,
      currentEnergy: 58,
      downed: false,
    });
  });
});
