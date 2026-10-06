import { z } from 'zod';
import { IdSchema, SNAPSHOT_SCHEMA_VERSION } from './common.js';
import {
  ChapterSchema,
  CharacterClassSchema,
  VillainSchema,
  QuestionSchema,
  ItemSchema,
} from './content.js';

/**
 * Immutable published snapshot of a campaign version (decision 5). A room plays the latest
 * compatible published version, advancing to newer ones at safe boundaries; the battle engine
 * and fixtures read from here, never from the editable draft tables. Content references by id
 * resolve against these pools.
 */
export const CampaignSnapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  campaignId: IdSchema,
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().default(''),
  chapters: z.array(ChapterSchema),
  classes: z.array(CharacterClassSchema),
  villains: z.array(VillainSchema),
  questions: z.array(QuestionSchema),
  items: z.array(ItemSchema),
});
export type CampaignSnapshot = z.infer<typeof CampaignSnapshotSchema>;
