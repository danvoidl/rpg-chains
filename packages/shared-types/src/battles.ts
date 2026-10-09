import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * Battle REST contracts (Fase 3 plan decision 9): opening a formation on a node, joining it and
 * starting are room mutations, so they are REST like the rest of the room; the running battle
 * talks over the socket (`battle-realtime.ts`).
 */

/** Open a formation on a `battle` or `boss` node of the room's current version. */
export const BattleCreateInputSchema = z.object({ nodeId: IdSchema });
export type BattleCreateInput = z.infer<typeof BattleCreateInputSchema>;

export const BattleStatusSchema = z.enum(['forming', 'running']);
export type BattleStatus = z.infer<typeof BattleStatusSchema>;

/** A battle as the room page lists it. Ended battles leave the list. */
export const BattleSummarySchema = z.object({
  battleId: IdSchema,
  nodeId: IdSchema,
  /** The node's author title; may be empty. */
  nodeTitle: z.string(),
  nodeType: z.enum(['battle', 'boss']),
  status: BattleStatusSchema,
  participants: z.array(z.object({ profileId: IdSchema, userId: IdSchema, name: z.string() })),
  /** Null for a boss node, which has no limit (spec §2.3). */
  participantLimit: z.number().int().positive().nullable(),
  /** The node has open questions: the master must be online to start, and judges (spec §3.2). */
  needsMaster: z.boolean(),
});
export type BattleSummary = z.infer<typeof BattleSummarySchema>;

/**
 * Asking to cancel a running battle while the master is away (spec §7, Fase 6 plan decision 8):
 * it is cancelled once every connected participant asked within the timeout.
 */
export const CancelRequestResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('requested'), waitingFor: z.number().int().positive() }),
]);
export type CancelRequestResult = z.infer<typeof CancelRequestResultSchema>;
