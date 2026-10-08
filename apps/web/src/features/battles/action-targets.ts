import type { Combatant, Effect, PublicBattleState } from '@rpg-chains/shared-types';

export interface TargetChoice {
  id: string;
  name: string;
}

/**
 * Who the viewer may aim an effect at, mirroring the engine's `effects/targets.ts`: living
 * enemies, allies in the fight, or — for revive — the downed. Null when there is nothing to
 * choose (self, area, provoke); the engine still has the last word.
 */
export function targetChoices(
  effect: Effect,
  view: PublicBattleState,
  me: Combatant,
): TargetChoice[] | null {
  if (effect.type === 'provoke') return null;
  switch (effect.target) {
    case 'self':
    case 'all_allies':
    case 'all_enemies':
      return null;
    case 'enemy':
      return view.enemies
        .filter((e) => e.currentHp > 0)
        .map((e) => ({ id: e.instanceId, name: e.name }));
    case 'ally':
      return view.combatants
        .filter((c) => !c.left && (effect.type === 'revive' ? c.downed : !c.downed))
        .map((c) => ({
          id: c.profileId,
          name: c.profileId === me.profileId ? `${c.name} (você)` : c.name,
        }));
  }
}
