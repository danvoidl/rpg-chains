import type { Attribute, Combatant, Magnitude } from '@rpg-chains/shared-types';
import { effectiveAttribute } from '../stats.js';

/**
 * The number a magnitude stands for (spec §5.3), never below zero, reading the attributes it
 * scales with through `attribute`. `percentOf` is what a percentage is a percentage OF for this
 * effect type — the caster's basic attack for damage, the target's max HP for heals and shields,
 * and so on (spec §5.5, kit draft).
 */
export function magnitudeAmount(
  magnitude: Magnitude,
  attribute: (name: Attribute) => number,
  percentOf: number,
): number {
  switch (magnitude.mode) {
    case 'fixed':
      return Math.max(0, magnitude.value);
    case 'percent':
      return Math.max(0, (percentOf * magnitude.percent) / 100);
    case 'scaling':
      return Math.max(0, magnitude.base + attribute(magnitude.attribute) * magnitude.scale);
  }
}

/** A magnitude used by a combatant in battle: scaling reads its buffed attributes. */
export function magnitudeValue(magnitude: Magnitude, caster: Combatant, percentOf: number): number {
  return magnitudeAmount(magnitude, (name) => effectiveAttribute(caster, name), percentOf);
}
