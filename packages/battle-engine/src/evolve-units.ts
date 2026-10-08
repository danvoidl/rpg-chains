import type { ActiveEffect, BattleState, Combatant, Enemy } from '@rpg-chains/shared-types';

/**
 * State transitions on single combatants/enemies, used by `evolve`. Pure; they apply numbers the
 * events already resolved and never read campaign content.
 */

export function updateCombatant(
  state: BattleState,
  profileId: string,
  update: (c: Combatant) => Combatant,
): BattleState {
  return {
    ...state,
    combatants: state.combatants.map((c) => (c.profileId === profileId ? update(c) : c)),
  };
}

export function updateEnemy(
  state: BattleState,
  instanceId: string,
  update: (e: Enemy) => Enemy,
): BattleState {
  return {
    ...state,
    enemies: state.enemies.map((e) => (e.instanceId === instanceId ? update(e) : e)),
  };
}

/** Applies `update` to whichever unit (player or enemy) has this id. */
export function updateUnit(
  state: BattleState,
  id: string,
  update: <U extends Combatant | Enemy>(unit: U) => U,
): BattleState {
  return updateEnemy(updateCombatant(state, id, update), id, update);
}

/** Current max HP after any max-HP reduction, never below 1 (spec §5.4). */
export function effectiveMaxHp(unit: Combatant | Enemy): number {
  const reduction = unit.effects.find((e) => e.kind === 'max_hp_reduction');
  return Math.max(1, unit.maxHp - (reduction?.kind === 'max_hp_reduction' ? reduction.amount : 0));
}

/** Damage resolved by `decide`: the shield takes `absorbed`, HP takes `hpDamage`. */
export function takeDamage<U extends Combatant | Enemy>(
  unit: U,
  hpDamage: number,
  absorbed: number,
): U {
  const effects = unit.effects.flatMap((effect): ActiveEffect[] => {
    if (effect.kind !== 'shield' || absorbed === 0) return [effect];
    const remaining = effect.remaining - absorbed;
    return remaining > 0 ? [{ ...effect, remaining }] : [];
  });
  return { ...unit, currentHp: Math.max(0, unit.currentHp - hpDamage), effects };
}

export function heal<U extends Combatant | Enemy>(unit: U, amount: number): U {
  return { ...unit, currentHp: Math.min(effectiveMaxHp(unit), unit.currentHp + amount) };
}

/**
 * Group round `round` ends for an effect: `rounds` ticks down, unless it was applied in that very
 * round (spec §5.5: the round of application does not count). Turn/attack-counted ones don't tick.
 */
function tickEffect(effect: ActiveEffect, round: number): ActiveEffect[] {
  if (!('rounds' in effect) || effect.appliedRound >= round) return [effect];
  return effect.rounds > 1 ? [{ ...effect, rounds: effect.rounds - 1 }] : [];
}

/** Counts every entry of a cooldown map down by one, dropping the ones that reach zero. */
export function tickCooldowns(cooldowns: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(cooldowns)
      .map(([id, left]) => [id, left - 1] as const)
      .filter(([, left]) => left > 0),
  );
}

/**
 * End of group round `round` for one unit (spec §5.5): effects tick, and skill cooldowns that are
 * over by the next round are dropped (they hold the round they are back in, so they never tick).
 */
export function endRound<U extends Combatant | Enemy>(unit: U, round: number): U {
  const ticked = { ...unit, effects: unit.effects.flatMap((e) => tickEffect(e, round)) };
  // Losing a max-HP reduction restores the ceiling, not the HP lost to it.
  const capped = { ...ticked, currentHp: Math.min(ticked.currentHp, effectiveMaxHp(ticked)) };
  if (!('cooldowns' in capped)) return capped;
  const cooldowns = Object.fromEntries(
    Object.entries((capped as Combatant).cooldowns).filter(([, ready]) => ready > round + 1),
  );
  return { ...capped, cooldowns };
}

/** The head of the enemy queue acted (or lost its turn): it goes to the back (spec §3.1). */
export function rotateQueue(state: BattleState, instanceId: string): BattleState {
  return {
    ...state,
    enemyQueue: [...state.enemyQueue.filter((id) => id !== instanceId), instanceId],
  };
}
