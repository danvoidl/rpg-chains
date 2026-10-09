import fp from 'fastify-plugin';
import { syncMasterPresence } from '../realtime/master-presence.js';
import { BattleJournal } from '../services/battle-journal.js';
import { BattleRegistry } from '../services/battle-registry.js';
import { BattleResolution } from '../services/battle-resolution.js';
import { BattleTimers, type BattleTimerConfig } from '../services/battle-timers.js';
import { restoreBattles } from '../services/battle-restore.js';
import { GraceTimers } from '../services/grace-timers.js';

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
    /** Reconnection grace of battle participants and room masters (spec §7). */
    grace: GraceTimers;
    /** The copy of running battles that survives a restart; `settled()` awaits its writes. */
    battleJournal: BattleJournal;
  }
}

export interface BattlesPluginOptions {
  timers: BattleTimerConfig;
  seed: () => number;
  /** How long a dropped player or master has to come back (`RECONNECT_GRACE_MS`). */
  reconnectGraceMs: number;
  /** Bring the journaled battles back when the app is ready (off in most tests). */
  restore: boolean;
}

/**
 * The battle registry and what hangs off it: turn timers, the journal, the end-of-battle
 * write-back, the reconnection grace, and bringing journaled battles back on boot. Must be
 * registered before `realtime`, whose battle channel subscribes to the registry — and whose
 * shutdown hook (disconnecting every socket) must find the battles already gone, or a restart
 * would write every player back as having left.
 */
export default fp<BattlesPluginOptions>(async (app, options) => {
  const registry = new BattleRegistry();
  const timers = new BattleTimers(registry, options.timers);
  // Before the resolution: the write-back waits for the journal to hold the resolving batch.
  const journal = new BattleJournal(registry, app.prisma, (error) =>
    app.log.error(error, 'battle journal write failed'),
  );
  const resolution = new BattleResolution(
    registry,
    journal,
    app.prisma,
    (roomId) => app.roomEvents.changed(roomId),
    (error) => app.log.error(error, 'battle write-back failed'),
  );

  app.decorate('battles', registry);
  app.decorate('battleResolution', resolution);
  app.decorate('battleSeed', options.seed);
  app.decorate('battleTimers', timers);
  const grace = new GraceTimers(options.reconnectGraceMs);
  registry.subscribe({ removed: (battle) => grace.cancelPrefix(`${battle.battleId}:`) });
  app.decorate('grace', grace);

  app.decorate('battleJournal', journal);

  if (options.restore) {
    // On ready, every plugin (the lobby presence included) is in place.
    app.addHook('onReady', () => restoreBattles(app, (roomId) => syncMasterPresence(app, roomId)));
  }

  // A shutdown keeps the journals: the battles come back on the next boot (spec §3.7).
  app.addHook('preClose', async () => {
    timers.clearAll();
    grace.clearAll();
    await resolution.settled();
    await journal.settled();
    registry.clear();
  });
});
