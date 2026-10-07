import type { Combatant, Magnitude } from '@rpg-chains/shared-types';
import { effectiveAttribute } from '../stats.js';

/**
 * The number a magnitude stands for when the caster uses it (spec §5.3), never below zero.
 * `percentOf` is what a percentage is a percentage OF for this effect type — the caster's basic
 * attack for damage, the target's max HP for heals and shields, and so on (spec §5.5, kit draft).
 */
export function magnitudeValue(magnitude: Magnitude, caster: Combatant, percentOf: number): number {
  switch (magnitude.mode) {
    case 'fixed':
      return Math.max(0, magnitude.value);
    case 'percent':
      return Math.max(0, (percentOf * magnitude.percent) / 100);
    case 'scaling':
      return Math.max(
        0,
        magnitude.base + effectiveAttribute(caster, magnitude.attribute) * magnitude.scale,
      );
  }
}
