import type { ActiveEffect, ModifiableStat } from '@rpg-chains/shared-types';
import { ATTRIBUTE_EFFECT_TYPES } from '@rpg-chains/shared-types';

/**
 * Effect stacking, two policies (decision 7, spec §5.5).
 *
 * - Attribute modifiers (buff/debuff): coexist and are summed by signed total at read time.
 *   Every application is an independent entry with its own duration — they are NOT deduped;
 *   three +10% buffs net to +30%. The author bounds accumulation via magnitude/energy cost/
 *   cooldown/duration, so no dedup ceiling is imposed here.
 * - Every other persistent effect: deduped by (type) — replace and reset duration (summing
 *   control/duration effects across sources would make a battle impossible, spec §5.6).
 *
 * Fase 3 rework: attribute effects must stop deduping (drop the (type, attribute) slot below),
 * and `netAttributeModifier` must return two channels — flat and percent — resolved by the
 * damage/defense read as `(base + netFlat) × (1 + netPct)`, floored. The current single-value
 * netting is the placeholder until the engine consumes it.
 */

function isAttributeEffect(effect: ActiveEffect): boolean {
  return (ATTRIBUTE_EFFECT_TYPES as readonly string[]).includes(effect.type);
}

function sameSlot(a: ActiveEffect, b: ActiveEffect): boolean {
  if (isAttributeEffect(a) && isAttributeEffect(b)) {
    return a.type === b.type && a.attribute === b.attribute;
  }
  return a.type === b.type;
}

/** Apply an incoming effect, replacing any occupying the same stacking slot. */
export function upsertEffect(
  effects: readonly ActiveEffect[],
  incoming: ActiveEffect,
): ActiveEffect[] {
  return [...effects.filter((existing) => !sameSlot(existing, incoming)), incoming];
}

/** Net signed modifier for one stat: buffs add, debuffs subtract (spec §5.5). */
export function netAttributeModifier(
  effects: readonly ActiveEffect[],
  stat: ModifiableStat,
): number {
  let net = 0;
  for (const effect of effects) {
    if (effect.attribute !== stat) continue;
    if (effect.type === 'buff_attribute') net += effect.value;
    else if (effect.type === 'debuff_attribute') net -= effect.value;
  }
  return net;
}
