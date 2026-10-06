/** Relevance factor — reward balancing (spec §4.5). */
export const RELEVANCE = {
  maxMultiplier: 3.0,
  minMultiplier: 0.05,
  underLeveledStep: 0.25,
  overLeveledStep: 0.2,
} as const;

/**
 * Multiplier applied to XP, gold and drop chance from the gap between a node's
 * recommended level and the player's level (spec §4.5).
 */
export function relevanceMultiplier(recommendedLevel: number, playerLevel: number): number {
  const delta = recommendedLevel - playerLevel;
  if (delta > 0) return Math.min(RELEVANCE.maxMultiplier, 1 + RELEVANCE.underLeveledStep * delta);
  if (delta < 0) return Math.max(RELEVANCE.minMultiplier, 1 + RELEVANCE.overLeveledStep * delta);
  return 1.0;
}
