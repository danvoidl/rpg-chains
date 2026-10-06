import { z } from 'zod';
import { MAX_LEVEL, MAX_SKILLS_PER_CLASS } from '@rpg-chains/game-config';
import { IdSchema } from './common.js';
import {
  ChapterBackgroundSchema,
  ItemConsumableSchema,
  ItemEquipmentSchema,
  VillainAttackSchema,
  refineWeaponStats,
} from './content.js';
import { EffectSchema } from './effects.js';

/**
 * Write payloads of the authoring REST API (Fase 1). Server routes validate request bodies
 * with these and the editor's forms reuse them via `zodResolver`, so both sides agree on
 * what a valid write is. Omitted optional fields on create fall back to the DB defaults.
 */

export const CampaignInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
});
export type CampaignInput = z.infer<typeof CampaignInputSchema>;

export const CampaignPatchSchema = CampaignInputSchema.partial();
export type CampaignPatch = z.infer<typeof CampaignPatchSchema>;

const ChapterFieldsSchema = z.object({
  name: z.string().trim().min(1),
  order: z.number().int().nonnegative(),
  underConstruction: z.boolean(),
  /** Map image behind the graph; `null` removes it. */
  background: ChapterBackgroundSchema.nullable(),
});

export const ChapterInputSchema = ChapterFieldsSchema.partial({
  order: true,
  underConstruction: true,
  background: true,
});
export type ChapterInput = z.infer<typeof ChapterInputSchema>;

export const ChapterPatchSchema = ChapterFieldsSchema.partial();
export type ChapterPatch = z.infer<typeof ChapterPatchSchema>;

/** New attacks may omit `id`; the server assigns one so it stays stable across versions. */
export const VillainAttackInputSchema = VillainAttackSchema.extend({ id: IdSchema.optional() });
export type VillainAttackInput = z.infer<typeof VillainAttackInputSchema>;

/** Full villain write (create and replace). Empty `attacks` is saveable; publish requires one. */
export const VillainInputSchema = z.object({
  name: z.string().trim().min(1),
  imageUrl: z.string().url().nullable().optional(),
  hp: z.number().int().positive(),
  strength: z.number().int().nonnegative(),
  dexterity: z.number().int().nonnegative(),
  intelligence: z.number().int().nonnegative(),
  defense: z.number().int().nonnegative(),
  attacks: z.array(VillainAttackInputSchema).optional(),
});
export type VillainInput = z.infer<typeof VillainInputSchema>;

/**
 * Full question write (create and replace). Objective needs ≥2 options and a `correctIndex`
 * inside them; open has no options (spec §3.2).
 */
export const QuestionInputSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('objective'),
      prompt: z.string().trim().min(1),
      options: z.array(z.string().trim().min(1)).min(2),
      correctIndex: z.number().int().nonnegative(),
    }),
    z.object({ type: z.literal('open'), prompt: z.string().trim().min(1) }),
  ])
  .superRefine((question, ctx) => {
    if (question.type === 'objective' && question.correctIndex >= question.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctIndex must point to one of the options',
        path: ['correctIndex'],
      });
    }
  });
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

/** Full item write (create and replace); same shape as the snapshot item, without the id. */
export const ItemInputSchema = z
  .discriminatedUnion('category', [
    ItemEquipmentSchema.omit({ id: true }).extend({
      name: z.string().trim().min(1),
      defenseBonus: z.number().int().nonnegative().default(0),
    }),
    ItemConsumableSchema.omit({ id: true }).extend({ name: z.string().trim().min(1) }),
  ])
  .superRefine(refineWeaponStats);
export type ItemInput = z.infer<typeof ItemInputSchema>;

/**
 * A skill inside a class write. Existing skills carry their `id` so it stays stable across saves
 * (the compatibility gate compares by id); new ones omit it. Shape only — balancing rules
 * (targets, caps, bands) belong to the publish gate, so an unbalanced skill is still saveable.
 */
export const SkillInputSchema = z.object({
  id: IdSchema.optional(),
  name: z.string().trim().min(1),
  iconUrl: z.string().url().nullable().optional(),
  text: z.string().optional(),
  energyCost: z.number().int().nonnegative(),
  cooldownRounds: z.number().int().nonnegative(),
  unlockLevel: z.number().int().positive().max(MAX_LEVEL),
  effect: EffectSchema,
});
export type SkillInput = z.infer<typeof SkillInputSchema>;

/** Full class write (create and replace), skills included. A missing base weapon is saveable. */
export const ClassInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  artUrl: z.string().url().nullable().optional(),
  baseHp: z.number().int().positive(),
  baseEnergy: z.number().int().positive(),
  hpPerLevel: z.number().int().nonnegative(),
  energyPerLevel: z.number().int().nonnegative(),
  maxSlots: z.number().int().positive(),
  baseWeaponId: IdSchema.nullable().optional(),
  skills: z.array(SkillInputSchema).max(MAX_SKILLS_PER_CLASS).optional(),
});
export type ClassInput = z.infer<typeof ClassInputSchema>;
