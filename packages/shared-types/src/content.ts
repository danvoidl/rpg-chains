import { z } from 'zod';
import { IdSchema, AttributeSchema } from './common.js';
import { EffectSchema } from './effects.js';

/** Minimum attribute requirements to equip an item; one or two attributes (spec §4.1). */
const RequirementsSchema = z.object({
  strength: z.number().int().nonnegative().optional(),
  dexterity: z.number().int().nonnegative().optional(),
  intelligence: z.number().int().nonnegative().optional(),
});

/* ------------------------------------------------------------------ items ---- */

export const SlotSchema = z.enum(['weapon', 'helmet', 'chest', 'boots', 'bracers', 'rings']);
export type Slot = z.infer<typeof SlotSchema>;

export const WeaponTypeSchema = z.enum(['light', 'heavy']);
export type WeaponType = z.infer<typeof WeaponTypeSchema>;

const ItemEquipmentSchema = z.object({
  category: z.literal('equipment'),
  id: IdSchema,
  name: z.string().min(1),
  slot: SlotSchema,
  requirements: RequirementsSchema.default({}),
  defenseBonus: z.number().nonnegative().default(0),
  weapon: z
    .object({
      weaponType: WeaponTypeSchema,
      baseDamage: z.number().nonnegative(),
      scalingAttribute: AttributeSchema,
      scale: z.number().nonnegative(),
    })
    .optional(),
});

const ItemConsumableSchema = z.object({
  category: z.literal('consumable'),
  id: IdSchema,
  name: z.string().min(1),
  effect: EffectSchema,
});

// Weapon stats are required for slot "weapon" and forbidden otherwise. Applied on the union
// (a refined member cannot sit inside z.discriminatedUnion). All items are "normal" rarity (spec §6).
export const ItemSchema = z
  .discriminatedUnion('category', [ItemEquipmentSchema, ItemConsumableSchema])
  .superRefine((item, ctx) => {
    if (item.category === 'equipment' && (item.slot === 'weapon') !== (item.weapon !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Weapon stats are required for slot "weapon" and forbidden otherwise',
        path: ['weapon'],
      });
    }
  });
export type Item = z.infer<typeof ItemSchema>;

/* -------------------------------------------------------------- questions ---- */

/** Combat challenge (spec §3.2). Objective = auto-validated; open = master-judged. */
export const QuestionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('objective'),
    id: IdSchema,
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('open'),
    id: IdSchema,
    prompt: z.string().min(1),
  }),
]);
export type Question = z.infer<typeof QuestionSchema>;

/* ---------------------------------------------------------------- villain ---- */

export const VillainAttackSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  baseDamage: z.number().nonnegative(),
  targetType: z.enum(['single', 'area']),
  cooldownRounds: z.number().int().nonnegative(),
});
export type VillainAttack = z.infer<typeof VillainAttackSchema>;

export const VillainSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  imageUrl: z.string().url().optional(),
  hp: z.number().positive(),
  attributes: z.object({
    strength: z.number().int().nonnegative(),
    dexterity: z.number().int().nonnegative(),
    intelligence: z.number().int().nonnegative(),
    defense: z.number().nonnegative(),
  }),
  attacks: z.array(VillainAttackSchema).min(1),
});
export type Villain = z.infer<typeof VillainSchema>;

/* -------------------------------------------------- class & abilities ---- */

/** A skill: cosmetic shell + gameplay envelope + one generic effect (spec §5.3). */
export const SkillSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  iconUrl: z.string().url().optional(),
  text: z.string().default(''),
  energyCost: z.number().int().nonnegative(),
  cooldownRounds: z.number().int().nonnegative(),
  unlockLevel: z.number().int().positive(),
  effect: EffectSchema,
});
export type Skill = z.infer<typeof SkillSchema>;

export const CharacterClassSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  artUrl: z.string().url().optional(),
  baseHp: z.number().positive(),
  baseEnergy: z.number().positive(),
  hpPerLevel: z.number().nonnegative(),
  energyPerLevel: z.number().nonnegative(),
  /** Max profiles that may pick this class in a room (spec §5.2). */
  maxSlots: z.number().int().positive(),
  /** Base weapon a fresh profile starts with (spec §6). */
  baseWeaponId: IdSchema,
  skills: z.array(SkillSchema).max(4),
});
export type CharacterClass = z.infer<typeof CharacterClassSchema>;

/* ------------------------------------------------------------------ nodes ---- */

const Position = z.object({ x: z.number(), y: z.number() });

/** Graph node in a chapter (spec §2.3). Discriminated by `type`. */
export const ChapterNodeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('battle'),
    id: IdSchema,
    prerequisites: z.array(IdSchema).default([]),
    mandatory: z.boolean(),
    recommendedLevel: z.number().int().positive(),
    participantLimit: z.number().int().positive(),
    position: Position,
    villainIds: z.array(IdSchema).min(1),
    questionIds: z.array(IdSchema).default([]),
  }),
  z.object({
    type: z.literal('boss'),
    id: IdSchema,
    prerequisites: z.array(IdSchema).default([]),
    mandatory: z.literal(true),
    recommendedLevel: z.number().int().positive(),
    position: Position,
    villainIds: z.array(IdSchema).min(1),
    questionIds: z.array(IdSchema).default([]),
  }),
  z.object({
    type: z.literal('shop'),
    id: IdSchema,
    prerequisites: z.array(IdSchema).default([]),
    mandatory: z.boolean(),
    position: Position,
    itemIds: z.array(IdSchema).default([]),
  }),
  z.object({
    type: z.literal('campfire'),
    id: IdSchema,
    prerequisites: z.array(IdSchema).default([]),
    mandatory: z.boolean(),
    position: Position,
  }),
  z.object({
    type: z.literal('narrative'),
    id: IdSchema,
    prerequisites: z.array(IdSchema).default([]),
    mandatory: z.boolean(),
    position: Position,
    text: z.string().default(''),
    videoUrl: z.string().url().optional(),
  }),
]);
export type ChapterNode = z.infer<typeof ChapterNodeSchema>;
export type ChapterNodeType = ChapterNode['type'];

/** Directed edge between two nodes in the chapter graph (spec §2.3). */
export const EdgeSchema = z.object({ from: IdSchema, to: IdSchema });
export type Edge = z.infer<typeof EdgeSchema>;

export const ChapterSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** "under construction" chapters stay in the draft and never enter a snapshot (spec §2.2). */
  underConstruction: z.boolean().default(false),
  entryNodeId: IdSchema,
  bossNodeId: IdSchema,
  nodes: z.array(ChapterNodeSchema),
  edges: z.array(EdgeSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;
