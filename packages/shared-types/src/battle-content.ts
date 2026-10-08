import { z } from 'zod';
import { IdSchema } from './common.js';
import { CharacterClassSchema, ItemSchema, QuestionSchema, VillainSchema } from './content.js';

/**
 * Immutable campaign content one battle reads, taken from the snapshot version it started on
 * (Fase 3 plan decision 3). Server-only: questions carry their answer keys. `decide` reads it;
 * `evolve` never does — events carry resolved numbers, so a log replays without content.
 */
export const BattleContentSchema = z.object({
  nodeId: IdSchema,
  /** The node's recommended level, which scales each participant's rewards (spec §4.5). */
  recommendedLevel: z.number().int().positive(),
  /** The node's villain ids in order, repeats included: one enemy instance per entry. */
  lineup: z.array(IdSchema).min(1),
  /** Villains of the node, each once. */
  villains: z.array(VillainSchema),
  /** The node's question pool, answer keys included. */
  questions: z.array(QuestionSchema),
  /** Classes of the version, for derived stats and skills (looked up by id). */
  classes: z.array(CharacterClassSchema),
  /** Items the participants hold (weapons, consumables), looked up by id. */
  items: z.array(ItemSchema),
});
export type BattleContent = z.infer<typeof BattleContentSchema>;
