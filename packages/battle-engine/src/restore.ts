import type { CharacterClass, InvestedAttributes } from '@rpg-chains/shared-types';
import { deriveStats } from './derive-stats.js';

/** The combat state a profile keeps between battles (spec §3.7). */
export interface CombatResources {
  currentHp: number;
  currentEnergy: number;
  downed: boolean;
}

/**
 * A campfire (spec §3.7): revives the downed and refills HP and energy. Shared by the master's
 * provisional rest (Fase 3 plan decision 11) and the Fase 5 campfire node.
 */
export function restoreAtCampfire(
  cls: Pick<CharacterClass, 'baseHp' | 'baseEnergy' | 'hpPerLevel' | 'energyPerLevel'>,
  level: number,
  attributes: InvestedAttributes,
): CombatResources {
  const { maxHp, maxEnergy } = deriveStats(cls, level, attributes);
  return { currentHp: maxHp, currentEnergy: maxEnergy, downed: false };
}
