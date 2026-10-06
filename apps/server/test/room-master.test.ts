import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp } from './helpers.js';
import { chooseClass, createRoom, publishedCampaign } from './room-fixtures.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

describe('master-only room management', () => {
  it('edits name and visibility: going private creates a code, going public drops it', async () => {
    const master = await signUp(app, 'Master');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId);
    const url = `/api/rooms/${room.id}`;

    const priv = await requestAs(app, master, {
      method: 'PATCH',
      url,
      payload: { name: 'Mesa fechada', isPublic: false },
    });
    expect(priv.statusCode, priv.body).toBe(200);
    expect(priv.json<RoomDetail>()).toMatchObject({ name: 'Mesa fechada', isPublic: false });
    expect(priv.json<RoomDetail>().accessCode).toMatch(/^[A-Z2-9]{6}$/);

    const pub = await requestAs(app, master, { method: 'PATCH', url, payload: { isPublic: true } });
    expect(pub.json<RoomDetail>()).toMatchObject({ isPublic: true, accessCode: null });
  });

  it('regenerates the code, invalidating the old one', async () => {
    const master = await signUp(app, 'Master');
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId, false);

    const res = await requestAs(app, master, {
      method: 'POST',
      url: `/api/rooms/${room.id}/access-code`,
    });
    const fresh = res.json<RoomDetail>().accessCode!;
    expect(fresh).not.toBe(room.accessCode);
    const old = await requestAs(app, player, {
      method: 'POST',
      url: '/api/rooms/join',
      payload: { code: room.accessCode },
    });
    expect(old.statusCode).toBe(404);

    const publicRoom = await createRoom(app, master, campaignId, true);
    const refused = await requestAs(app, master, {
      method: 'POST',
      url: `/api/rooms/${publicRoom.id}/access-code`,
    });
    expect(refused.json()).toEqual({ error: 'room_is_public' });
  });

  it('transfers the master role to a player only', async () => {
    const master = await signUp(app, 'Master');
    const player = await signUp(app, 'Player');
    const stranger = await signUp(app, 'Stranger');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId);
    await chooseClass(app, player, room.id, 'cl-duo');
    const url = `/api/rooms/${room.id}/transfer`;

    const toStranger = await requestAs(app, master, {
      method: 'POST',
      url,
      payload: { userId: stranger.id },
    });
    expect(toStranger.statusCode).toBe(422);

    const res = await requestAs(app, master, {
      method: 'POST',
      url,
      payload: { userId: player.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<RoomDetail>()).toMatchObject({
      master: { id: player.id },
      viewer: { isMaster: false },
    });
    // The former master no longer has master powers.
    const again = await requestAs(app, master, {
      method: 'POST',
      url,
      payload: { userId: player.id },
    });
    expect(again.statusCode).toBe(403);
  });

  it('closes the room, writing one history row per player, and freezes it', async () => {
    const master = await signUp(app, 'Master');
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId);
    await chooseClass(app, player, room.id, 'cl-duo');

    const res = await requestAs(app, master, {
      method: 'POST',
      url: `/api/rooms/${room.id}/close`,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<RoomDetail>().status).toBe('closed');

    const history = await app.prisma.history.findMany({ where: { roomId: room.id } });
    expect(history).toEqual([
      expect.objectContaining({
        userId: player.id,
        campaignName: 'As Sete Correntes',
        finalData: expect.objectContaining({ classId: 'cl-duo', className: 'Duo', level: 1 }),
      }),
    ]);

    const stranger = await signUp(app, 'Late');
    const late = await chooseClass(app, stranger, room.id, 'cl-duo');
    expect(late.json()).toEqual({ error: 'room_closed' });
    const twice = await requestAs(app, master, {
      method: 'POST',
      url: `/api/rooms/${room.id}/close`,
    });
    expect(twice.statusCode).toBe(409);
    const list = await requestAs(app, master, { method: 'GET', url: '/api/rooms' });
    expect(list.json()).toEqual([]);
  });

  it('refuses non-masters', async () => {
    const master = await signUp(app, 'Master');
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId);
    await chooseClass(app, player, room.id, 'cl-duo');

    for (const [method, path] of [
      ['PATCH', ''],
      ['POST', '/access-code'],
      ['POST', '/transfer'],
      ['POST', '/close'],
    ] as const) {
      const res = await requestAs(app, player, {
        method,
        url: `/api/rooms/${room.id}${path}`,
        payload: path === '/transfer' ? { userId: player.id } : {},
      });
      expect(res.statusCode, `${method} ${path}`).toBe(403);
    }
  });
});
