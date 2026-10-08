import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * Trades between players (spec §6, Fase 4 plan decision 9): one offer says what its author gives
 * and what they ask of the other player, in gold and inventory items; the other accepts or
 * declines, and an accepted offer moves everything at once. Gifts, sales and swaps are all offers,
 * and every one needs the other side's acceptance.
 */

/** One side of an offer: gold and item ids, one per unit. */
export const TradeSideSchema = z.object({
  gold: z.number().int().nonnegative(),
  items: z.array(IdSchema).max(50),
});
export type TradeSide = z.infer<typeof TradeSideSchema>;

export const ProposeTradeInputSchema = z
  .object({ toProfileId: IdSchema, give: TradeSideSchema, ask: TradeSideSchema })
  .refine(
    ({ give, ask }) => give.gold + give.items.length + ask.gold + ask.items.length > 0,
    'An offer must move something',
  );
export type ProposeTradeInput = z.infer<typeof ProposeTradeInputSchema>;

/** A side as shown: item names stacked by id. */
export const TradeSideViewSchema = z.object({
  gold: z.number().int().nonnegative(),
  items: z.array(
    z.object({ itemId: IdSchema, name: z.string(), quantity: z.number().int().positive() }),
  ),
});
export type TradeSideView = z.infer<typeof TradeSideViewSchema>;

/** A pending offer, as its two parties see it. */
export const TradeOfferViewSchema = z.object({
  id: IdSchema,
  from: z.object({ profileId: IdSchema, name: z.string() }),
  to: z.object({ profileId: IdSchema, name: z.string() }),
  give: TradeSideViewSchema,
  ask: TradeSideViewSchema,
  expiresAt: z.string(),
});
export type TradeOfferView = z.infer<typeof TradeOfferViewSchema>;

/** Another member's inventory, so an offer can ask for their items (gold stays private). */
export const MemberInventorySchema = z.array(
  z.object({ itemId: IdSchema, name: z.string(), quantity: z.number().int().positive() }),
);
export type MemberInventory = z.infer<typeof MemberInventorySchema>;
