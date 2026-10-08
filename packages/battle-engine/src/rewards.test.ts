import { describe, expect, it } from 'vitest';
import { MAX_DROP_CHANCE } from '@rpg-chains/game-config';
import type { BattleContent, BattleEvent, BattleState } from '@rpg-chains/shared-types';
import { createContext } from './decide-context.js';
import { basicContent, fencers, startWith } from './fixtures/battle-setup.js';
import { grantRewards } from './rewards.js';

/** The boss node (two rats) at recommended level 3; each rat is worth 20 XP and 10 gold. */
function ratContent(drops: Array<{ itemId: string; chance: number }> = []): BattleContent {
  return basicContent('n-boss', (content) => {
    content.recommendedLevel = 3;
    content.villains = content.villains.map((v) => ({ ...v, xpReward: 20, goldReward: 10, drops }));
  });
}

/**
 * Three fencers at the moment the last rat falls: the first on level 1, the second on level 5 and
 * downed, the third gone from the battle.
 */
function wonState(seed = 1): BattleState {
  const { state } = startWith(ratContent(), fencers(3), 'group');
  const [first, second, third] = state.combatants;
  return {
    ...state,
    enemies: state.enemies.map((e) => ({ ...e, currentHp: 0 })),
    combatants: [
      first!,
      { ...second!, level: 5, downed: true, currentHp: 0 },
      { ...third!, left: true },
    ],
    secret: { ...state.secret, prng: { seed, cursor: 0 } },
  };
}

function rewardsOf(state: BattleState, content: BattleContent) {
  const ctx = createContext(state, content);
  grantRewards(ctx);
  const event = ctx.events.find(
    (e): e is Extract<BattleEvent, { type: 'RewardsGranted' }> => e.type === 'RewardsGranted',
  );
  return { rewards: event!.rewards, cursor: ctx.prng.cursor };
}

describe('grantRewards (Fase 4 plan decisions 1–4)', () => {
  it('gives each participant still in the battle the whole reward, scaled by their own level', () => {
    const state = wonState();
    const [first, second] = state.combatants;
    const { rewards } = rewardsOf(state, ratContent());
    // Two rats: 40 XP and 20 gold. Level 1 at a level 3 node: ×1.5. Level 5: ×0.6.
    expect(rewards).toEqual([
      { profileId: first!.profileId, xp: 60, gold: 30, items: [] },
      { profileId: second!.profileId, xp: 24, gold: 12, items: [] },
    ]);
  });

  it('draws nothing when no enemy drops anything', () => {
    expect(rewardsOf(wonState(), ratContent()).cursor).toBe(0);
  });

  it('rolls every drop of every enemy for each participant, in a fixed order', () => {
    const content = ratContent([
      { itemId: 'it-tail', chance: 0.35 },
      { itemId: 'it-fang', chance: 0.03 },
    ]);
    // 2 participants × 2 rats × 2 drops.
    const { cursor } = rewardsOf(wonState(), content);
    expect(cursor).toBe(8);
    expect(rewardsOf(wonState(7), content)).toEqual(rewardsOf(wonState(7), content));
  });

  it('never lets a drop be certain, even after the relevance multiplier', () => {
    // 0.5 × 1.5 would be 0.75; the cap holds it at MAX_DROP_CHANCE.
    const content = ratContent([{ itemId: 'it-tail', chance: 0.5 }]);
    let drops = 0;
    let rolls = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const [first] = rewardsOf(wonState(seed), content).rewards;
      drops += first!.items.length;
      rolls += 2;
    }
    const rate = drops / rolls;
    expect(rate).toBeGreaterThan(MAX_DROP_CHANCE - 0.05);
    expect(rate).toBeLessThan(MAX_DROP_CHANCE + 0.05);
  });
});
