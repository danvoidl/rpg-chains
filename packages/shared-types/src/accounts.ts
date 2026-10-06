import { z } from 'zod';
import { IdSchema } from './common.js';

/** Equipped item id per slot; every slot optional (spec §6). */
const EquipmentSchema = z.object({
  weapon: IdSchema.optional(),
  helmet: IdSchema.optional(),
  chest: IdSchema.optional(),
  boots: IdSchema.optional(),
  bracers: IdSchema.optional(),
  rings: IdSchema.optional(),
});

/** Global account (spec §2.1). Auth fields live in the auth tables, not here. */
export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  name: z.string().min(1),
});
export type User = z.infer<typeof UserSchema>;

export const RoomStatusSchema = z.enum(['open', 'completed', 'closed']);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

/** Living instance of a campaign version (spec §2.1, §7). */
export const RoomSchema = z.object({
  id: IdSchema,
  campaignId: IdSchema,
  /** Current applied published version; advances to newer compatible versions at safe boundaries (decision 5). */
  campaignVersionId: IdSchema,
  isPublic: z.boolean(),
  accessCode: z.string().optional(),
  /** Owner/master; transferable (spec §7). */
  masterId: IdSchema,
  status: RoomStatusSchema,
});
export type Room = z.infer<typeof RoomSchema>;

/** Distributed attribute points (spec §4.1, §4.4). */
export const InvestedAttributesSchema = z.object({
  strength: z.number().int().nonnegative(),
  dexterity: z.number().int().nonnegative(),
  intelligence: z.number().int().nonnegative(),
});
export type InvestedAttributes = z.infer<typeof InvestedAttributesSchema>;

/**
 * A player's character inside one room (spec §2.1, §7). Durable, not session state — the
 * downed flag persists so reconnecting never revives (spec §3.7). `classId` references into
 * the room's current snapshot; validated at creation, not an FK — the publish compatibility
 * gate keeps it valid as the room rolls forward (decision 5).
 */
export const CampaignProfileSchema = z.object({
  id: IdSchema,
  roomId: IdSchema,
  userId: IdSchema,
  classId: IdSchema,
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  availablePoints: z.number().int().nonnegative(),
  attributes: InvestedAttributesSchema,
  currentHp: z.number().nonnegative(),
  currentEnergy: z.number().nonnegative(),
  downed: z.boolean(),
  equipment: EquipmentSchema,
  inventory: z.array(IdSchema),
});
export type CampaignProfile = z.infer<typeof CampaignProfileSchema>;

/** Shared party gold and items, distributed by vote (spec §6). */
export const GroupBagSchema = z.object({
  roomId: IdSchema,
  gold: z.number().int().nonnegative(),
  items: z.array(IdSchema),
});
export type GroupBag = z.infer<typeof GroupBagSchema>;
