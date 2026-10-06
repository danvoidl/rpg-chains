import { ENERGY_PER_BASIC_ATTACK } from '@rpg-chains/game-config';
import type { Combatant, Rejection } from '@rpg-chains/shared-types';
import { emit, type DecideContext } from '../decide-context.js';
import { outgoingDamage, weaponRawDamage } from '../stats.js';
import { strike } from '../strike.js';

/**
 * Basic attack with the equipped weapon (spec §3.4, §4.2): one hit on a living enemy, and energy
 * back to the attacker (spec §4.3). Returns a rejection without emitting anything if the target is
 * not valid.
 */
export function attack(
  ctx: DecideContext,
  actor: Combatant,
  targetInstanceId: string,
): Rejection | null {
  const target = ctx.state.enemies.find((e) => e.instanceId === targetInstanceId);
  if (!target || target.currentHp <= 0) return { ok: false, reason: 'invalid_target' };

  emit(ctx, {
    type: 'ActionTaken',
    profileId: actor.profileId,
    action: { type: 'attack', targetInstanceId },
  });
  const energy = Math.min(ENERGY_PER_BASIC_ATTACK, actor.maxEnergy - actor.currentEnergy);
  if (energy > 0) emit(ctx, { type: 'EnergyChanged', targetId: actor.profileId, delta: energy });
  strike(ctx, actor.profileId, targetInstanceId, outgoingDamage(weaponRawDamage(actor), actor));
  return null;
}
