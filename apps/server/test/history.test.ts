import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { BattleSummary, HistoryEntry } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { playBattleToEnd } from './battle-play.js';
import { chooseClass, createRoom } from './room-fixtures.js';

/** The player's history (spec §7, Fase 5 plan decision 10): written on close, read by its owner. */

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp({ battles: { seed: () => 7 } });
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

function history(user: TestUser) {
  return requestAs(app, user, { method: 'GET', url: '/api/history' });
}

function close(master: TestUser, roomId: string) {
  return requestAs(app, master, { method: 'POST', url: `/api/rooms/${roomId}/close` });
}

describe('history (Fase 5 plan decision 10)', () => {
  it('records a completed campaign with the player’s own gold, and shows it only to them', async () => {
    const master = await signUp(app, 'Master');
    const ana = await signUp(app, 'Ana');
    const campaignId = await battleCampaign(app, master);
    const { id: roomId } = await createRoom(app, master, campaignId);
    await clearGate(app, roomId);
    await chooseClass(app, ana, roomId, 'cl-duo');

    // Ana beats the boss of the only chapter: the room completes.
    const opened = await openBattle(app, ana, roomId, 'n-boss');
    const { battleId } = opened.json<BattleSummary>();
    expect((await battleAction(app, ana, battleId, 'start')).statusCode).toBe(200);
    playBattleToEnd(app, battleId);
    await app.battleResolution.settled();
    const gold = (await app.prisma.campaignProfile.findFirstOrThrow({ where: { roomId } })).gold;

    expect((await close(master, roomId)).statusCode).toBe(200);

    const res = await history(ana);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<HistoryEntry[]>()).toEqual([
      {
        id: expect.any(String),
        roomId,
        roomName: 'Mesa de sexta',
        campaignName: 'As Sete Correntes',
        closedAt: expect.any(String),
        character: expect.objectContaining({
          classId: 'cl-duo',
          className: 'Duo',
          gold,
          completed: true,
          chaptersCleared: 1,
        }),
      },
    ]);
    // The master played no class: nothing in theirs.
    expect((await history(master)).json()).toEqual([]);
  });

  it('reads rows written before Fase 5 with defaults', async () => {
    const master = await signUp(app, 'Master');
    const ana = await signUp(app, 'Ana');
    const campaignId = await battleCampaign(app, master);
    const { id: roomId } = await createRoom(app, master, campaignId);
    await app.prisma.history.create({
      data: {
        roomId,
        userId: ana.id,
        campaignName: 'Antiga',
        finalData: {
          classId: 'cl-duo',
          className: 'Duo',
          level: 2,
          xp: 10,
          attributes: { strength: 1, dexterity: 0, intelligence: 0 },
          downed: false,
          equipment: {},
          inventory: [],
        },
      },
    });
    expect((await history(ana)).json<HistoryEntry[]>()[0]!.character).toMatchObject({
      gold: 0,
      completed: false,
      chaptersCleared: 0,
    });
  });
});
