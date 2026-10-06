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

/** Every turn-bound command carries the token of the stage it answers (stale/duplicate guard). */
const turnToken = z.number().int().nonnegative();

const tapSignal = z.object({ type: z.literal('TapSignal'), turnToken });
const submitObjectiveAnswer = z.object({
  type: z.literal('SubmitObjectiveAnswer'),
  turnToken,
  index: z.number().int().nonnegative(),
});
const submitOpenAnswer = z.object({
  type: z.literal('SubmitOpenAnswer'),
  turnToken,
  text: z.string().trim().min(1).max(2000),
});
const chooseAction = z.object({ type: z.literal('ChooseAction'), turnToken, action: ActionSchema });

/** Master intents (spec §3.2): show an open question — from the node or written on the spot. */
const presentQuestion = z.object({
  type: z.literal('PresentQuestion'),
  turnToken,
  question: z.union([
    z.object({ questionId: IdSchema }),
    z.object({ prompt: z.string().trim().min(1).max(2000) }),
  ]),
});
const judgeOpenAnswer = z.object({
  type: z.literal('JudgeOpenAnswer'),
  turnToken,
  approved: z.boolean(),
});

/**
 * What a client may send over the socket. Carries no actor: the server fills the player's
 * `profileId` from the session (a forged one in the payload is stripped by parsing), and only lets
 * the room master send master intents.
 */
export const ClientIntentSchema = z.discriminatedUnion('type', [
  tapSignal,
  submitObjectiveAnswer,
  submitOpenAnswer,
  chooseAction,
  presentQuestion,
  judgeOpenAnswer,
]);
export type ClientIntent = z.infer<typeof ClientIntentSchema>;

const actor = { profileId: IdSchema };

/** Player commands as the engine receives them, with the actor bound by the server. */
export const PlayerCommandSchema = z.discriminatedUnion('type', [
  tapSignal.extend(actor),
  submitObjectiveAnswer.extend(actor),
  submitOpenAnswer.extend(actor),
  chooseAction.extend(actor),
]);
export type PlayerCommand = z.infer<typeof PlayerCommandSchema>;

/** Master commands; the server has already checked the sender is the room master. */
export const MasterCommandSchema = z.discriminatedUnion('type', [presentQuestion, judgeOpenAnswer]);
export type MasterCommand = z.infer<typeof MasterCommandSchema>;

/**
 * Commands only the server issues (Fase 3 plan decisions 2, 8, 10): timers expiring and presence
 * changes. Timeouts are turn-bound; presence is not, so it never goes stale.
 */
export const SystemCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SignalExpired'), turnToken }),
  z.object({ type: z.literal('AnswerTimedOut'), turnToken }),
  z.object({ type: z.literal('ActionTimedOut'), turnToken }),
  z.object({ type: z.literal('PlayerLeft'), profileId: IdSchema }),
  z.object({ type: z.literal('MasterPresenceChanged'), online: z.boolean() }),
]);
export type SystemCommand = z.infer<typeof SystemCommandSchema>;

/** Everything `decide` accepts. A command may be rejected; only events are authoritative. */
export const CommandSchema = z.discriminatedUnion('type', [
  ...PlayerCommandSchema.options,
  ...MasterCommandSchema.options,
  ...SystemCommandSchema.options,
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];

/** A rejected command carries a reason for the client to surface. */
export interface Rejection {
  ok: false;
  reason: string;
}
