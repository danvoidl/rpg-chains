import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * What one participant earned from a victory (spec §6, Fase 4 plan decisions 2–4): XP and gold
 * already multiplied by their own relevance factor, and the items their own drop rolls gave
 * (one entry per unit, named so clients show it without the catalog). Resolved by `decide`, so
 * the log replays without content.
 */
export const BattleRewardSchema = z.object({
  profileId: IdSchema,
  xp: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  items: z.array(z.object({ itemId: IdSchema, name: z.string() })),
});
export type BattleReward = z.infer<typeof BattleRewardSchema>;
