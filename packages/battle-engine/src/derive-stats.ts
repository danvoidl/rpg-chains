import { ATTRIBUTE_GAINS } from '@rpg-chains/game-config';
import type { CharacterClass, InvestedAttributes } from '@rpg-chains/shared-types';

/** Derived resource ceilings of a character (spec §4.1, §4.3). */
export interface DerivedStats {
  maxHp: number;
  maxEnergy: number;
}

/**
 * Max HP and energy of a character: class base, plus the class gain for every level above 1, plus
 * the per-point attribute gains. Single source for the server (fresh profiles) and the engine.
 */
export function deriveStats(
  cls: Pick<CharacterClass, 'baseHp' | 'baseEnergy' | 'hpPerLevel' | 'energyPerLevel'>,
  level: number,
  attributes: InvestedAttributes,
): DerivedStats {
  const levelsGained = level - 1;
  return {
    maxHp:
      cls.baseHp +
      cls.hpPerLevel * levelsGained +
      attributes.strength * ATTRIBUTE_GAINS.strength.health +
      attributes.dexterity * ATTRIBUTE_GAINS.dexterity.health,
    maxEnergy:
      cls.baseEnergy +
      cls.energyPerLevel * levelsGained +
      attributes.intelligence * ATTRIBUTE_GAINS.intelligence.energy,
  };
}

/**
 * Defense out of battle (spec §4.1): equipment defense + strength × 2 + dexterity × 1, before any
 * buff. In battle, `combatantDefense` adds the modifiers on top of the effective attributes.
 */
export function baseDefense(equipmentDefense: number, attributes: InvestedAttributes): number {
  return (
    equipmentDefense +
    attributes.strength * ATTRIBUTE_GAINS.strength.defense +
    attributes.dexterity * ATTRIBUTE_GAINS.dexterity.defense
  );
}
