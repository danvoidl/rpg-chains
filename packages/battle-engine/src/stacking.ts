import type { ActiveEffect, ModifiableStat } from '@rpg-chains/shared-types';

/**
 * Effect stacking, two policies (CLAUDE.md "Effect stacking", spec §5.5).
 *
 * - Stat modifiers (buff/debuff) coexist: every application is its own entry with its own duration
 *   and is never deduped — three +10% buffs net to +30%. The author bounds accumulation through
 *   magnitude, energy cost, cooldown and duration.
 * - Every other persistent effect replaces the one of the same `kind` on that target and resets
 *   duration: summing control/duration effects across sources would make a battle impossible
 *   (spec §5.6), a ceiling only the system can guarantee.
 */
export function upsertEffect(
  effects: readonly ActiveEffect[],
  incoming: ActiveEffect,
): ActiveEffect[] {
  if (incoming.kind === 'stat_modifier') return [...effects, incoming];
  return [...effects.filter((existing) => existing.kind !== incoming.kind), incoming];
}

/** Signed totals of the modifiers on one stat, per channel; percent in percentage points. */
export interface NetModifiers {
  flat: number;
  percent: number;
}

/** Buffs add, debuffs subtract, separately in the flat and percent channels (spec §5.5). */
export function netModifiers(effects: readonly ActiveEffect[], stat: ModifiableStat): NetModifiers {
  const net: NetModifiers = { flat: 0, percent: 0 };
  for (const effect of effects) {
    if (effect.kind !== 'stat_modifier' || effect.stat !== stat) continue;
    const signed = effect.polarity === 'buff' ? effect.value : -effect.value;
    net[effect.channel] += signed;
  }
  return net;
}

/**
 * Resolves a stat read: `(base + netFlat) × (1 + netPct)`, floored, never below zero. Percent is a
 * live multiplier over base + flat, and several percents add before multiplying (spec §5.3, §5.5).
 */
export function applyModifiers(base: number, net: NetModifiers): number {
  return Math.max(0, Math.floor((base + net.flat) * (1 + net.percent / 100)));
}
