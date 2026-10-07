import { z } from 'zod';
import { IdSchema } from './common.js';
import { InvestedAttributesSchema } from './accounts.js';
import { RequirementsSchema, SlotSchema } from './content.js';
import type { EffectType } from './effects.js';

/**
 * The player's own character sheet in a room (Fase 4 plan M3): progression, private gold,
 * derived ceilings and defense, gear and skills. Only ever sent to the profile's owner — gold is
 * private (spec §6).
 */

/** An item as the sheet shows it; `quantity` stacks the inventory's repeated ids. */
export const SheetItemSchema = z.object({
  itemId: IdSchema,
  name: z.string(),
  category: z.enum(['equipment', 'consumable']),
  slot: SlotSchema.nullable(),
  quantity: z.number().int().positive(),
  /** Equipment: the attribute minimums, and whether the character meets them (spec §4.1). */
  requirements: RequirementsSchema,
  meetsRequirements: z.boolean(),
  /** Consumable: its effect type, and whether it works out of battle (plan decision 13). */
  effectType: z.custom<EffectType>((v) => typeof v === 'string').nullable(),
  usableOutOfBattle: z.boolean(),
});
export type SheetItem = z.infer<typeof SheetItemSchema>;

export const ProfileSheetSchema = z.object({
  profileId: IdSchema,
  classId: IdSchema,
  className: z.string(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  /** XP needed to leave the current level; null at the max level. */
  xpToNextLevel: z.number().int().positive().nullable(),
  availablePoints: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  attributes: InvestedAttributesSchema,
  currentHp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  currentEnergy: z.number().int().nonnegative(),
  maxEnergy: z.number().int().nonnegative(),
  /** Equipment defense + strength × 2 + dexterity × 1 (spec §4.1), out of battle. */
  defense: z.number().nonnegative(),
  downed: z.boolean(),
  equipment: z.array(SheetItemSchema),
  inventory: z.array(SheetItemSchema),
  skills: z.array(
    z.object({
      id: IdSchema,
      name: z.string(),
      unlockLevel: z.number().int().positive(),
      unlocked: z.boolean(),
    }),
  ),
});
export type ProfileSheet = z.infer<typeof ProfileSheetSchema>;

/** Points to invest per attribute (Fase 4 plan decision 7); the engine checks the total. */
export const SpendPointsInputSchema = InvestedAttributesSchema;
export type SpendPointsInput = z.infer<typeof SpendPointsInputSchema>;

/** Equips an inventory item in its slot; the slot's previous item goes back (decision 12). */
export const EquipInputSchema = z.object({ itemId: IdSchema });
export type EquipInput = z.infer<typeof EquipInputSchema>;

/** Takes a slot's item back to the inventory; the weapon slot only swaps. */
export const UnequipInputSchema = z.object({ slot: SlotSchema });
export type UnequipInput = z.infer<typeof UnequipInputSchema>;

/**
 * Uses a consumable out of battle (decision 13): heal and energy on the owner; a revive needs the
 * downed profile of the room it lifts (the owner's own included).
 */
export const UseItemInputSchema = z.object({
  itemId: IdSchema,
  targetProfileId: IdSchema.optional(),
});
export type UseItemInput = z.infer<typeof UseItemInputSchema>;
