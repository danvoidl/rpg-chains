import { describe, expect, it } from 'vitest';
import type { Combatant, Effect, PublicBattleState } from '@rpg-chains/shared-types';
import { targetChoices } from './action-targets';

const me = { profileId: 'p1', name: 'Ana', downed: false, left: false } as Combatant;
const view = {
  combatants: [
    me,
    { profileId: 'p2', name: 'Bia', downed: true, left: false },
    { profileId: 'p3', name: 'Caio', downed: false, left: true },
  ],
  enemies: [
    { instanceId: 'enemy-1', name: 'Rato', currentHp: 5 },
    { instanceId: 'enemy-2', name: 'Lobo', currentHp: 0 },
  ],
} as unknown as PublicBattleState;

const fixed = { mode: 'fixed', value: 10 } as const;

describe('targetChoices', () => {
  it('offers living enemies, standing allies, or the downed for a revive', () => {
    const hit: Effect = { type: 'damage', target: 'enemy', magnitude: fixed };
    expect(targetChoices(hit, view, me)).toEqual([{ id: 'enemy-1', name: 'Rato' }]);
    const heal: Effect = { type: 'heal', target: 'ally', magnitude: fixed };
    expect(targetChoices(heal, view, me)).toEqual([{ id: 'p1', name: 'Ana (você)' }]);
    const revive: Effect = { type: 'revive', target: 'ally', healthPercent: 40 };
    expect(targetChoices(revive, view, me)).toEqual([{ id: 'p2', name: 'Bia' }]);
  });

  it('asks nothing for self, area and provoke', () => {
    expect(targetChoices({ type: 'provoke', duration: 1 }, view, me)).toBeNull();
    expect(
      targetChoices({ type: 'heal', target: 'all_allies', magnitude: fixed }, view, me),
    ).toBeNull();
  });
});
