/** Progression config (spec §4.4). */
export const MAX_LEVEL = 20;
export const ATTRIBUTE_POINTS_PER_LEVEL = 3;

/** Default skill unlock levels; authors may override per class (spec §4.4). */
export const DEFAULT_SKILL_UNLOCK_LEVELS = [1, 4, 8, 13] as const;

/** XP required to advance from `level` to the next (spec §4.4). */
export function xpForNextLevel(level: number): number {
  return 100 * level;
}
