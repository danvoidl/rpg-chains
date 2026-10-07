import type { Combatant } from '@rpg-chains/shared-types';

/** Whether a skill is off cooldown in `round` (cooldowns hold the round it is back, spec §5.5). */
export function skillReady(combatant: Combatant, skillId: string, round: number): boolean {
  const readyRound = combatant.cooldowns[skillId];
  return readyRound === undefined || round >= readyRound;
}
