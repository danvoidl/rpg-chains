import { emit, type DecideContext } from './decide-context.js';
import { combatantDefense, enemyDefense, hitDamage } from './stats.js';

/**
 * Lands one hit of `outgoing` damage on a player or an enemy: defense, then shield, then HP
 * (spec §4.2 resolution order). Emits the damage and, if HP reaches zero, the fall.
 */
export function strike(
  ctx: DecideContext,
  sourceId: string,
  targetId: string,
  outgoing: number,
): void {
  const player = ctx.state.combatants.find((c) => c.profileId === targetId);
  const enemy = ctx.state.enemies.find((e) => e.instanceId === targetId);
  const unit = player ?? enemy;
  if (!unit) return;

  const damage = hitDamage(outgoing, player ? combatantDefense(player) : enemyDefense(enemy!));
  const shield = unit.effects.find((e) => e.kind === 'shield');
  const absorbed = Math.min(damage, shield?.kind === 'shield' ? shield.remaining : 0);
  const hpDamage = Math.min(unit.currentHp, damage - absorbed);
  emit(ctx, { type: 'DamageDealt', sourceId, targetId, hpDamage, absorbed });

  if (unit.currentHp - hpDamage > 0) return;
  if (player) emit(ctx, { type: 'PlayerDowned', profileId: targetId });
  else emit(ctx, { type: 'EnemyDefeated', instanceId: targetId });
}
