import type {
  CharacterClass,
  Effect,
  InvestedAttributes,
  Rejection,
} from '@rpg-chains/shared-types';
import { deriveStats } from './derive-stats.js';
import { magnitudeAmount } from './effects/magnitude.js';
import type { CombatResources } from './restore.js';

/** A character as an out-of-battle consumable reads it. */
export interface Holder extends CombatResources {
  cls: Pick<CharacterClass, 'baseHp' | 'baseEnergy' | 'hpPerLevel' | 'energyPerLevel'>;
  level: number;
  attributes: InvestedAttributes;
}

/** Effect types that work without combat and without rounds (Fase 4 plan decision 13). */
export const OUT_OF_BATTLE_EFFECTS = ['heal', 'restore_energy', 'revive'] as const;

/** Whether a consumable's effect may be used out of battle. */
export function usableOutOfBattle(effect: Effect): boolean {
  return (OUT_OF_BATTLE_EFFECTS as readonly string[]).includes(effect.type);
}

/**
 * The target's resources after a consumable used out of battle (Fase 4 plan decision 13): `heal`
 * and `restore_energy` on a standing character, up to its ceiling; `revive` on a downed one, back
 * with the effect's share of max HP (at least 1). Scaling magnitudes read the user's invested
 * attributes; percentages are of the target's ceiling, as in battle. A use that would change
 * nothing is refused, so a potion is never wasted.
 */
export function useOutOfBattle(
  effect: Effect,
  user: Holder,
  target: Holder,
): CombatResources | Rejection {
  const { maxHp, maxEnergy } = deriveStats(target.cls, target.level, target.attributes);
  const amount = (magnitude: Parameters<typeof magnitudeAmount>[0], percentOf: number) =>
    Math.floor(magnitudeAmount(magnitude, (name) => user.attributes[name], percentOf));
  const resources = {
    currentHp: target.currentHp,
    currentEnergy: target.currentEnergy,
    downed: target.downed,
  };

  switch (effect.type) {
    case 'heal': {
      if (target.downed) return { ok: false, reason: 'target_downed' };
      const healed = Math.min(amount(effect.magnitude, maxHp), maxHp - target.currentHp);
      if (healed <= 0) return { ok: false, reason: 'nothing_to_restore' };
      return { ...resources, currentHp: target.currentHp + healed };
    }
    case 'restore_energy': {
      if (target.downed) return { ok: false, reason: 'target_downed' };
      const restored = Math.min(
        amount(effect.magnitude, maxEnergy),
        maxEnergy - target.currentEnergy,
      );
      if (restored <= 0) return { ok: false, reason: 'nothing_to_restore' };
      return { ...resources, currentEnergy: target.currentEnergy + restored };
    }
    case 'revive': {
      if (!target.downed) return { ok: false, reason: 'target_not_downed' };
      const hp = Math.max(1, Math.floor((maxHp * Math.min(100, effect.healthPercent)) / 100));
      return { ...resources, currentHp: hp, downed: false };
    }
    default:
      return { ok: false, reason: 'battle_only' };
  }
}
