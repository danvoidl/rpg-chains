import type { Combatant, Rejection } from '@rpg-chains/shared-types';
import { emit, type DecideContext } from '../decide-context.js';
import { resolveEffect } from '../effects/resolve-effect.js';
import { effectTargets } from '../effects/targets.js';

/** Uses one item of the personal inventory (spec §3.4, §6): same effects as skills, no cost. */
export function useConsumable(
  ctx: DecideContext,
  actor: Combatant,
  itemId: string,
  targetId: string | undefined,
): Rejection | null {
  const stack = actor.consumables.find((c) => c.itemId === itemId);
  if (!stack) return { ok: false, reason: 'no_such_item' };
  const targets = effectTargets(ctx, stack.effect, actor, targetId);
  if ('ok' in targets) return targets;

  emit(ctx, {
    type: 'ActionTaken',
    profileId: actor.profileId,
    action: { type: 'consumable', itemId, ...(targetId ? { targetId } : {}) },
  });
  emit(ctx, { type: 'ConsumableUsed', profileId: actor.profileId, itemId });
  resolveEffect(ctx, actor, stack.effect, targets);
  return null;
}
