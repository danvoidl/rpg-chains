import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp } from './helpers.js';
import { chooseClass, createRoom, publishVersion, publishedCampaign } from './room-fixtures.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

describe('choosing a class (spec §5.2, §7)', () => {
  it('creates a full-health level-1 profile holding only the class base weapon', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);

    const res = await chooseClass(app, player, room.id, 'cl-duo');
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json<RoomDetail>()).toMatchObject({
      viewer: { isMaster: false, hasProfile: true },
      members: [
        { userId: author.id, isMaster: true, profile: null },
        {
          userId: player.id,
          name: 'Player',
          profile: { classId: 'cl-duo', className: 'Duo', level: 1, downed: false },
        },
      ],
    });
    const profile = await app.prisma.campaignProfile.findFirstOrThrow({
      where: { userId: player.id },
    });
    expect(profile).toMatchObject({
      level: 1,
      currentHp: 100,
      currentEnergy: 50,
      equipment: { weapon: 'it-sword' },
      inventory: [],
    });
  });

  it('refuses a full class, an unknown class and a second pick', async () => {
    const author = await signUp(app);
    const a = await signUp(app, 'A');
    const b = await signUp(app, 'B');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);

    expect((await chooseClass(app, a, room.id, 'cl-solo')).statusCode).toBe(201);
    const full = await chooseClass(app, b, room.id, 'cl-solo');
    expect(full.statusCode).toBe(409);
    expect(full.json()).toEqual({ error: 'class_full' });
    expect((await chooseClass(app, b, room.id, 'cl-gone')).statusCode).toBe(422);
    const again = await chooseClass(app, a, room.id, 'cl-duo');
    expect(again.json()).toEqual({ error: 'already_member' });

    const detail = await requestAs(app, b, { method: 'GET', url: `/api/rooms/${room.id}` });
    expect(detail.json<RoomDetail>().classes.find((c) => c.id === 'cl-solo')).toMatchObject({
      slotsTaken: 1,
      maxSlots: 1,
    });
  });

  it('gives the last slot to exactly one of two simultaneous players', async () => {
    const author = await signUp(app);
    const a = await signUp(app, 'A');
    const b = await signUp(app, 'B');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);

    const results = await Promise.all([
      chooseClass(app, a, room.id, 'cl-solo'),
      chooseClass(app, b, room.id, 'cl-solo'),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await app.prisma.campaignProfile.count({ where: { classId: 'cl-solo' } })).toBe(1);
  });

  it('requires the access code for a private room (but not for its master)', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId, false);

    expect((await chooseClass(app, player, room.id, 'cl-duo')).statusCode).toBe(404);
    expect((await chooseClass(app, player, room.id, 'cl-duo', 'WRONG1')).statusCode).toBe(404);
    expect((await chooseClass(app, player, room.id, 'cl-duo', room.accessCode!)).statusCode).toBe(
      201,
    );
    expect((await chooseClass(app, author, room.id, 'cl-duo')).statusCode).toBe(201);
  });
});

describe('rolling forward to newer versions (spec §2.2)', () => {
  it('moves the room to a newer published version when it is read, keeping profiles valid', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);
    await chooseClass(app, player, room.id, 'cl-duo');

    await publishVersion(app, campaignId, 2, { withExtraClass: true });
    const res = await requestAs(app, player, { method: 'GET', url: `/api/rooms/${room.id}` });
    const detail = res.json<RoomDetail>();
    expect(detail.version).toBe(2);
    expect(detail.classes.map((c) => c.id)).toEqual(['cl-solo', 'cl-duo', 'cl-new']);
    // The profile's class id still resolves in the new snapshot.
    expect(detail.members.find((m) => m.userId === player.id)?.profile?.className).toBe('Duo');

    const stored = await app.prisma.room.findUniqueOrThrow({
      where: { id: room.id },
      include: { campaignVersion: true },
    });
    expect(stored.campaignVersion.version).toBe(2);
  });

  it('lets a player pick a class that only exists in the newer version', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);
    await publishVersion(app, campaignId, 2, { withExtraClass: true });

    expect((await chooseClass(app, player, room.id, 'cl-new')).statusCode).toBe(201);
  });
});

describe('abandoning a room', () => {
  it('deletes the profile and frees the slot; the player may return as a new character', async () => {
    const author = await signUp(app);
    const a = await signUp(app, 'A');
    const b = await signUp(app, 'B');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);
    await chooseClass(app, a, room.id, 'cl-solo');

    const res = await requestAs(app, a, { method: 'DELETE', url: `/api/rooms/${room.id}/profile` });
    expect(res.statusCode).toBe(204);
    expect((await chooseClass(app, b, room.id, 'cl-solo')).statusCode).toBe(201);
    expect((await chooseClass(app, a, room.id, 'cl-duo')).statusCode).toBe(201);
  });

  it('makes the master hand the role over before abandoning, unless alone', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);
    await chooseClass(app, author, room.id, 'cl-solo');
    await chooseClass(app, player, room.id, 'cl-duo');

    const refused = await requestAs(app, author, {
      method: 'DELETE',
      url: `/api/rooms/${room.id}/profile`,
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ error: 'master_must_transfer' });

    await requestAs(app, player, { method: 'DELETE', url: `/api/rooms/${room.id}/profile` });
    const alone = await requestAs(app, author, {
      method: 'DELETE',
      url: `/api/rooms/${room.id}/profile`,
    });
    expect(alone.statusCode).toBe(204);
  });

  it('is a 404 for someone without a profile', async () => {
    const author = await signUp(app);
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId);
    const res = await requestAs(app, author, {
      method: 'DELETE',
      url: `/api/rooms/${room.id}/profile`,
    });
    expect(res.statusCode).toBe(404);
  });
});
