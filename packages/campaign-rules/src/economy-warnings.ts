import {
  DROP_CHANCE_TIERS,
  REWARD_GUIDE,
  xpForNextLevel,
  type Range,
} from '@rpg-chains/game-config';
import type { CampaignDraft } from '@rpg-chains/shared-types';
import { formatPath, type DraftWarning } from './issues.js';

/** The recommended XP and gold of a battle node at `level`, summed over its villains. */
export function rewardBands(level: number): { xp: Range; gold: Range } {
  const { min, max } = REWARD_GUIDE.tolerance;
  const xp = xpForNextLevel(level) / REWARD_GUIDE.battlesPerLevel;
  const gold = REWARD_GUIDE.goldPerLevel * level;
  return {
    xp: { min: Math.floor(xp * min), max: Math.ceil(xp * max) },
    gold: { min: Math.floor(gold * min), max: Math.ceil(gold * max) },
  };
}

/**
 * Non-blocking economy warnings (Fase 4 plan decision 14): a battle node whose villains add up to
 * XP or gold outside the guide for its recommended level, a drop more frequent than the common
 * tier (drops are meant to be rare, spec §6), and an item sold in a shop at no price.
 */
export function economyWarnings(draft: CampaignDraft): DraftWarning[] {
  const warnings: DraftWarning[] = [];
  const villains = new Map(draft.villains.map((v) => [v.id, v]));

  draft.chapters.forEach((chapter, c) => {
    if (chapter.underConstruction) return;
    chapter.nodes.forEach((node, n) => {
      if (node.type !== 'battle' && node.type !== 'boss') return;
      if (node.recommendedLevel === null) return;
      const lineup = node.config.villainIds.flatMap((id) => villains.get(id) ?? []);
      const bands = rewardBands(node.recommendedLevel);
      const totals = {
        xp: lineup.reduce((sum, v) => sum + v.xpReward, 0),
        gold: lineup.reduce((sum, v) => sum + v.goldReward, 0),
      };
      for (const kind of ['xp', 'gold'] as const) {
        const value = totals[kind];
        const band = bands[kind];
        if (value >= band.min && value <= band.max) continue;
        warnings.push({
          code: kind === 'xp' ? 'battle_xp_out_of_band' : 'battle_gold_out_of_band',
          path: formatPath(['chapters', c, 'nodes', n, 'villainIds']),
          message: `Battle ${kind === 'xp' ? 'XP' : 'gold'} ${value} is outside the recommended ${band.min}–${band.max} for level ${node.recommendedLevel}`,
          value,
          band,
          chapterId: chapter.id,
          nodeId: node.id,
        });
      }
    });
  });

  draft.villains.forEach((villain, v) => {
    villain.drops.forEach((drop, d) => {
      if (drop.chance <= DROP_CHANCE_TIERS.common) return;
      warnings.push({
        code: 'drop_chance_high',
        path: formatPath(['villains', v, 'drops', d, 'chance']),
        message: `Drop chance ${Math.round(drop.chance * 100)}% is above the common tier`,
        value: drop.chance,
        band: { min: 0, max: DROP_CHANCE_TIERS.common },
      });
    });
  });

  const sold = new Set(
    draft.chapters
      .filter((chapter) => !chapter.underConstruction)
      .flatMap((chapter) => chapter.nodes)
      .flatMap((node) => (node.type === 'shop' ? node.config.itemIds : [])),
  );
  draft.items.forEach((item, i) => {
    if (!sold.has(item.id) || item.price > 0) return;
    warnings.push({
      code: 'item_price_missing',
      path: formatPath(['items', i, 'price']),
      message: `"${item.name}" is sold in a shop but has no price`,
      value: item.price,
      band: { min: 1, max: Number.MAX_SAFE_INTEGER },
    });
  });
  return warnings;
}
