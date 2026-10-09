import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  BATTLE_EVENTS,
  ROOM_EVENTS,
  type BattleClosedMessage,
  type BattleSummary,
} from '@rpg-chains/shared-types';
import {
  createTestApp,
  requestAs,
  resetDatabase,
  signUp,
  TEST_GRACE_MS,
  type TestUser,
} from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { nextCommand, runningState } from './battle-play.js';
import { chooseClass, createRoom } from './room-fixtures.js';
import { next, SocketPool } from './socket-client.js';

/**
 * Restarting and cancelling a running battle (spec §7, Fase 6 plan decisions 7 and 8): the master
 * restarts it as a fresh formation of everyone still in it; cancelling is his too, and without him
 * the players must all ask — so cancelling is never a way out of a defeat.
 */

let app: FastifyInstance;
const pool = new SocketPool();

beforeAll(async () => {
  app = await createTestApp({ battles: { seed: () => 7 } });
  await pool.listen(app);
});
beforeEach(async () => {
  pool.closeAll();
  app.battles.clear();
  app.grace.clearAll();
  await resetDatabase(app);
});
afterAll(async () => {
  pool.closeAll();
  await app.close();
});

interface Fight {
  battleId: string;
  roomId: string;
  master: TestUser;
  ana: TestUser;
  bia: TestUser;
}

async function fight(): Promise<Fight> {
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
  return { battleId, roomId, master, ana, bia };
}

const post = (user: TestUser, url: string) => requestAs(app, user, { method: 'POST', url });

describe('restarting a battle (decision 7)', () => {
  it('the master restarts it as a formation of everyone still in, writing nothing', async () => {
    const f = await fight();
    const anaSocket = await pool.connect(f.ana);
    await anaSocket.emitWithAck(BATTLE_EVENTS.join, { battleId: f.battleId });
    // A few turns in, and Bia leaves for good.
    for (let i = 0; i < 3; i++) {
      app.battles.apply(f.battleId, nextCommand(runningState(app, f.battleId)));
    }
    const biaLeft = await requestAs(app, f.bia, {
      method: 'DELETE',
      url: `/api/battles/${f.battleId}/participants`,
    });
    expect(biaLeft.statusCode).toBe(204);
    const before = await app.prisma.campaignProfile.findMany({ orderBy: { id: 'asc' } });

    expect((await post(f.ana, `/api/battles/${f.battleId}/restart`)).statusCode).toBe(403);
    const closed = next<BattleClosedMessage>(anaSocket, BATTLE_EVENTS.closed, () => true);
    const res = await post(f.master, `/api/battles/${f.battleId}/restart`);
    expect(res.statusCode).toBe(200);
    const formation = res.json<BattleSummary>();
    expect(formation).toMatchObject({ nodeId: 'n-rat', status: 'forming' });
    expect(formation.participants.map((p) => p.userId)).toEqual([f.ana.id]);
    expect(await closed).toEqual({
      battleId: f.battleId,
      reason: 'restarted',
      next: formation.battleId,
    });

    expect(app.battles.get(f.battleId)).toBeUndefined();
    await app.battleJournal.settled();
    expect(await app.prisma.battleJournal.count()).toBe(0);
    expect(await app.prisma.campaignProfile.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect(await app.prisma.roomNodeClear.count({ where: { nodeId: 'n-rat' } })).toBe(0);
    expect((await battleAction(app, f.ana, formation.battleId, 'start')).statusCode).toBe(200);
  });
});

describe('cancelling a running battle (decision 8)', () => {
  it('is the master’s; a participant alone cannot', async () => {
    const f = await fight();
    expect((await battleAction(app, f.ana, f.battleId, 'cancel')).statusCode).toBe(403);
    expect((await battleAction(app, f.master, f.battleId, 'cancel')).statusCode).toBe(204);
  });

  it('without the master, every connected participant must ask in time', async () => {
    const f = await fight();
    const ask = (user: TestUser) => post(user, `/api/battles/${f.battleId}/cancel-requests`);

    const lobby = await pool.connect(f.master);
    await lobby.emitWithAck(ROOM_EVENTS.join, { roomId: f.roomId });
    expect((await ask(f.ana)).json()).toEqual({ error: 'master_present' });
    lobby.disconnect();
    // Past his lobby grace he is away.
    await new Promise((resolve) => setTimeout(resolve, TEST_GRACE_MS + 50));

    expect((await ask(f.ana)).json()).toEqual({ status: 'requested', waitingFor: 1 });
    expect((await ask(f.ana)).json()).toEqual({ status: 'requested', waitingFor: 1 });
    // The request runs out before Bia answers: it starts over.
    const battle = app.battles.get(f.battleId);
    if (battle?.status !== 'running') throw new Error('not running');
    battle.cancelRequest!.expiresAt = 0;
    expect((await ask(f.bia)).json()).toEqual({ status: 'requested', waitingFor: 1 });
    expect((await ask(f.ana)).json()).toEqual({ status: 'cancelled' });
    expect(app.battles.get(f.battleId)).toBeUndefined();
  });

  it('a dropped participant is not waited for; a stranger cannot ask', async () => {
    const f = await fight();
    app.battles.apply(f.battleId, {
      type: 'PlayerDisconnected',
      profileId: runningState(app, f.battleId).combatants.find((c) => c.userId === f.bia.id)!
        .profileId,
    });
    const stranger = await signUp(app, 'Stranger');
    const strangerAsks = await post(stranger, `/api/battles/${f.battleId}/cancel-requests`);
    expect([strangerAsks.statusCode, strangerAsks.json().error]).toEqual([
      404,
      'not_a_participant',
    ]);
    expect((await post(f.ana, `/api/battles/${f.battleId}/cancel-requests`)).json()).toEqual({
      status: 'cancelled',
    });
  });
});
