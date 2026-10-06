import { ALLOWED_TARGETS } from '@rpg-chains/campaign-rules';
import type { Effect, EffectType, Magnitude, MagnitudeMode } from '@rpg-chains/shared-types';

/** Starting magnitude when the author picks a mode. */
export function defaultMagnitude(mode: MagnitudeMode): Magnitude {
  switch (mode) {
    case 'fixed':
      return { mode, value: 10 };
    case 'percent':
      return { mode, percent: 10 };
    case 'scaling':
      return { mode, base: 10, attribute: 'strength', scale: 1 };
  }
}

/** Starting parameters when the author picks an effect type; the first allowed target is chosen. */
export function defaultEffect(type: EffectType): Effect {
  const magnitude = defaultMagnitude('fixed');
  switch (type) {
    case 'provoke':
      return { type, duration: 1 };
    case 'damage':
    case 'heal':
    case 'restore_energy':
      return { type, target: ALLOWED_TARGETS[type][0]!, magnitude };
    case 'damage_over_time':
    case 'heal_over_time':
      return { type, target: ALLOWED_TARGETS[type][0]!, magnitudePerRound: magnitude, duration: 3 };
    case 'shield':
      return { type, target: ALLOWED_TARGETS[type][0]!, magnitude, duration: 2 };
    case 'max_hp_reduction':
      return { type, target: 'enemy', magnitude: defaultMagnitude('percent'), duration: 2 };
    case 'buff_attribute':
    case 'debuff_attribute':
      return {
        type,
        target: ALLOWED_TARGETS[type][0]!,
        attribute: 'damage',
        magnitude: defaultMagnitude('percent'),
        duration: 2,
      };
    case 'revive':
      return { type, target: 'ally', healthPercent: 30 };
    case 'stun':
      return { type, target: 'enemy', duration: 1 };
    case 'dispel':
      return { type, target: 'ally', amount: 1, removes: 'debuffs' };
  }
}
