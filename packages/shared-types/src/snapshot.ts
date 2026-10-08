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
/**
 * A chapter still under construction: only its name enters a snapshot, so the trail can show
 * it greyed out after the published chapters (spec §2.2, Fase 5 plan decision 18). Not content —
 * nothing references it, and the compatibility gate ignores it.
 */
export const UpcomingChapterSchema = z.object({ id: IdSchema, name: z.string() });
export type UpcomingChapter = z.infer<typeof UpcomingChapterSchema>;

export const CampaignSnapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  campaignId: IdSchema,
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().default(''),
  /** Published chapters, in the order a room plays them (spec §2.3). */
  chapters: z.array(ChapterSchema),
  /** Chapters under construction, after every published one; additive, older snapshots omit it. */
  upcomingChapters: z.array(UpcomingChapterSchema).default([]),
  classes: z.array(CharacterClassSchema),
  villains: z.array(VillainSchema),
  questions: z.array(QuestionSchema),
  items: z.array(ItemSchema),
});
export type CampaignSnapshot = z.infer<typeof CampaignSnapshotSchema>;
