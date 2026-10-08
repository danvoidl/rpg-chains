import { z } from 'zod';
import { CampaignProfileSchema, InvestedAttributesSchema } from './accounts.js';
import { IdSchema } from './common.js';

/**
 * A player's character as their room closed (spec §7), written once into `History.finalData`.
 * The player's own record, so their private gold is in it.
 */
export const HistoryFinalDataSchema = z.object({
  classId: IdSchema,
  className: z.string().nullable(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  attributes: InvestedAttributesSchema,
  downed: z.boolean(),
  gold: z.number().int().nonnegative().default(0),
  equipment: CampaignProfileSchema.shape.equipment,
  inventory: CampaignProfileSchema.shape.inventory,
  /** The room had beaten the last chapter's boss (Fase 5 plan decision 10). */
  completed: z.boolean().default(false),
  chaptersCleared: z.number().int().nonnegative().default(0),
});
export type HistoryFinalData = z.infer<typeof HistoryFinalDataSchema>;

/** One closed campaign in a player's history (`GET /api/history`). */
export const HistoryEntrySchema = z.object({
  id: IdSchema,
  roomId: IdSchema,
  roomName: z.string(),
  campaignName: z.string(),
  closedAt: z.string(),
  character: HistoryFinalDataSchema,
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
