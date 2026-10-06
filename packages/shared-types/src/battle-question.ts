import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * A question as players see it: never carries the answer key (Fase 3 plan decision 13). An open
 * question created by the master mid-battle has no snapshot id (spec §3.2), so `questionId` is
 * null for it.
 */
export const PublicQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('objective'),
    questionId: IdSchema,
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
  }),
  z.object({
    type: z.literal('open'),
    questionId: IdSchema.nullable(),
    prompt: z.string().min(1),
  }),
]);
export type PublicQuestion = z.infer<typeof PublicQuestionSchema>;
