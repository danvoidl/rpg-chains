import { emit, type DecideContext } from '../decide-context.js';
import { effectiveMaxHp } from '../evolve-units.js';
import { isActive } from '../signal.js';

/**
 * End of a group round, before durations count down (spec §5.5): every damage/heal-over-time
 * effect ticks once — except those applied this very round, whose N ticks start next round. A tick
 * that empties HP downs the player or defeats the enemy.
 */
export function tickOverTime(ctx: DecideContext): void {
  const { round } = ctx.state;
  const units = [
    ...ctx.state.combatants.filter(isActive).map((c) => c.profileId),
    ...ctx.state.enemies.filter((e) => e.currentHp > 0).map((e) => e.instanceId),
  ];
  for (const id of units) {
    const read = () =>
      ctx.state.combatants.find((c) => c.profileId === id) ??
      ctx.state.enemies.find((e) => e.instanceId === id)!;
    for (const effect of read().effects) {
      const unit = read();
      if (unit.currentHp <= 0 || effect.appliedRound >= round) continue;
      if (effect.kind === 'damage_over_time') {
        const amount = Math.min(effect.perRound, unit.currentHp);
        emit(ctx, {
          type: 'OverTimeTicked',
          targetId: id,
          effectId: effect.id,
          kind: effect.kind,
          amount,
        });
        if (unit.currentHp - amount > 0) continue;
        if ('profileId' in unit) emit(ctx, { type: 'PlayerDowned', profileId: id });
        else emit(ctx, { type: 'EnemyDefeated', instanceId: id });
      } else if (effect.kind === 'heal_over_time') {
        const amount = Math.min(effect.perRound, effectiveMaxHp(unit) - unit.currentHp);
        emit(ctx, {
          type: 'OverTimeTicked',
          targetId: id,
          effectId: effect.id,
          kind: effect.kind,
          amount,
        });
      }
    }
  }
}
