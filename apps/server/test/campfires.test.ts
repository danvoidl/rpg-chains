import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

interface Table {
  roomId: string;
  master: TestUser;
  ana: TestUser;
  bia: TestUser;
}

/** A room of the battle fixture with Ana and Bia as knights; the gate is cleared when asked. */
async function table(gateCleared = true): Promise<Table> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const bia = await signUp(app, 'Bia');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  if (gateCleared) await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  await chooseClass(app, bia, roomId, 'cl-duo');
  return { roomId, master, ana, bia };
}

function light(user: TestUser, roomId: string, nodeId = 'n-camp') {
  return requestAs(app, user, { method: 'POST', url: `/api/rooms/${roomId}/campfires/${nodeId}` });
}

function hurt(user: TestUser) {
  return app.prisma.campaignProfile.updateMany({
    where: { userId: user.id },
    data: { downed: true, currentHp: 0, currentEnergy: 0 },
  });
}

function profileOf(user: TestUser) {
  return app.prisma.campaignProfile.findFirstOrThrow({ where: { userId: user.id } });
}

describe('campfires (Fase 5 plan decisions 4 and 12)', () => {
  it('is locked until the gate is cleared', async () => {
    const t = await table(false);
    const res = await light(t.ana, t.roomId);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'node_locked' });
  });

  it('revives and refills everyone and moves the chapter return point', async () => {
    const t = await table();
    await hurt(t.ana);
    await hurt(t.bia);

    const res = await light(t.ana, t.roomId);
    expect(res.statusCode, res.body).toBe(200);
    for (const user of [t.ana, t.bia]) {
      expect(await profileOf(user)).toMatchObject({
        downed: false,
        currentHp: 100,
        currentEnergy: 50,
      });
    }
    const chapter = res.json<RoomDetail>().progress.chapters[0]!;
    expect(chapter.campfireNodeId).toBe('n-camp');
    expect(chapter.nodes.find((n) => n.nodeId === 'n-camp')!.state).toBe('cleared');

    // Relighting is allowed and heals again.
    await hurt(t.bia);
    expect((await light(t.bia, t.roomId)).statusCode).toBe(200);
    expect(await profileOf(t.bia)).toMatchObject({ downed: false, currentHp: 100 });
  });

  it('skips profiles in a battle, and refuses the caller who is in one', async () => {
    const t = await table();
    expect((await openBattle(app, t.bia, t.roomId, 'n-rat')).statusCode).toBe(201);
    await hurt(t.ana);
    await hurt(t.bia);

    const refused = await light(t.bia, t.roomId);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ error: 'in_battle' });

    expect((await light(t.ana, t.roomId)).statusCode).toBe(200);
    expect(await profileOf(t.ana)).toMatchObject({ downed: false, currentHp: 100 });
    expect(await profileOf(t.bia)).toMatchObject({ downed: true, currentHp: 0 });
  });

  it('refuses other node types, unknown nodes and non-members', async () => {
    const t = await table();
    const wrong = await light(t.ana, t.roomId, 'n-rat');
    expect(wrong.statusCode).toBe(422);
    expect(wrong.json()).toEqual({ error: 'wrong_node_type' });

    const unknown = await light(t.ana, t.roomId, 'n-nowhere');
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({ error: 'node_not_found' });

    const stranger = await signUp(app, 'Stranger');
    const res = await light(stranger, t.roomId);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_a_player' });
  });
});
