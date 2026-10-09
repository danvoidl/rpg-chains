import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { decide, emptyBattle, replay } from '@rpg-chains/battle-engine';
import { BATTLE_EVENTS, type BattleEvent, type BattleSummary } from '@rpg-chains/shared-types';
import { createTestApp, resetDatabase, signUp, TEST_GRACE_MS, type TestUser } from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { nextCommand, playBattleToEnd, runningState } from './battle-play.js';
import { chooseClass, createRoom } from './room-fixtures.js';
import { SocketPool } from './socket-client.js';

/**
 * Battles survive a server restart (spec §3.7, Fase 6 plan decision 6): the journal holds every
 * batch, a new process on the same database brings the battle back paused with everyone away, and
 * the group finishes it. Nobody coming back cancels it at no cost; a battle that had resolved but
 * was not written back is written back once.
 */

const apps: FastifyInstance[] = [];
const pool = new SocketPool();

afterEach(async () => {
  pool.closeAll();
  for (const app of apps.splice(0)) await app.close();
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A process of the server; `restore` brings the journaled battles back on ready. */
async function boot(restore: boolean): Promise<FastifyInstance> {
  const app = await createTestApp({ battles: { seed: () => 7, restore } });
  apps.push(app);
  return app;
}

/**
 * A crash right after the journal caught up: memory is gone, nothing is written back, and the
 * journal is what a new process will find.
 */
async function crash(app: FastifyInstance): Promise<void> {
  await app.battleJournal.settled();
  app.battles.clear();
  app.grace.clearAll();
  apps.splice(apps.indexOf(app), 1);
  await app.close();
}

interface Fight {
  battleId: string;
  roomId: string;
  ana: TestUser;
  bia: TestUser;
}

/** A running objective battle on `n-rat` with Ana and Bia, a few turns in. */
async function fight(app: FastifyInstance, turns = 3): Promise<Fight> {
  await resetDatabase(app);
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const bia = await signUp(app, 'Bia');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  await chooseClass(app, bia, roomId, 'cl-solo');
  const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
  await battleAction(app, bia, battleId, 'participants');
  expect((await battleAction(app, ana, battleId, 'start')).statusCode).toBe(200);
  for (let i = 0; i < turns; i++) {
    expect(app.battles.apply(battleId, nextCommand(runningState(app, battleId)))).toEqual({
      ok: true,
    });
  }
  return { battleId, roomId, ana, bia };
}

const logOf = (app: FastifyInstance, battleId: string): BattleEvent[] => {
  const battle = app.battles.get(battleId);
  if (battle?.status !== 'running') throw new Error('not running');
  return battle.log;
};

describe('a server restart (spec §3.7)', () => {
  it('a shutdown keeps the battle; the next process brings it back paused, and the group finishes it', async () => {
    const first = await boot(false);
    const f = await fight(first);
    const before = [...logOf(first, f.battleId)];
    apps.splice(apps.indexOf(first), 1);
    await first.close();

    const second = await boot(true);
    const restored = runningState(second, f.battleId);
    const log = logOf(second, f.battleId);
    expect(log.slice(0, before.length)).toEqual(before);
    // Everyone is away, so the battle waits for them.
    expect(log.slice(before.length).map((e) => e.type)).toContain('PlayerDisconnected');
    expect(restored.combatants.every((c) => !c.connected)).toBe(true);
    expect(restored.turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });

    await pool.listen(second);
    const ana = await pool.connect(f.ana);
    await ana.emitWithAck(BATTLE_EVENTS.join, { battleId: f.battleId });
    expect(runningState(second, f.battleId).turn.stage).toBe('awaiting_signal');

    const final = playBattleToEnd(second, f.battleId);
    expect(final.result).toBe('victory');
    expect(replay(emptyBattle(f.battleId), logOf(second, f.battleId))).toEqual(final);
    await second.battleResolution.settled();
    await second.battleJournal.settled();
    expect(await second.prisma.battleJournal.count()).toBe(0);
    // The victory was written back: the node is cleared for the room.
    expect(await second.prisma.roomNodeClear.count({ where: { nodeId: 'n-rat' } })).toBe(1);
  });

  it('a crash loses at most the batch in flight; nobody back in time cancels the battle at no cost', async () => {
    const first = await boot(false);
    const f = await fight(first);
    const before = [...logOf(first, f.battleId)];
    const goldBefore = await first.prisma.campaignProfile.findMany({
      select: { id: true, gold: true },
    });
    // The last batch never reached the database.
    await first.battleJournal.settled();
    const last = await first.prisma.battleJournalEntry.findFirstOrThrow({
      where: { battleId: f.battleId },
      orderBy: { fromSeq: 'desc' },
    });
    await first.prisma.battleJournalEntry.delete({
      where: { battleId_fromSeq: { battleId: f.battleId, fromSeq: last.fromSeq } },
    });
    await crash(first);

    const second = await boot(true);
    expect(logOf(second, f.battleId).slice(0, last.fromSeq - 1)).toEqual(
      before.slice(0, last.fromSeq - 1),
    );
    await wait(TEST_GRACE_MS + 50);
    await second.battleJournal.settled();
    expect(second.battles.get(f.battleId)).toBeUndefined();
    expect(await second.prisma.battleJournal.count()).toBe(0);
    expect(await second.prisma.roomNodeClear.count({ where: { nodeId: 'n-rat' } })).toBe(0);
    const goldAfter = await second.prisma.campaignProfile.findMany({
      select: { id: true, gold: true },
    });
    expect(goldAfter).toEqual(expect.arrayContaining(goldBefore));
  });

  it('a battle that resolved but was not written back is written back on boot, once', async () => {
    const first = await boot(false);
    const f = await fight(first, 0);
    // Play up to the command that would end it, and journal its events without folding them.
    let resolving: BattleEvent[] | null = null;
    while (!resolving) {
      const battle = first.battles.get(f.battleId);
      if (battle?.status !== 'running') throw new Error('not running');
      const command = nextCommand(battle.state);
      const result = decide(battle.state, command, battle.content);
      if (!result.ok) throw new Error(result.reason);
      if (result.events.some((e) => e.type === 'BattleResolved')) resolving = result.events;
      else expect(first.battles.apply(f.battleId, command)).toEqual({ ok: true });
    }
    await first.battleJournal.settled();
    await first.prisma.battleJournalEntry.create({
      data: {
        battleId: f.battleId,
        fromSeq: logOf(first, f.battleId).length + 1,
        events: resolving,
      },
    });
    await crash(first);

    const second = await boot(true);
    await second.battleResolution.settled();
    await second.battleJournal.settled();
    expect(second.battles.get(f.battleId)).toBeUndefined();
    expect(await second.prisma.battleJournal.count()).toBe(0);
    // Written back: the node is cleared and the fighters' state is the battle's end.
    const cleared = () => second.prisma.roomNodeClear.findMany({ where: { nodeId: 'n-rat' } });
    expect(await cleared()).toHaveLength(1);
    const profiles = () =>
      second.prisma.campaignProfile.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, currentHp: true, currentEnergy: true },
      });
    const written = await profiles();

    // A third boot finds nothing to restore: nothing is written twice.
    apps.splice(apps.indexOf(second), 1);
    await second.close();
    const third = await boot(true);
    await third.battleResolution.settled();
    expect(third.battles.get(f.battleId)).toBeUndefined();
    expect(
      await third.prisma.campaignProfile.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, currentHp: true, currentEnergy: true },
      }),
    ).toEqual(written);
    expect(await third.prisma.roomNodeClear.count({ where: { nodeId: 'n-rat' } })).toBe(1);
  });
});
