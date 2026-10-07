import { MAX_DROP_CHANCE, relevanceMultiplier } from '@rpg-chains/game-config';
import type { BattleReward } from '@rpg-chains/shared-types';
import { draw, emit, type DecideContext } from './decide-context.js';
import { nextFloat } from './prng.js';

/**
 * A victory's rewards (spec §6, Fase 4 plan decisions 1–4). The battle is worth the sum of its
 * enemies' XP and gold; each participant still in it — downed ones included, those who left
 * excluded — gets it whole, multiplied by their own relevance factor (spec §4.5), and rolls every
 * drop of every enemy for themselves with `min(MAX_DROP_CHANCE, chance × factor)`. Draws go
 * through the context in a fixed order (participant, enemy, drop), so the log replays exactly.
 */
export function grantRewards(ctx: DecideContext): void {
  const { content, state } = ctx;
  const villains = state.enemies.flatMap(
    (enemy) => content.villains.find((v) => v.id === enemy.villainId) ?? [],
  );
  const xp = villains.reduce((sum, v) => sum + v.xpReward, 0);
  const gold = villains.reduce((sum, v) => sum + v.goldReward, 0);

  const rewards = state.combatants
    .filter((c) => !c.left)
    .map((c): BattleReward => {
      const factor = relevanceMultiplier(content.recommendedLevel, c.level);
      const items: BattleReward['items'] = [];
      for (const villain of villains) {
        for (const drop of villain.drops) {
          const chance = Math.min(MAX_DROP_CHANCE, drop.chance * factor);
          if (draw(ctx, nextFloat) < chance) {
            const name = content.items.find((i) => i.id === drop.itemId)?.name ?? drop.itemId;
            items.push({ itemId: drop.itemId, name });
          }
        }
      }
      return {
        profileId: c.profileId,
        xp: Math.floor(xp * factor),
        gold: Math.floor(gold * factor),
        items,
      };
    });
  emit(ctx, { type: 'RewardsGranted', rewards });
}
