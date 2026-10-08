import type { BattleState, Combatant } from '@rpg-chains/shared-types';

/** Whether a player is in the fight at all: alive and still connected (spec §3.3, §3.7, §7). */
export function isActive(combatant: Combatant): boolean {
  return !combatant.downed && !combatant.left;
}

/**
 * Players who may tap the signal, honoring bell rotation (spec §3.3): whoever acted last round
 * sits out, unless that would leave nobody, in which case every active player may tap.
 */
export function eligibleForSignal(state: Pick<BattleState, 'combatants'>): Set<string> {
  const active = state.combatants.filter(isActive);
  const rested = active.filter((c) => !c.blockedFromSignal);
  const pool = rested.length > 0 ? rested : active;
  return new Set(pool.map((c) => c.profileId));
}
