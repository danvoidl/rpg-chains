import {
  ALLOWED_TARGETS,
  type Combatant,
  type Effect,
  type Rejection,
} from '@rpg-chains/shared-types';
import type { DecideContext } from '../decide-context.js';
import { isActive } from '../signal.js';

const reject = (reason: string): Rejection => ({ ok: false, reason });

/**
 * Who an effect lands on (spec §5.3). Single targets come from the action's `targetId`; area
 * targets are everyone valid on that side. Allies must be in the fight — except for revive, which
 * only takes the downed (spec §3.7); nobody who left can be targeted (spec §7).
 */
export function effectTargets(
  ctx: DecideContext,
  effect: Effect,
  caster: Combatant,
  targetId: string | undefined,
): string[] | Rejection {
  if (effect.type === 'provoke') return [caster.profileId];
  if (!ALLOWED_TARGETS[effect.type].includes(effect.target)) return reject('invalid_target');

  const allyOk = (c: Combatant) => (effect.type === 'revive' ? c.downed && !c.left : isActive(c));
  const { combatants, enemies } = ctx.state;
  let ids: string[];
  switch (effect.target) {
    case 'self':
      ids = [caster.profileId];
      break;
    case 'ally': {
      const ally = combatants.find((c) => c.profileId === targetId);
      ids = ally && allyOk(ally) ? [ally.profileId] : [];
      break;
    }
    case 'all_allies':
      ids = combatants.filter(allyOk).map((c) => c.profileId);
      break;
    case 'enemy': {
      const enemy = enemies.find((e) => e.instanceId === targetId);
      ids = enemy && enemy.currentHp > 0 ? [enemy.instanceId] : [];
      break;
    }
    case 'all_enemies':
      ids = enemies.filter((e) => e.currentHp > 0).map((e) => e.instanceId);
      break;
  }
  return ids.length > 0 ? ids : reject('invalid_target');
}
