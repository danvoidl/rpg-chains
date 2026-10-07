import type { Combatant, Rejection } from '@rpg-chains/shared-types';
import { emit, type DecideContext } from '../decide-context.js';
import { resolveEffect } from '../effects/resolve-effect.js';
import { effectTargets } from '../effects/targets.js';
import { skillReady } from '../skill-ready.js';

const reject = (reason: string): Rejection => ({ ok: false, reason });

/**
 * Uses a skill (spec §3.4, §5.3): it must be unlocked, off cooldown and affordable, and its target
 * valid for its effect. Pays the energy, starts the cooldown, then resolves the effect.
 */
export function useSkill(
  ctx: DecideContext,
  actor: Combatant,
  skillId: string,
  targetId: string | undefined,
): Rejection | null {
  const skill = actor.skills.find((s) => s.id === skillId);
  if (!skill) return reject('unknown_skill');
  if (!skillReady(actor, skillId, ctx.state.round)) return reject('skill_on_cooldown');
  if (actor.currentEnergy < skill.energyCost) return reject('not_enough_energy');
  const targets = effectTargets(ctx, skill.effect, actor, targetId);
  if ('ok' in targets) return targets;

  emit(ctx, {
    type: 'ActionTaken',
    profileId: actor.profileId,
    action: { type: 'skill', skillId, ...(targetId ? { targetId } : {}) },
  });
  if (skill.energyCost > 0) {
    emit(ctx, { type: 'EnergyChanged', targetId: actor.profileId, delta: -skill.energyCost });
  }
  if (skill.cooldownRounds > 0) {
    emit(ctx, {
      type: 'CooldownStarted',
      profileId: actor.profileId,
      skillId,
      rounds: skill.cooldownRounds,
    });
  }
  resolveEffect(ctx, actor, skill.effect, targets);
  return null;
}
