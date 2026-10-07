import { describe, expect, it } from 'vitest';
import type { CampaignDraft, DraftNode } from '@rpg-chains/shared-types';
import { draftWarnings } from './draft-warnings.js';
import { economyWarnings, rewardBands } from './economy-warnings.js';
import { validDraft } from './fixtures/load.js';

function node(draft: CampaignDraft, id: string): DraftNode {
  return draft.chapters[0]!.nodes.find((n) => n.id === id)!;
}

describe('economyWarnings (Fase 4 plan decision 14)', () => {
  it('has no warnings for the in-band fixture', () => {
    expect(draftWarnings(validDraft())).toEqual([]);
  });

  it('derives the reward guide from the XP curve and the node level', () => {
    // Level 1: 100 XP to level up over 4 battles → 25, tolerance ×0.5–×2.
    expect(rewardBands(1)).toEqual({ xp: { min: 12, max: 50 }, gold: { min: 5, max: 20 } });
    expect(rewardBands(3).xp).toEqual({ min: 37, max: 150 });
  });

  it('warns about a battle whose villains add up outside the guide, per node', () => {
    const draft = validDraft();
    draft.villains[0]!.xpReward = 0;
    draft.villains[0]!.goldReward = 500;
    const warnings = economyWarnings(draft);
    expect(warnings.map((w) => [w.code, w.nodeId, w.value])).toEqual([
      ['battle_xp_out_of_band', 'n-a', 0],
      ['battle_gold_out_of_band', 'n-a', 500],
      ['battle_xp_out_of_band', 'n-boss', 0],
      ['battle_gold_out_of_band', 'n-boss', 500],
    ]);
  });

  it('sums repeated villains of a lineup', () => {
    const draft = validDraft();
    const a = node(draft, 'n-a');
    if (a.type !== 'battle') throw new Error('fixture');
    // Two wardens: 60 XP and 30 gold, both over level 1's guide.
    a.config.villainIds = ['v-1', 'v-1'];
    expect(economyWarnings(draft)).toEqual([
      expect.objectContaining({ nodeId: 'n-a', value: 60, band: { min: 12, max: 50 } }),
      expect.objectContaining({ nodeId: 'n-a', value: 30, band: { min: 5, max: 20 } }),
    ]);
  });

  it('warns about a drop more frequent than the common tier', () => {
    const draft = validDraft();
    draft.villains[0]!.drops = [{ itemId: 'it-sword', chance: 0.5 }];
    expect(economyWarnings(draft)).toEqual([
      expect.objectContaining({ code: 'drop_chance_high', path: 'villains[0].drops[0].chance' }),
    ]);
  });

  it('warns about an item sold in a shop without a price', () => {
    const draft = validDraft();
    const camp = node(draft, 'n-b');
    draft.chapters[0]!.nodes = draft.chapters[0]!.nodes.map((n) =>
      n.id === camp.id ? { ...n, type: 'shop', config: { itemIds: ['it-sword'] } } : n,
    ) as DraftNode[];
    expect(economyWarnings(draft)).toEqual([
      expect.objectContaining({ code: 'item_price_missing', path: 'items[0].price' }),
    ]);
    draft.items[0]!.price = 40;
    expect(economyWarnings(draft)).toEqual([]);
  });
});
