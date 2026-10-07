import { z } from 'zod';
import { IdSchema } from './common.js';
import { RoomStatusSchema } from './accounts.js';
import { BattleNodeOptionSchema, BattleSummarySchema } from './battles.js';
import { RoomTurnTimersSchema } from './room-turn-timers.js';

/**
 * Room REST contracts (Fase 2, spec §7): write payloads validated by the server and reused by the
 * web forms, and the read models the room pages render.
 */

/** Length of a private room's access code; part of the contract, the join form checks it too. */
export const ACCESS_CODE_LENGTH = 6;

const RoomName = z.string().trim().min(1).max(80);
const AccessCode = z
  .string()
  .trim()
  .transform((code) => code.toUpperCase())
  .pipe(z.string().length(ACCESS_CODE_LENGTH));

export const RoomCreateInputSchema = z.object({
  campaignId: IdSchema,
  name: RoomName,
  isPublic: z.boolean(),
});
export type RoomCreateInput = z.infer<typeof RoomCreateInputSchema>;

/**
 * Master-only edits. Turning private generates a code; turning public drops it. `turnTimers`
 * replaces the room's timer adjustments as a whole.
 */
export const RoomPatchSchema = z
  .object({ name: RoomName, isPublic: z.boolean(), turnTimers: RoomTurnTimersSchema })
  .partial();
export type RoomPatch = z.infer<typeof RoomPatchSchema>;

export const JoinByCodeInputSchema = z.object({ code: AccessCode });
export type JoinByCodeInput = z.infer<typeof JoinByCodeInputSchema>;

/** First entry into a room: pick a class with a free slot (spec §5.2, §7). */
export const ChooseClassInputSchema = z.object({
  classId: IdSchema,
  /** Required for a private room unless the caller is its master. */
  accessCode: AccessCode.optional(),
});
export type ChooseClassInput = z.infer<typeof ChooseClassInputSchema>;

export const TransferMasterInputSchema = z.object({ userId: IdSchema });
export type TransferMasterInput = z.infer<typeof TransferMasterInputSchema>;

const PersonSchema = z.object({ id: IdSchema, name: z.string() });

/** A published campaign anyone can open a room for. */
export const CatalogCampaignSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string(),
  author: PersonSchema,
  latestVersion: z.number().int().positive(),
});
export type CatalogCampaign = z.infer<typeof CatalogCampaignSchema>;

/** A room in a list (public rooms, my rooms). */
export const RoomSummarySchema = z.object({
  id: IdSchema,
  name: z.string(),
  isPublic: z.boolean(),
  status: RoomStatusSchema,
  campaign: z.object({ id: IdSchema, name: z.string() }),
  master: PersonSchema,
  /** Players with a profile (the master counts only once they pick a class). */
  playerCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

/** Someone in the room: everyone with a profile, plus the master even before picking a class. */
export const RoomMemberSchema = z.object({
  userId: IdSchema,
  name: z.string(),
  isMaster: z.boolean(),
  /** Null while the member (only ever the master) has not picked a class. */
  profile: z
    .object({
      classId: IdSchema,
      className: z.string(),
      level: z.number().int().positive(),
      downed: z.boolean(),
      /** Combat resources between battles (written back when a battle ends, spec §3.7). */
      currentHp: z.number().int().nonnegative(),
      maxHp: z.number().int().positive(),
      currentEnergy: z.number().int().nonnegative(),
      maxEnergy: z.number().int().nonnegative(),
    })
    .nullable(),
});
export type RoomMember = z.infer<typeof RoomMemberSchema>;

/** A class of the room's current version, with how many slots its profiles take (spec §5.2). */
export const RoomClassSlotSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string(),
  artUrl: z.string().nullable(),
  baseHp: z.number(),
  baseEnergy: z.number(),
  maxSlots: z.number().int().positive(),
  slotsTaken: z.number().int().nonnegative(),
});
export type RoomClassSlot = z.infer<typeof RoomClassSlotSchema>;

/** Everything the room page renders. */
export const RoomDetailSchema = z.object({
  id: IdSchema,
  name: z.string(),
  isPublic: z.boolean(),
  status: RoomStatusSchema,
  /** Only sent to the master; null for everyone else and for public rooms. */
  accessCode: z.string().nullable(),
  campaign: z.object({ id: IdSchema, name: z.string() }),
  /** Published version the room currently plays (it rolls forward at safe points). */
  version: z.number().int().positive(),
  master: PersonSchema,
  members: z.array(RoomMemberSchema),
  classes: z.array(RoomClassSlotSchema),
  /** Battles forming or running in the room (Fase 3). */
  battles: z.array(BattleSummarySchema),
  /** Nodes of the current version a formation can open on (provisional list until the map). */
  battleNodes: z.array(BattleNodeOptionSchema),
  /** The master's adjustments to the turn timers; a missing key is the platform default. */
  turnTimers: RoomTurnTimersSchema,
  /** The caller's own standing in the room. */
  viewer: z.object({ isMaster: z.boolean(), hasProfile: z.boolean() }),
});
export type RoomDetail = z.infer<typeof RoomDetailSchema>;
