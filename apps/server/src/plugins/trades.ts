import fp from 'fastify-plugin';
import { TradeOffers } from '../services/trade-offers.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Pending trade offers between players (spec §6: memory only). */
    trades: TradeOffers;
  }
}

export interface TradesPluginOptions {
  timeoutMs: number;
}

/** The trade offer registry. Registered after `realtime`: an expiry signals the room's lobby. */
export default fp<TradesPluginOptions>(async (app, options) => {
  const trades = new TradeOffers(options.timeoutMs, (roomId) => app.roomEvents.changed(roomId));
  app.decorate('trades', trades);
  app.addHook('preClose', async () => trades.clear());
});
