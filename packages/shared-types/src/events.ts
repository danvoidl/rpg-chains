import { z } from 'zod';
import { IdSchema } from './common.js';
import { ActionSchema } from './commands.js';

/**
 * Domain events — consummated facts folded by the engine (decision 1 & 2). This is what
 * the battle log stores and what the client renders. Never rejected; already validated by
 * `decide`.
 */
export const BattleEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BattleStarted'),
    battleId: IdSchema,
    /** Seed for the folded PRNG (decision 3). */
    seed: z.number().int(),
    initiative: z.enum(['group', 'enemies']),
    turnToken: z.number().int(),
  }),
  z.object({ type: z.literal('SignalOpened'), questionId: IdSchema, turnToken: z.number().int() }),
  z.object({ type: z.literal('SignalWonBy'), profileId: IdSchema }),
  z.object({ type: z.literal('AnswerJudged'), profileId: IdSchema, correct: z.boolean() }),
  z.object({ type: z.literal('ActionTaken'), profileId: IdSchema, action: ActionSchema }),
  z.object({
    type: z.literal('DamageDealt'),
    sourceId: IdSchema,
    targetId: IdSchema,
    value: z.number(),
  }),
  z.object({ type: z.literal('Healed'), targetId: IdSchema, value: z.number() }),
  z.object({
    type: z.literal('EffectApplied'),
    targetId: IdSchema,
    effectType: z.string(),
    value: z.number(),
    duration: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('EffectExpired'), targetId: IdSchema, effectType: z.string() }),
  z.object({
    type: z.literal('EnemyActed'),
    instanceId: IdSchema,
    attackId: IdSchema,
    targetIds: z.array(IdSchema),
  }),
  z.object({ type: z.literal('PlayerDowned'), profileId: IdSchema }),
  z.object({ type: z.literal('PlayerRevived'), profileId: IdSchema }),
  z.object({
    type: z.literal('TurnAdvanced'),
    turnToken: z.number().int(),
    activeSide: z.enum(['group', 'enemy']),
    instanceId: IdSchema.optional(),
  }),
  z.object({ type: z.literal('BattleResolved'), result: z.enum(['victory', 'defeat']) }),
]);
export type BattleEvent = z.infer<typeof BattleEventSchema>;
export type BattleEventType = BattleEvent['type'];

/** Log envelope: server sequence number wrapping each accepted event (decision 4). */
export const LoggedEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  event: BattleEventSchema,
});
export type LoggedEvent = z.infer<typeof LoggedEventSchema>;
