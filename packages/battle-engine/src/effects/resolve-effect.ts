import type { ActiveEffect, Combatant, Effect, Enemy } from '@rpg-chains/shared-types';
import { emit, nextEffectId, type DecideContext } from '../decide-context.js';
import { effectiveMaxHp } from '../evolve-units.js';
import { outgoingDamage, weaponRawDamage } from '../stats.js';
import { strike } from '../strike.js';
import { dispelled } from './dispel.js';
import { magnitudeValue } from './magnitude.js';

type Unit = Combatant | Enemy;

function unitOf(ctx: DecideContext, id: string): Unit {
  const unit =
    ctx.state.combatants.find((c) => c.profileId === id) ??
    ctx.state.enemies.find((e) => e.instanceId === id);
  if (!unit) throw new Error(`no unit ${id}`);
  return unit;
}

/** Distributes Omit over the union, so each effect kind keeps its own fields. */
type EffectBody = ActiveEffect extends infer E
  ? E extends ActiveEffect
    ? Omit<E, 'id' | 'sourceId' | 'appliedRound'>
    : never
  : never;

function apply(ctx: DecideContext, caster: Combatant, targetId: string, body: EffectBody): void {
  const effect = {
    ...body,
    id: nextEffectId(ctx),
    sourceId: caster.profileId,
    appliedRound: ctx.state.round,
  } as ActiveEffect;
  emit(ctx, { type: 'EffectApplied', targetId, effect });
}

/**
 * Resolves one effect of a skill or consumable on its targets (spec §5.4), emitting events with
 * every number already final so `evolve` never needs content (Fase 3 plan decision 3). Numbers are
 * floored; `percent` follows the per-type table of the kit draft. Damage goes through the same
 * chain as an attack — the caster's damage modifiers, the target's defense, shield, HP.
 */
export function resolveEffect(
  ctx: DecideContext,
  caster: Combatant,
  effect: Effect,
  targetIds: readonly string[],
): void {
  for (const targetId of targetIds) {
    // Read fresh: an earlier target of an area effect may have changed the state.
    const target = unitOf(ctx, targetId);
    const maxHp = effectiveMaxHp(target);
    const value = (magnitude: Parameters<typeof magnitudeValue>[0], percentOf: number) =>
      Math.floor(magnitudeValue(magnitude, caster, percentOf));

    switch (effect.type) {
      case 'damage': {
        if (target.currentHp <= 0) break;
        const raw = value(effect.magnitude, weaponRawDamage(caster));
        strike(ctx, caster.profileId, targetId, outgoingDamage(raw, caster));
        break;
      }
      case 'damage_over_time':
        apply(ctx, caster, targetId, {
          kind: 'damage_over_time',
          perRound: value(effect.magnitudePerRound, target.maxHp),
          rounds: effect.duration,
        });
        break;
      case 'heal': {
        const amount = Math.min(value(effect.magnitude, maxHp), maxHp - target.currentHp);
        emit(ctx, { type: 'Healed', sourceId: caster.profileId, targetId, amount });
        break;
      }
      case 'heal_over_time':
        apply(ctx, caster, targetId, {
          kind: 'heal_over_time',
          perRound: value(effect.magnitudePerRound, target.maxHp),
          rounds: effect.duration,
        });
        break;
      case 'revive': {
        // Falling cleared every effect, so the ceiling is the full max HP.
        const hp = Math.max(
          1,
          Math.floor((target.maxHp * Math.min(100, effect.healthPercent)) / 100),
        );
        emit(ctx, { type: 'PlayerRevived', profileId: targetId, hp });
        break;
      }
      case 'restore_energy': {
        if (!('maxEnergy' in target)) break;
        const delta = Math.min(
          value(effect.magnitude, target.maxEnergy),
          target.maxEnergy - target.currentEnergy,
        );
        if (delta > 0) emit(ctx, { type: 'EnergyChanged', targetId, delta });
        break;
      }
      case 'provoke':
        apply(ctx, caster, targetId, { kind: 'provoke', attacks: effect.duration });
        break;
      case 'shield':
        apply(ctx, caster, targetId, {
          kind: 'shield',
          remaining: value(effect.magnitude, target.maxHp),
          rounds: effect.duration,
        });
        break;
      case 'buff_attribute':
      case 'debuff_attribute': {
        const percent = effect.magnitude.mode === 'percent';
        apply(ctx, caster, targetId, {
          kind: 'stat_modifier',
          polarity: effect.type === 'buff_attribute' ? 'buff' : 'debuff',
          stat: effect.attribute,
          channel: percent ? 'percent' : 'flat',
          // Percentage points stay as authored: they are a live multiplier (spec §5.3).
          value:
            effect.magnitude.mode === 'percent'
              ? Math.max(0, effect.magnitude.percent)
              : value(effect.magnitude, 0),
          rounds: effect.duration,
        });
        break;
      }
      case 'max_hp_reduction':
        apply(ctx, caster, targetId, {
          kind: 'max_hp_reduction',
          amount: value(effect.magnitude, target.maxHp),
          rounds: effect.duration,
        });
        break;
      case 'stun':
        apply(ctx, caster, targetId, { kind: 'stun', turns: effect.duration });
        break;
      case 'dispel':
        for (const removed of dispelled(target.effects, effect.removes, effect.amount)) {
          emit(ctx, { type: 'EffectRemoved', targetId, effectId: removed.id, reason: 'dispelled' });
        }
        break;
    }
  }
}
