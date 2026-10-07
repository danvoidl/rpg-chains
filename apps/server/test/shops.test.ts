import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ProfileSheet, RoomDetail, ShopView } from '@rpg-chains/shared-types';
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

/** Ana in a room of the battle fixture, holding `gold`. */
async function shopper(gold: number): Promise<{ roomId: string; ana: TestUser }> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  await app.prisma.campaignProfile.updateMany({ where: { userId: ana.id }, data: { gold } });
  return { roomId, ana };
}

function buy(user: TestUser, roomId: string, itemId: string, quantity: number, nodeId = 'n-shop') {
  return requestAs(app, user, {
    method: 'POST',
    url: `/api/rooms/${roomId}/shops/${nodeId}/buy`,
    payload: { itemId, quantity },
  });
}

describe('shops (Fase 4 plan decision 11)', () => {
  it('lists the shop nodes and shows the wares with the buyer’s own gold', async () => {
    const { roomId, ana } = await shopper(40);
    const room = (
      await requestAs(app, ana, { method: 'GET', url: `/api/rooms/${roomId}` })
    ).json<RoomDetail>();
    expect(room.shopNodes).toEqual([
      { nodeId: 'n-shop', title: 'Merchant', chapterName: 'Cellar' },
    ]);

    const shop = await requestAs(app, ana, {
      method: 'GET',
      url: `/api/rooms/${roomId}/shops/n-shop`,
    });
    expect(shop.json<ShopView>()).toMatchObject({ gold: 40, title: 'Merchant' });
    expect(shop.json<ShopView>().items.map((i) => [i.itemId, i.price])).toEqual([
      ['it-potion', 15],
      ['it-helmet', 30],
      ['it-phoenix', 50],
    ]);
    const notAShop = await requestAs(app, ana, {
      method: 'GET',
      url: `/api/rooms/${roomId}/shops/n-rat`,
    });
    expect(notAShop.statusCode).toBe(404);
  });

  it('buys with the player’s own gold, no vote', async () => {
    const { roomId, ana } = await shopper(40);
    const bought = await buy(ana, roomId, 'it-potion', 2);
    expect(bought.statusCode, bought.body).toBe(200);
    expect(bought.json<ProfileSheet>()).toMatchObject({
      gold: 10,
      inventory: [expect.objectContaining({ itemId: 'it-potion', quantity: 2 })],
    });

    const broke = await buy(ana, roomId, 'it-helmet', 1);
    expect(broke.statusCode).toBe(409);
    expect(broke.json()).toEqual({ error: 'insufficient_gold' });
    expect((await buy(ana, roomId, 'it-sword', 1)).json()).toEqual({ error: 'not_sold_here' });
  });

  it('never spends the same gold twice, even with purchases at once', async () => {
    const { roomId, ana } = await shopper(30);
    const results = await Promise.all([
      buy(ana, roomId, 'it-helmet', 1),
      buy(ana, roomId, 'it-helmet', 1),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const profile = await app.prisma.campaignProfile.findFirstOrThrow({
      where: { userId: ana.id },
    });
    expect([profile.gold, profile.inventory]).toEqual([0, ['it-helmet']]);
  });
});
