import type { BattleState } from '@rpg-chains/shared-types';
import type { CombatResources } from './restore.js';

export interface ProfileOutcome extends CombatResources {
  profileId: string;
}

/**
 * What each participant's profile keeps once the battle is resolved (Fase 3 plan decision 11):
 * HP, energy and the downed flag as they ended — for whoever left, as they were when they left.
 * A defeat downs the whole group (spec §3.7).
 */
export function profileOutcomes(state: BattleState): ProfileOutcome[] {
  if (state.result === null) throw new Error('battle not resolved');
  return state.combatants.map((c) =>
    state.result === 'defeat'
      ? { profileId: c.profileId, currentHp: 0, currentEnergy: c.currentEnergy, downed: true }
      : {
          profileId: c.profileId,
          currentHp: c.currentHp,
          currentEnergy: c.currentEnergy,
          downed: c.downed,
        },
  );
}
