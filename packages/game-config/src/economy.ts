/** Economy config (spec §6, §3.7, Fase 4 plan decisions 1, 9, 10). */

/**
 * Preset drop chances an author picks per villain drop (spec §6): simple items in the common
 * tier, good ones in the rare tier. Fractions of 1; the editor may fine-tune within the cap.
 */
export const DROP_CHANCE_TIERS = {
  common: 0.35,
  uncommon: 0.12,
  rare: 0.03,
} as const;
export type DropChanceTier = keyof typeof DROP_CHANCE_TIERS;

/** No drop is ever certain: the cap holds after the relevance multiplier too (spec §4.5, §6). */
export const MAX_DROP_CHANCE = 0.6;

/**
 * Recommended rewards of a battle node at its recommended level `L` (Fase 4 plan decision 14),
 * summed over its villains. XP: `xpForNextLevel(L) / battlesPerLevel`, so about that many
 * on-level battles take a level. Gold: `goldPerLevel × L`. Outside `tolerance` × the guide, the
 * editor warns; it never blocks.
 */
export const REWARD_GUIDE = {
  battlesPerLevel: 4,
  goldPerLevel: 10,
  tolerance: { min: 0.5, max: 2 },
} as const;

/** Share of each participant's gold lost on a defeat, rounded down (spec §3.7). */
export const DEFEAT_GOLD_LOSS_FRACTION = 0.2;

/** How long a trade offer waits for the other player's answer (spec §6). */
export const TRADE_OFFER_TIMEOUT_MS = 120_000;
