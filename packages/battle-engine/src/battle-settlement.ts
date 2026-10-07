import { DEFEAT_GOLD_LOSS_FRACTION } from '@rpg-chains/game-config';
import type { BattleReward, CharacterClass } from '@rpg-chains/shared-types';
import type { ProfileOutcome } from './battle-outcome.js';
import { applyXp, type Progress } from './progression.js';

/** The durable part of a profile a battle changes (spec §3.7, §4.4, §6). */
export interface SettledProfile extends Progress {
  gold: number;
  /** Item ids, one per unit. */
  inventory: string[];
}

/** What one participant's battle came to, as the write-back gathers it. */
export interface BattleSettlement {
  outcome: ProfileOutcome;
  /** Consumables used, one id per unit. */
  consumed: readonly string[];
  /** The victory's reward; absent on a defeat and for whoever left. */
  reward?: BattleReward;
  defeat: boolean;
}

/**
 * A profile after its battle (Fase 4 plan decisions 3, 5, 10, 12): resources as the battle ended,
 * used consumables out of the inventory, then — on a victory — XP (with any level-ups raising the
 * resources), gold and dropped items added; on a defeat, `DEFEAT_GOLD_LOSS_FRACTION` of the gold
 * lost, by everyone who fought, including whoever left. Everything is a delta on the profile as
 * read now, so nothing else written meanwhile is overwritten.
 */
export function settleProfile(
  cls: Pick<CharacterClass, 'baseHp' | 'baseEnergy' | 'hpPerLevel' | 'energyPerLevel'>,
  profile: SettledProfile,
  { outcome, consumed, reward, defeat }: BattleSettlement,
): SettledProfile {
  const inventory = [...profile.inventory];
  for (const itemId of consumed) {
    const index = inventory.indexOf(itemId);
    if (index !== -1) inventory.splice(index, 1);
  }
  const afterBattle: SettledProfile = {
    ...profile,
    currentHp: outcome.currentHp,
    currentEnergy: outcome.currentEnergy,
    downed: outcome.downed,
    inventory,
  };
  if (defeat) {
    const lost = Math.floor(profile.gold * DEFEAT_GOLD_LOSS_FRACTION);
    return { ...afterBattle, gold: profile.gold - lost };
  }
  if (!reward) return afterBattle;
  return {
    ...afterBattle,
    ...applyXp(cls, afterBattle, reward.xp),
    gold: profile.gold + reward.gold,
    inventory: [...inventory, ...reward.items.map((item) => item.itemId)],
  };
}
