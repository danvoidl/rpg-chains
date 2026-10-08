import { describe, expect, it } from 'vitest';
import { applyTrade, type Purse } from './trade.js';

const ana: Purse = { gold: 50, inventory: ['it-potion', 'it-helmet', 'it-potion'] };
const bia: Purse = { gold: 20, inventory: ['it-sword'] };
const nothing = { gold: 0, items: [] };

describe('applyTrade (Fase 4 plan decision 9)', () => {
  it('a gift moves one way', () => {
    expect(
      applyTrade(ana, bia, { give: { gold: 10, items: ['it-potion'] }, ask: nothing }),
    ).toEqual({
      from: { gold: 40, inventory: ['it-helmet', 'it-potion'] },
      to: { gold: 30, inventory: ['it-sword', 'it-potion'] },
    });
  });

  it('a sale swaps an item for gold, and a trade item for item', () => {
    expect(
      applyTrade(ana, bia, {
        give: { gold: 0, items: ['it-helmet'] },
        ask: { gold: 15, items: [] },
      }),
    ).toEqual({
      from: { gold: 65, inventory: ['it-potion', 'it-potion'] },
      to: { gold: 5, inventory: ['it-sword', 'it-helmet'] },
    });
    expect(
      applyTrade(ana, bia, {
        give: { gold: 0, items: ['it-potion', 'it-potion'] },
        ask: { gold: 0, items: ['it-sword'] },
      }),
    ).toEqual({
      from: { gold: 50, inventory: ['it-helmet', 'it-sword'] },
      to: { gold: 20, inventory: ['it-potion', 'it-potion'] },
    });
  });

  it('refuses whole when either side no longer covers its promise', () => {
    expect(applyTrade(ana, bia, { give: { gold: 51, items: [] }, ask: nothing })).toEqual({
      ok: false,
      reason: 'offer_no_longer_covered',
    });
    expect(
      applyTrade(ana, bia, {
        give: { gold: 0, items: ['it-potion', 'it-potion', 'it-potion'] },
        ask: nothing,
      }),
    ).toEqual({ ok: false, reason: 'offer_no_longer_covered' });
    expect(applyTrade(ana, bia, { give: nothing, ask: { gold: 21, items: [] } })).toEqual({
      ok: false,
      reason: 'ask_not_covered',
    });
    expect(applyTrade(ana, bia, { give: nothing, ask: { gold: 0, items: ['it-helmet'] } })).toEqual(
      {
        ok: false,
        reason: 'ask_not_covered',
      },
    );
  });
});
