import type { Rejection, TradeSide } from '@rpg-chains/shared-types';

/** What a trade reads and writes of each party. */
export interface Purse {
  gold: number;
  /** Item ids, one per unit (equipped items are not in it). */
  inventory: string[];
}

/** The inventory without `items` (one occurrence per unit), or null if any unit is missing. */
export function takeUnits(inventory: readonly string[], items: readonly string[]): string[] | null {
  const left = [...inventory];
  for (const itemId of items) {
    const index = left.indexOf(itemId);
    if (index === -1) return null;
    left.splice(index, 1);
  }
  return left;
}

/** Whether a purse still holds everything a side promises. */
export function covers(purse: Purse, side: TradeSide): boolean {
  return purse.gold >= side.gold && takeUnits(purse.inventory, side.items) !== null;
}

/**
 * Both purses after an accepted offer (Fase 4 plan decision 9): the author gives `give` and gets
 * `ask`, all at once — never half. Each side is checked against its purse as it is now; a side
 * that no longer covers its promise refuses the trade. The asked side's failure is reported
 * without amounts, so the author never learns the other's gold (spec §6: gold is private).
 */
export function applyTrade(
  from: Purse,
  to: Purse,
  offer: { give: TradeSide; ask: TradeSide },
): { from: Purse; to: Purse } | Rejection {
  const fromLeft = takeUnits(from.inventory, offer.give.items);
  if (fromLeft === null || from.gold < offer.give.gold) {
    return { ok: false, reason: 'offer_no_longer_covered' };
  }
  const toLeft = takeUnits(to.inventory, offer.ask.items);
  if (toLeft === null || to.gold < offer.ask.gold) {
    return { ok: false, reason: 'ask_not_covered' };
  }
  return {
    from: {
      gold: from.gold - offer.give.gold + offer.ask.gold,
      inventory: [...fromLeft, ...offer.ask.items],
    },
    to: {
      gold: to.gold - offer.ask.gold + offer.give.gold,
      inventory: [...toLeft, ...offer.give.items],
    },
  };
}
