import type { Effect, EffectType, Target } from './effects.js';

const ENEMIES = ['enemy', 'all_enemies'] as const satisfies readonly Target[];
const ALLIES = ['self', 'ally', 'all_allies'] as const satisfies readonly Target[];

/**
 * Targets that make sense for each effect type (game rule shared by the editor's target select,
 * the publish gate and the battle engine). Provoke has no target: it always redirects onto the caster (spec §3.6).
 */
export const ALLOWED_TARGETS: Record<Exclude<EffectType, 'provoke'>, readonly Target[]> = {
  damage: ENEMIES,
  damage_over_time: ENEMIES,
  debuff_attribute: ENEMIES,
  max_hp_reduction: ENEMIES,
  stun: ENEMIES,
  heal: ALLIES,
  heal_over_time: ALLIES,
  restore_energy: ALLIES,
  shield: ALLIES,
  buff_attribute: ALLIES,
  revive: ['ally', 'all_allies'],
  dispel: [...ENEMIES, ...ALLIES],
};

/** Whether an effect hits everyone on a side (area bands apply instead of single-target ones). */
export function isAreaEffect(effect: Effect): boolean {
  return 'target' in effect && (effect.target === 'all_allies' || effect.target === 'all_enemies');
}
