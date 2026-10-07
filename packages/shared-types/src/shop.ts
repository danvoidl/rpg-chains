import { z } from 'zod';
import { IdSchema } from './common.js';
import { RequirementsSchema, SlotSchema } from './content.js';

/**
 * Shops (spec §6, Fase 4 plan decision 11): each player buys with their own gold, no vote, no
 * stock limit, at the price of the room's current version.
 */

/** A shop node of the room's version (provisional list until the map, like `battleNodes`). */
export const ShopNodeOptionSchema = z.object({
  nodeId: IdSchema,
  title: z.string(),
  chapterName: z.string(),
});
export type ShopNodeOption = z.infer<typeof ShopNodeOptionSchema>;

export const ShopItemSchema = z.object({
  itemId: IdSchema,
  name: z.string(),
  category: z.enum(['equipment', 'consumable']),
  slot: SlotSchema.nullable(),
  price: z.number().int().nonnegative(),
  requirements: RequirementsSchema,
  defenseBonus: z.number().nonnegative(),
});
export type ShopItem = z.infer<typeof ShopItemSchema>;

/** What a player sees in a shop: its wares and their own gold (private, spec §6). */
export const ShopViewSchema = z.object({
  nodeId: IdSchema,
  title: z.string(),
  gold: z.number().int().nonnegative(),
  items: z.array(ShopItemSchema),
});
export type ShopView = z.infer<typeof ShopViewSchema>;

export const BuyInputSchema = z.object({
  itemId: IdSchema,
  quantity: z.number().int().positive().max(99),
});
export type BuyInput = z.infer<typeof BuyInputSchema>;
