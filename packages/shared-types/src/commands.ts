import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * The action a player takes after answering correctly (spec §3.4). All consume the group's
 * action for the round.
 */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('attack'), targetInstanceId: IdSchema }),
  z.object({ type: z.literal('skill'), skillId: IdSchema, targetId: IdSchema.optional() }),
  z.object({ type: z.literal('consumable'), itemId: IdSchema, targetId: IdSchema.optional() }),
]);
export type Action = z.infer<typeof ActionSchema>;

/**
 * Client intents (decision 2). A command may be rejected by `decide`; only the resulting
 * events are authoritative. `turnToken` guards against stale/duplicate delivery.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TapSignal'),
    battleId: IdSchema,
    profileId: IdSchema,
    turnToken: z.number().int(),
  }),
  z.object({
    type: z.literal('SubmitObjectiveAnswer'),
    battleId: IdSchema,
    profileId: IdSchema,
    turnToken: z.number().int(),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('SubmitOpenAnswer'),
    battleId: IdSchema,
    profileId: IdSchema,
    turnToken: z.number().int(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('JudgeOpenAnswer'),
    battleId: IdSchema,
    masterId: IdSchema,
    turnToken: z.number().int(),
    approved: z.boolean(),
  }),
  z.object({
    type: z.literal('ChooseAction'),
    battleId: IdSchema,
    profileId: IdSchema,
    turnToken: z.number().int(),
    action: ActionSchema,
  }),
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];

/** A rejected command carries a reason for the client to surface (decision 1). */
export interface Rejection {
  ok: false;
  reason: string;
}
