import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { CatalogCampaign, RoomDetail, RoomSummary } from '@rpg-chains/shared-types';
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

describe('catalog', () => {
  it('lists only campaigns with a published version, with their latest version', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    await app.prisma.campaign.create({ data: { name: 'Draft only', authorId: author.id } });

    const res = await requestAs(app, player, { method: 'GET', url: '/api/catalog' });
    expect(res.json<CatalogCampaign[]>()).toEqual([
      {
        id: campaignId,
        name: 'As Sete Correntes',
        description: '',
        author: { id: author.id, name: 'Author' },
        latestVersion: 1,
      },
    ]);
    expect((await requestAs(app, null, { method: 'GET', url: '/api/catalog' })).statusCode).toBe(
      401,
    );
  });
});

describe('room creation and listing', () => {
  it('creates a public room on the latest version with the creator as master', async () => {
    const author = await signUp(app);
    const master = await signUp(app, 'Master');
    const campaignId = await publishedCampaign(app, author);

    const res = await requestAs(app, master, {
      method: 'POST',
      url: '/api/rooms',
      payload: { campaignId, name: 'Mesa de sexta', isPublic: true },
    });
    expect(res.statusCode, res.body).toBe(201);
    const room = res.json<RoomDetail>();
    expect(room).toMatchObject({
      name: 'Mesa de sexta',
      isPublic: true,
      status: 'open',
      accessCode: null,
      version: 1,
      master: { id: master.id, name: 'Master' },
      members: [{ userId: master.id, isMaster: true, profile: null }],
      viewer: { isMaster: true, hasProfile: false },
    });
    expect(room.classes.map((c) => [c.id, c.slotsTaken, c.maxSlots])).toEqual([
      ['cl-solo', 0, 1],
      ['cl-duo', 0, 2],
    ]);
    expect(await app.prisma.groupBag.count({ where: { roomId: room.id } })).toBe(1);
  });

  it('gives a private room an unambiguous 6-character code, shown to the master only', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId, false);
    expect(room.accessCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const asPlayer = await requestAs(app, player, {
      method: 'GET',
      url: `/api/rooms/${room.id}?code=${room.accessCode!.toLowerCase()}`,
    });
    expect(asPlayer.statusCode).toBe(200);
    expect(asPlayer.json<RoomDetail>().accessCode).toBeNull();
  });

  it('refuses a campaign without a published version', async () => {
    const author = await signUp(app);
    const draft = await app.prisma.campaign.create({
      data: { name: 'Draft', authorId: author.id },
    });
    const res = await requestAs(app, author, {
      method: 'POST',
      url: '/api/rooms',
      payload: { campaignId: draft.id, name: 'X', isPublic: true },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'campaign_not_published' });
  });

  it('lists open public rooms for everyone, and my rooms for their master and players', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const stranger = await signUp(app, 'Stranger');
    const campaignId = await publishedCampaign(app, author);
    const open = await createRoom(app, author, campaignId, true);
    const hidden = await createRoom(app, author, campaignId, false);
    await chooseClass(app, player, hidden.id, 'cl-duo', hidden.accessCode!);

    const publicList = await requestAs(app, stranger, { method: 'GET', url: '/api/rooms' });
    expect(publicList.json<RoomSummary[]>().map((r) => r.id)).toEqual([open.id]);

    const mine = await requestAs(app, player, { method: 'GET', url: '/api/rooms/mine' });
    expect(mine.json<RoomSummary[]>()).toEqual([
      expect.objectContaining({ id: hidden.id, playerCount: 1, isPublic: false }),
    ]);
    const masterRooms = await requestAs(app, author, { method: 'GET', url: '/api/rooms/mine' });
    expect(masterRooms.json<RoomSummary[]>()).toHaveLength(2);
  });
});

describe('joining and viewing', () => {
  it('resolves a code to its room, case-insensitively; a wrong code is a 404', async () => {
    const author = await signUp(app);
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId, false);

    const ok = await requestAs(app, player, {
      method: 'POST',
      url: '/api/rooms/join',
      payload: { code: room.accessCode!.toLowerCase() },
    });
    expect(ok.json()).toEqual({ roomId: room.id });

    const wrong = await requestAs(app, player, {
      method: 'POST',
      url: '/api/rooms/join',
      payload: { code: 'ZZZZZZ' },
    });
    expect(wrong.statusCode).toBe(404);
  });

  it('hides a private room from non-members without the code (404, not 403)', async () => {
    const author = await signUp(app);
    const stranger = await signUp(app, 'Stranger');
    const campaignId = await publishedCampaign(app, author);
    const room = await createRoom(app, author, campaignId, false);

    const res = await requestAs(app, stranger, { method: 'GET', url: `/api/rooms/${room.id}` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'room_not_found' });
  });
});

describe('campaign deletion', () => {
  it('refuses to delete a campaign that rooms are playing', async () => {
    const author = await signUp(app);
    const campaignId = await publishedCampaign(app, author);
    await createRoom(app, author, campaignId);

    const res = await requestAs(app, author, {
      method: 'DELETE',
      url: `/api/campaigns/${campaignId}`,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'campaign_has_rooms' });
  });
});
