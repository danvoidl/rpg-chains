import type { BattleState, Combatant } from '@rpg-chains/shared-types';

/**
 * Whether a player is in the fight at all: alive and not out of it (spec §3.3, §3.7, §7). A
 * player inside the reconnection grace is still active — still a target, still counted.
 */
export function isActive(combatant: Combatant): boolean {
  return !combatant.downed && !combatant.left;
}

/** Whether a player could act right now: active and connected (spec §3.3). */
export function canAct(combatant: Combatant): boolean {
  return isActive(combatant) && combatant.connected;
}

/**
 * Players who may tap the signal, honoring bell rotation (spec §3.3): whoever acted last round
 * sits out, unless that would leave nobody, in which case every player who can act may tap.
 */
export function eligibleForSignal(state: Pick<BattleState, 'combatants'>): Set<string> {
  const active = state.combatants.filter(canAct);
  const rested = active.filter((c) => !c.blockedFromSignal);
  const pool = rested.length > 0 ? rested : active;
  return new Set(pool.map((c) => c.profileId));
}
