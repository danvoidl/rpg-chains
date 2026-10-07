import { z } from 'zod';
import { MAX_DROP_CHANCE, MAX_SKILLS_PER_CLASS } from '@rpg-chains/game-config';
import { IdSchema, AttributeSchema } from './common.js';
import { EffectSchema } from './effects.js';

/** Minimum attribute requirements to equip an item; one or two attributes (spec §4.1). */
export const RequirementsSchema = z.object({
  strength: z.number().int().nonnegative().optional(),
  dexterity: z.number().int().nonnegative().optional(),
  intelligence: z.number().int().nonnegative().optional(),
});

/* ------------------------------------------------------------------ items ---- */

/** Shop price in gold (spec §6). Additive with a default, so older snapshots stay valid. */
const Price = z.number().int().nonnegative().default(0);

export const SlotSchema = z.enum(['weapon', 'helmet', 'chest', 'boots', 'bracers', 'rings']);
export type Slot = z.infer<typeof SlotSchema>;

export const WeaponTypeSchema = z.enum(['light', 'heavy']);
export type WeaponType = z.infer<typeof WeaponTypeSchema>;

export const ItemEquipmentSchema = z.object({
  category: z.literal('equipment'),
  id: IdSchema,
  name: z.string().min(1),
  slot: SlotSchema,
  price: Price,
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

export const ItemConsumableSchema = z.object({
  category: z.literal('consumable'),
  id: IdSchema,
  name: z.string().min(1),
  price: Price,
  effect: EffectSchema,
});

/**
 * Weapon stats are required for slot "weapon" and forbidden otherwise. Applied on the union
 * (a refined member cannot sit inside z.discriminatedUnion); shared with the item write payload.
 */
export function refineWeaponStats(
  item: { category: 'equipment'; slot: Slot; weapon?: unknown } | { category: 'consumable' },
  ctx: z.RefinementCtx,
): void {
  if (item.category === 'equipment' && (item.slot === 'weapon') !== (item.weapon != null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Weapon stats are required for slot "weapon" and forbidden otherwise',
      path: ['weapon'],
    });
  }
}

// All items are "normal" rarity (spec §6).
export const ItemSchema = z
  .discriminatedUnion('category', [ItemEquipmentSchema, ItemConsumableSchema])
  .superRefine(refineWeaponStats);
export type Item = z.infer<typeof ItemSchema>;

/* -------------------------------------------------------------- questions ---- */

/** Combat challenge (spec §3.2). Objective = auto-validated; open = master-judged. */
export const QuestionSchema = z
  .discriminatedUnion('type', [
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

/**
 * An item a villain may drop, with its chance as a fraction of 1 (spec §6). Never certain: capped
 * at `MAX_DROP_CHANCE`, which also holds after the relevance multiplier (spec §4.5).
 */
export const VillainDropSchema = z.object({
  itemId: IdSchema,
  chance: z.number().positive().max(MAX_DROP_CHANCE),
});
export type VillainDrop = z.infer<typeof VillainDropSchema>;

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
  /**
   * What defeating one instance is worth to each participant before the relevance multiplier
   * (spec §6). Additive with defaults, so older snapshots stay valid and give no reward.
   */
  xpReward: z.number().int().nonnegative().default(0),
  goldReward: z.number().int().nonnegative().default(0),
  drops: z.array(VillainDropSchema).default([]),
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
  skills: z.array(SkillSchema).max(MAX_SKILLS_PER_CLASS),
});
export type CharacterClass = z.infer<typeof CharacterClassSchema>;

/* ------------------------------------------------------------------ nodes ---- */

/**
 * Node position in chapter "world" coordinates: absolute pixels, origin at the top-left. When a
 * chapter has a background map, these are pixels of that map (see `ChapterBackgroundSchema`), so
 * positions must never be normalized or auto-laid-out.
 */
const Position = z.object({ x: z.number(), y: z.number() });

/** Author-facing node name, shown in the editor and the player map. Empty = derived label. */
const NodeTitle = z.string().default('');

/**
 * Optional map image behind a chapter graph (not rendered yet — prepared contract). `width` and
 * `height` define the logical world size the image is scaled to, so replacing the image with a
 * different resolution never moves the nodes placed on it.
 */
export const ChapterBackgroundSchema = z.object({
  imageUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type ChapterBackground = z.infer<typeof ChapterBackgroundSchema>;

/** Graph node in a chapter (spec §2.3). Discriminated by `type`. */
export const ChapterNodeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('battle'),
    id: IdSchema,
    title: NodeTitle,
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
    title: NodeTitle,
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
    title: NodeTitle,
    prerequisites: z.array(IdSchema).default([]),
    mandatory: z.boolean(),
    position: Position,
    itemIds: z.array(IdSchema).default([]),
  }),
  z.object({
    type: z.literal('campfire'),
    id: IdSchema,
    title: NodeTitle,
    prerequisites: z.array(IdSchema).default([]),
    mandatory: z.boolean(),
    position: Position,
  }),
  z.object({
    type: z.literal('narrative'),
    id: IdSchema,
    title: NodeTitle,
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
  background: ChapterBackgroundSchema.optional(),
  nodes: z.array(ChapterNodeSchema),
  edges: z.array(EdgeSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;
