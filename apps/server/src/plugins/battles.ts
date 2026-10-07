import fp from 'fastify-plugin';
import { BattleRegistry } from '../services/battle-registry.js';
import { BattleResolution } from '../services/battle-resolution.js';
import { BattleTimers, type BattleTimerConfig } from '../services/battle-timers.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Every battle of the process, forming or running (spec §3.7: memory only). */
    battles: BattleRegistry;
    /** Profile write-backs of resolved battles; `settled()` awaits the ones in flight. */
    battleResolution: BattleResolution;
    /** Draws the seed of a new battle. */
    battleSeed: () => number;
    /** Turn clocks; `clockOf` tells clients how long the current stage has left. */
    battleTimers: BattleTimers;
  }
}

export interface BattlesPluginOptions {
  timers: BattleTimerConfig;
  seed: () => number;
}

/**
 * The battle registry and what hangs off it: turn timers and the end-of-battle write-back. Must be
 * registered before `realtime`, whose battle channel subscribes to the registry — and whose
 * shutdown hook (disconnecting every socket) must find the battles already gone, or a restart
 * would write every player back as having left.
 */
export default fp<BattlesPluginOptions>(async (app, options) => {
  const registry = new BattleRegistry();
  const timers = new BattleTimers(registry, options.timers);
  const resolution = new BattleResolution(
    registry,
    app.prisma,
    (roomId) => app.roomEvents.changed(roomId),
    (error) => app.log.error(error, 'battle write-back failed'),
  );

  app.decorate('battles', registry);
  app.decorate('battleResolution', resolution);
  app.decorate('battleSeed', options.seed);
  app.decorate('battleTimers', timers);

  app.addHook('preClose', async () => {
    timers.clearAll();
    await resolution.settled();
    registry.clear();
  });
});
