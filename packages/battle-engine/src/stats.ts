import { ATTRIBUTE_GAINS, MIN_DAMAGE } from '@rpg-chains/game-config';
import type { Attribute, Combatant, Enemy } from '@rpg-chains/shared-types';
import { finalDamage, rawDamage } from './damage.js';
import { applyModifiers, netModifiers, type NetModifiers } from './stacking.js';

/**
 * Stat reads at use time (spec §4.1, §4.2, §5.5). Modifiers are live: these are recomputed on
 * every read, never stored.
 */

/** `(base + flat) × (1 + pct)` without flooring, for steps inside a longer chain. */
function modify(base: number, net: NetModifiers): number {
  return (base + net.flat) * (1 + net.percent / 100);
}

/** An invested attribute with its buffs/debuffs applied. */
export function effectiveAttribute(combatant: Combatant, attribute: Attribute): number {
  return applyModifiers(
    combatant.attributes[attribute],
    netModifiers(combatant.effects, attribute),
  );
}

/** Basic-attack raw damage before the attacker's damage modifiers (spec §4.2, plan decision 6). */
export function weaponRawDamage(combatant: Combatant): number {
  const { baseDamage, scalingAttribute, scale } = combatant.weapon;
  return rawDamage(baseDamage, effectiveAttribute(combatant, scalingAttribute), scale);
}

/** Raw damage after the attacker's `damage` modifiers — the outgoing side of a hit. */
export function outgoingDamage(raw: number, attacker: Combatant | Enemy): number {
  return Math.max(0, modify(raw, netModifiers(attacker.effects, 'damage')));
}

/** Player defense: equipment + strength × 2 + dexterity × 1, then defense modifiers (spec §4.1). */
export function combatantDefense(combatant: Combatant): number {
  const base =
    combatant.equipmentDefense +
    effectiveAttribute(combatant, 'strength') * ATTRIBUTE_GAINS.strength.defense +
    effectiveAttribute(combatant, 'dexterity') * ATTRIBUTE_GAINS.dexterity.defense;
  return Math.max(0, modify(base, netModifiers(combatant.effects, 'defense')));
}

/** Villain defense with its modifiers (spec §4.2: only defense is read from a villain). */
export function enemyDefense(enemy: Enemy): number {
  return Math.max(0, modify(enemy.defense, netModifiers(enemy.effects, 'defense')));
}

/**
 * Damage a hit deals before shields: reduced by defense, floored once, at least `MIN_DAMAGE` when
 * the outgoing damage is positive (spec §4.2).
 */
export function hitDamage(outgoing: number, defense: number): number {
  if (outgoing <= 0) return 0;
  return Math.max(MIN_DAMAGE, Math.floor(finalDamage(outgoing, defense)));
}
