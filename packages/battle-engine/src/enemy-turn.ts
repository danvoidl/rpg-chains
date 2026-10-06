import type { Enemy, Villain, VillainAttack } from '@rpg-chains/shared-types';
import { draw, emit, nextToken, type DecideContext } from './decide-context.js';
import { pick } from './prng.js';
import { isActive } from './signal.js';
import { outgoingDamage } from './stats.js';
import { strike } from './strike.js';

/**
 * Attack a villain uses this turn (spec §3.5): a random one among those off cooldown; if every
 * attack is waiting, the one closest to ready (first in the list on a tie).
 */
function chooseAttack(ctx: DecideContext, enemy: Enemy, villain: Villain): VillainAttack {
  const ready = villain.attacks.filter((a) => !enemy.attackCooldowns[a.id]);
  if (ready.length === 1) return ready[0]!;
  if (ready.length > 1) return draw(ctx, (prng) => pick(prng, ready));
  return villain.attacks.reduce((best, a) =>
    enemy.attackCooldowns[a.id]! < enemy.attackCooldowns[best.id]! ? a : best,
  );
}

function findVillain(ctx: DecideContext, villainId: string): Villain {
  const villain = ctx.content.villains.find((v) => v.id === villainId);
  if (!villain) throw new Error(`villain ${villainId} is not in the battle content`);
  return villain;
}

/**
 * The enemy at the head of the queue takes its turn (spec §3.1, §3.5, §3.6). A stunned enemy loses
 * it. A provoker draws the attack — an area attack becomes a single hit on them; otherwise a
 * single attack picks a random active player and an area attack hits all of them.
 */
export function runEnemyTurn(ctx: DecideContext): void {
  const instanceId = ctx.state.enemyQueue[0];
  const enemy = ctx.state.enemies.find((e) => e.instanceId === instanceId);
  if (!instanceId || !enemy) return;
  emit(ctx, {
    type: 'TurnAdvanced',
    turnToken: nextToken(ctx),
    to: { side: 'enemy', instanceId },
  });

  if (enemy.effects.some((e) => e.kind === 'stun')) {
    emit(ctx, { type: 'EnemyTurnSkipped', instanceId, reason: 'stunned' });
    return;
  }

  const attack = chooseAttack(ctx, enemy, findVillain(ctx, enemy.villainId));
  const active = ctx.state.combatants.filter(isActive);
  if (active.length === 0) return;
  // With several provokers, the first in roster order draws the attack.
  const provoker = active.find((c) => c.effects.some((e) => e.kind === 'provoke'));
  const targetIds = provoker
    ? [provoker.profileId]
    : attack.targetType === 'area'
      ? active.map((c) => c.profileId)
      : [
          active.length === 1
            ? active[0]!.profileId
            : draw(ctx, (prng) => pick(prng, active)).profileId,
        ];

  emit(ctx, {
    type: 'EnemyActed',
    instanceId,
    attackId: attack.id,
    targetIds,
    redirectedBy: provoker?.profileId ?? null,
    cooldown: attack.cooldownRounds,
  });
  if (provoker) emit(ctx, { type: 'ProvokeConsumed', profileId: provoker.profileId });

  const outgoing = outgoingDamage(attack.baseDamage, enemy);
  for (const targetId of targetIds) strike(ctx, instanceId, targetId, outgoing);
}
