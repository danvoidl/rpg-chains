import fp from 'fastify-plugin';
import { TradeOfferStore } from '../services/trade-offer-store.js';
import { TradeOffers } from '../services/trade-offers.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Pending trade offers between players (spec §6), mirrored to the database. */
    trades: TradeOffers;
    /** The database copy of the offers; `settled()` awaits its writes. */
    tradeStore: TradeOfferStore;
  }
}

export interface TradesPluginOptions {
  timeoutMs: number;
  /** Bring the stored offers back when the app is ready (off in most tests). */
  restore: boolean;
}

/**
 * The trade offer registry. Registered after `realtime`: an expiry signals the room's lobby. A
 * shutdown keeps the stored offers; the next boot restores them (Fase 6 plan decision 9).
 */
export default fp<TradesPluginOptions>(async (app, options) => {
  const store = new TradeOfferStore(app.prisma, (error) =>
    app.log.error(error, 'trade offer write failed'),
  );
  const trades = new TradeOffers(
    options.timeoutMs,
    (roomId) => app.roomEvents.changed(roomId),
    store,
  );
  app.decorate('trades', trades);
  app.decorate('tradeStore', store);
  if (options.restore) {
    app.addHook('onReady', async () => trades.restore(await store.load()));
  }
  app.addHook('preClose', async () => {
    trades.clear();
    await store.settled();
  });
});
