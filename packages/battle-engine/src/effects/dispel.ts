import type { ActiveEffect } from '@rpg-chains/shared-types';

/** Effects that help their bearer; the rest harm it (spec §5.4 "Dissipar"). */
export function isBeneficial(effect: ActiveEffect): boolean {
  switch (effect.kind) {
    case 'stat_modifier':
      return effect.polarity === 'buff';
    case 'heal_over_time':
    case 'shield':
    case 'provoke':
      return true;
    case 'damage_over_time':
    case 'stun':
    case 'max_hp_reduction':
      return false;
  }
}

/** The `amount` most recent buffs (or debuffs) of a unit — what a dispel removes. */
export function dispelled(
  effects: readonly ActiveEffect[],
  removes: 'buffs' | 'debuffs',
  amount: number,
): ActiveEffect[] {
  const wanted = effects.filter((e) => isBeneficial(e) === (removes === 'buffs'));
  return wanted.slice(-amount);
}
