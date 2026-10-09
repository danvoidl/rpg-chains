import { z } from 'zod';
import { IdSchema } from './common.js';
import { ClientIntentSchema } from './commands.js';
import { PublicBattleEventSchema } from './events.js';
import { PublicBattleStateSchema } from './battle-state.js';

/**
 * Socket.IO contract of a running battle (Fase 3 plan decision 9). Unlike the room lobby, commands
 * travel here — with an ack — because the signal race needs low latency. Forming, starting and
 * cancelling a battle are REST (`battles.ts`). Nothing secret crosses this channel.
 */

/** Client → server: subscribe to a battle (participant or room member watching). */
export const BattleJoinMessageSchema = z.object({ battleId: IdSchema });
export type BattleJoinMessage = z.infer<typeof BattleJoinMessageSchema>;

export const BattleLeaveMessageSchema = z.object({ battleId: IdSchema });
export type BattleLeaveMessage = z.infer<typeof BattleLeaveMessageSchema>;

/**
 * The clock of the stage that waits on a player (spec §3.3): how long it had and how long is left
 * when the message left the server. Clients count down from their own receipt time, so devices
 * with skewed clocks still agree. Transport only — never in the log, so replay stays exact.
 */
export const BattleClockSchema = z.object({
  turnToken: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  remainingMs: z.number().int().nonnegative(),
});
export type BattleClock = z.infer<typeof BattleClockSchema>;

/** The public state at a log position; `seq` is the last event it includes. */
export const BattleSyncSchema = z.object({
  battleId: IdSchema,
  seq: z.number().int().nonnegative(),
  state: PublicBattleStateSchema,
  /** The running stage clock, or null when nobody is being timed (master, pause, end). */
  clock: BattleClockSchema.nullable(),
});
export type BattleSync = z.infer<typeof BattleSyncSchema>;

/** Acknowledgement of `battle:join`, carrying the state to start folding from. */
export type BattleJoinAck =
  | { ok: true; sync: BattleSync }
  | { ok: false; error: 'invalid_message' | 'battle_not_found' | 'not_allowed' };

/** Client → server: one intent; the ack says whether `decide` accepted it. */
export const BattleCommandMessageSchema = z.object({
  battleId: IdSchema,
  intent: ClientIntentSchema,
});
export type BattleCommandMessage = z.infer<typeof BattleCommandMessageSchema>;

export type BattleCommandAck = { ok: true } | { ok: false; reason: string };

/**
 * Server → client: events accepted together. `fromSeq..toSeq` spans the server log, which also
 * holds secret events the client never sees — a gap means "request a sync", not a missing event.
 */
export const BattleEventsMessageSchema = z.object({
  battleId: IdSchema,
  fromSeq: z.number().int().nonnegative(),
  toSeq: z.number().int().nonnegative(),
  events: z.array(PublicBattleEventSchema),
  /** The stage clock after these events. */
  clock: BattleClockSchema.nullable(),
});
export type BattleEventsMessage = z.infer<typeof BattleEventsMessageSchema>;

/** Client → server: ask for a fresh `BattleSync` (after a gap or a reconnect). */
export const BattleSyncRequestSchema = z.object({ battleId: IdSchema });
export type BattleSyncRequest = z.infer<typeof BattleSyncRequestSchema>;

export type BattleSyncAck =
  | { ok: true; sync: BattleSync }
  | { ok: false; error: 'invalid_message' | 'battle_not_found' | 'not_allowed' };

/**
 * Server → client: the battle left the server — resolved and written back, cancelled, or restarted
 * as a new formation (`next`). Nothing
 * of it can be synced any more.
 */
export const BattleClosedMessageSchema = z.object({
  battleId: IdSchema,
  reason: z.enum(['resolved', 'cancelled', 'restarted']),
  /** A restarted battle's new formation, on the same node with the same group (spec §7). */
  next: IdSchema.optional(),
});
export type BattleClosedMessage = z.infer<typeof BattleClosedMessageSchema>;

/** Event names of the battle channel, shared by server and client. */
export const BATTLE_EVENTS = {
  join: 'battle:join',
  leave: 'battle:leave',
  command: 'battle:command',
  events: 'battle:events',
  sync: 'battle:sync',
  closed: 'battle:closed',
} as const;
