import { z } from 'zod';
import { IdSchema } from './common.js';
import { ChapterBackgroundSchema, ChapterOpeningSchema } from './content.js';
import { NodeTypeSchema } from './draft.js';

/**
 * Where a room stands in its campaign (spec §2.3, Fase 5 plan decisions 1–2): the read model
 * the trail renders. Progress belongs to the room; only "cleared" is a stored fact, "unlocked" is
 * always derived from the facts by `campaign-rules`.
 */

export const NodeStateSchema = z.enum(['locked', 'unlocked', 'cleared']);
export type NodeState = z.infer<typeof NodeStateSchema>;

/** `current` is the chapter the room is playing; a cleared chapter stays open (decision 6). */
export const ChapterStateSchema = z.enum(['locked', 'current', 'cleared']);
export type ChapterState = z.infer<typeof ChapterStateSchema>;

export const NodeProgressViewSchema = z.object({
  nodeId: IdSchema,
  type: NodeTypeSchema,
  title: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  mandatory: z.boolean(),
  state: NodeStateSchema,
  /** Battles and the boss only. */
  recommendedLevel: z.number().int().positive().nullable(),
  /** Battles only; null for the boss (no limit) and the other types. */
  participantLimit: z.number().int().positive().nullable(),
  /** The node has open questions: the master judges, and must be online to start. */
  needsMaster: z.boolean(),
  /** The battle forming or running on this node, if any (overlaid by the server). */
  battleId: IdSchema.nullable(),
});
export type NodeProgressView = z.infer<typeof NodeProgressViewSchema>;

export const ChapterProgressViewSchema = z.object({
  chapterId: IdSchema,
  name: z.string(),
  state: ChapterStateSchema,
  opening: ChapterOpeningSchema.nullable(),
  background: ChapterBackgroundSchema.nullable(),
  /** The campfire a defeat in this chapter returns to; null = the chapter entry (decision 5). */
  campfireNodeId: IdSchema.nullable(),
  nodes: z.array(NodeProgressViewSchema),
});
export type ChapterProgressView = z.infer<typeof ChapterProgressViewSchema>;

/** The whole trail: published chapters in order, then the ones under construction (decision 18). */
export const CampaignProgressViewSchema = z.object({
  chapters: z.array(ChapterProgressViewSchema),
  upcomingChapters: z.array(z.object({ id: IdSchema, name: z.string() })),
  /** The boss of the last published chapter has been beaten (spec §7). */
  completed: z.boolean(),
});
export type CampaignProgressView = z.infer<typeof CampaignProgressViewSchema>;

/** A narrative node as its reader sees it (Fase 5 plan decision 12): read alone, cleared by anyone. */
export const NarrativeViewSchema = z.object({
  nodeId: IdSchema,
  title: z.string(),
  text: z.string(),
  videoUrl: z.string().nullable(),
  /** Someone in the room already continued past it. */
  cleared: z.boolean(),
});
export type NarrativeView = z.infer<typeof NarrativeViewSchema>;
