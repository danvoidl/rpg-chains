import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleCampaign } from './battle-fixtures.js';
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

/** A fresh room of the battle fixture (nothing cleared) with Ana as a knight. */
async function table(): Promise<{ roomId: string; master: TestUser; ana: TestUser }> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  return { roomId, master, ana };
}

function proceed(user: TestUser, roomId: string, nodeId = 'n-gate') {
  return requestAs(app, user, {
    method: 'POST',
    url: `/api/rooms/${roomId}/narratives/${nodeId}/continue`,
  });
}

function stateOf(room: RoomDetail, nodeId: string): string | undefined {
  return room.progress.chapters[0]!.nodes.find((n) => n.nodeId === nodeId)?.state;
}

describe('narratives (Fase 5 plan decision 1)', () => {
  it('clears the entry narrative, which unlocks the next nodes', async () => {
    const { roomId, ana } = await table();
    const res = await proceed(ana, roomId);
    expect(res.statusCode, res.body).toBe(200);
    const room = res.json<RoomDetail>();
    expect(stateOf(room, 'n-gate')).toBe('cleared');
    expect(stateOf(room, 'n-rat')).toBe('unlocked');
  });

  it('accepts a second continue and keeps the first clear', async () => {
    const { roomId, ana } = await table();
    await proceed(ana, roomId);
    const first = await app.prisma.roomNodeClear.findMany({ where: { roomId } });

    const again = await proceed(ana, roomId);
    expect(again.statusCode, again.body).toBe(200);
    expect(stateOf(again.json<RoomDetail>(), 'n-gate')).toBe('cleared');
    expect(await app.prisma.roomNodeClear.findMany({ where: { roomId } })).toEqual(first);
  });

  it('refuses other node types and members without a profile', async () => {
    const { roomId, master, ana } = await table();
    await proceed(ana, roomId);
    const wrong = await proceed(ana, roomId, 'n-rat');
    expect(wrong.statusCode).toBe(422);
    expect(wrong.json()).toEqual({ error: 'wrong_node_type' });

    const noProfile = await proceed(master, roomId);
    expect(noProfile.statusCode).toBe(404);
    expect(noProfile.json()).toEqual({ error: 'not_a_player' });
  });

  it('shows the text to any member, before and after it is cleared, never while locked', async () => {
    const { roomId, master, ana } = await table();
    const read = (user: TestUser, nodeId = 'n-gate') =>
      requestAs(app, user, { method: 'GET', url: `/api/rooms/${roomId}/narratives/${nodeId}` });

    const open = await read(master);
    expect(open.statusCode, open.body).toBe(200);
    expect(open.json()).toEqual({
      nodeId: 'n-gate',
      title: 'Gate',
      text: 'The cellar door creaks open.',
      videoUrl: null,
      cleared: false,
    });
    await proceed(ana, roomId);
    expect((await read(ana)).json()).toMatchObject({ cleared: true });

    const outsider = await signUp(app, 'Outsider');
    expect((await read(outsider)).statusCode).toBe(404);
    expect((await read(ana, 'n-rat')).json()).toEqual({ error: 'wrong_node_type' });
  });
});
