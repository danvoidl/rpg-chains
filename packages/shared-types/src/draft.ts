import { z } from 'zod';
import { IdSchema } from './common.js';
import {
  ChapterBackgroundSchema,
  EdgeSchema,
  QuestionSchema,
  VillainAttackSchema,
} from './content.js';

/**
 * Editable campaign draft (spec §2.2, Fase 1). Unlike the snapshot, the draft tolerates
 * incompleteness: fields are shape-checked only, so a battle without villains is still
 * saveable. Completeness is enforced by the publish validation gate (`campaign-rules`).
 * Draft ids are the snapshot ids — the compatibility gate compares versions by id.
 */

export const NodeTypeSchema = z.enum(['battle', 'boss', 'shop', 'campfire', 'narrative']);
export type NodeType = z.infer<typeof NodeTypeSchema>;

const DraftNodeBaseSchema = z.object({
  id: IdSchema,
  title: z.string().default(''),
  mandatory: z.boolean(),
  recommendedLevel: z.number().int().positive().nullable(),
  participantLimit: z.number().int().positive().nullable(),
  position: z.object({ x: z.number(), y: z.number() }),
  prerequisites: z.array(IdSchema),
});

const CombatConfigSchema = z.object({
  villainIds: z.array(IdSchema),
  questionIds: z.array(IdSchema),
});

/** Type-specific node params live in `config` (the `ChapterNode.config` jsonb column). */
export const DraftNodeSchema = z.discriminatedUnion('type', [
  DraftNodeBaseSchema.extend({ type: z.literal('battle'), config: CombatConfigSchema }),
  DraftNodeBaseSchema.extend({ type: z.literal('boss'), config: CombatConfigSchema }),
  DraftNodeBaseSchema.extend({
    type: z.literal('shop'),
    config: z.object({ itemIds: z.array(IdSchema) }),
  }),
  DraftNodeBaseSchema.extend({ type: z.literal('campfire'), config: z.object({}) }),
  DraftNodeBaseSchema.extend({
    type: z.literal('narrative'),
    config: z.object({ text: z.string(), videoUrl: z.string().url().nullable() }),
  }),
]);
export type DraftNode = z.infer<typeof DraftNodeSchema>;

/** A chapter's whole graph; saved atomically by `PUT .../graph`. */
export const DraftGraphSchema = z.object({
  entryNodeId: IdSchema.nullable(),
  bossNodeId: IdSchema.nullable(),
  nodes: z.array(DraftNodeSchema),
  edges: z.array(EdgeSchema),
});
export type DraftGraph = z.infer<typeof DraftGraphSchema>;

export const DraftChapterSchema = DraftGraphSchema.extend({
  id: IdSchema,
  name: z.string(),
  order: z.number().int(),
  underConstruction: z.boolean(),
  background: ChapterBackgroundSchema.nullable().default(null),
});
export type DraftChapter = z.infer<typeof DraftChapterSchema>;

/** Villain as stored in the draft: flat attributes, mirroring the `Villain` table. */
export const DraftVillainSchema = z.object({
  id: IdSchema,
  name: z.string(),
  imageUrl: z.string().url().nullable(),
  hp: z.number().int(),
  strength: z.number().int(),
  dexterity: z.number().int(),
  intelligence: z.number().int(),
  defense: z.number().int(),
  attacks: z.array(VillainAttackSchema),
});
export type DraftVillain = z.infer<typeof DraftVillainSchema>;

/** The whole editable campaign, as served by `GET /api/campaigns/:id/draft`. */
export const CampaignDraftSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string(),
  chapters: z.array(DraftChapterSchema),
  villains: z.array(DraftVillainSchema),
  /** Questions are fully validated on write, so the draft holds the snapshot shape. */
  questions: z.array(QuestionSchema),
});
export type CampaignDraft = z.infer<typeof CampaignDraftSchema>;
