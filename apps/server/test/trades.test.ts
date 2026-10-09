import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import type { MemberInventory, TradeOfferView } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';

// Short enough to watch an offer expire.
const TIMEOUT_MS = 200;

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp({ trades: { timeoutMs: TIMEOUT_MS } });
  app.battles.clear();
  app.trades.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

interface Pair {
  roomId: string;
  ana: TestUser;
  bia: TestUser;
  anaId: string;
  biaId: string;
}

/** Ana (50 gold, two potions and a helmet) and Bia (20 gold, nothing) in one room. */
async function pair(): Promise<Pair> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const bia = await signUp(app, 'Bia');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  await chooseClass(app, bia, roomId, 'cl-duo');
  const profiles = await app.prisma.campaignProfile.findMany();
  const idOf = (user: TestUser) => profiles.find((p) => p.userId === user.id)!.id;
  await setProfile(idOf(ana), { gold: 50, inventory: ['it-potion', 'it-helmet', 'it-potion'] });
  await setProfile(idOf(bia), { gold: 20 });
  return { roomId, ana, bia, anaId: idOf(ana), biaId: idOf(bia) };
}

function setProfile(id: string, data: Prisma.CampaignProfileUpdateInput) {
  return app.prisma.campaignProfile.update({ where: { id }, data });
}

async function purse(id: string) {
  const row = await app.prisma.campaignProfile.findUniqueOrThrow({ where: { id } });
  return { gold: row.gold, inventory: row.inventory };
}

const nothing = { gold: 0, items: [] as string[] };

function propose(user: TestUser, roomId: string, payload: object) {
  return requestAs(app, user, { method: 'POST', url: `/api/rooms/${roomId}/trades`, payload });
}

async function offersOf(user: TestUser, roomId: string): Promise<TradeOfferView[]> {
  const res = await requestAs(app, user, { method: 'GET', url: `/api/rooms/${roomId}/trades` });
  return res.json<TradeOfferView[]>();
}

function accept(user: TestUser, roomId: string, tradeId: string) {
  return requestAs(app, user, {
    method: 'POST',
    url: `/api/rooms/${roomId}/trades/${tradeId}/accept`,
  });
}

describe('trades between players (Fase 4 plan decision 9)', () => {
  it('a sale: Ana offers the helmet for 15 gold, Bia sees and accepts it', async () => {
    const { roomId, ana, bia, anaId, biaId } = await pair();
    const res = await propose(ana, roomId, {
      toProfileId: biaId,
      give: { gold: 0, items: ['it-helmet'] },
      ask: { gold: 15, items: [] },
    });
    expect(res.statusCode, res.body).toBe(201);

    const [offer] = await offersOf(bia, roomId);
    expect(offer).toMatchObject({
      from: { profileId: anaId, name: 'Ana' },
      to: { profileId: biaId, name: 'Bia' },
      give: { gold: 0, items: [{ itemId: 'it-helmet', name: 'Helmet', quantity: 1 }] },
      ask: { gold: 15, items: [] },
    });
    // Nothing moved yet.
    expect((await purse(anaId)).gold).toBe(50);

    expect((await accept(bia, roomId, offer!.id)).statusCode).toBe(200);
    expect(await purse(anaId)).toEqual({ gold: 65, inventory: ['it-potion', 'it-potion'] });
    expect(await purse(biaId)).toEqual({ gold: 5, inventory: ['it-helmet'] });
    expect(await offersOf(ana, roomId)).toEqual([]);
  });

  it('a gift also waits for the other side, and only the receiver accepts', async () => {
    const { roomId, ana, bia, anaId, biaId } = await pair();
    await propose(ana, roomId, { toProfileId: biaId, give: { gold: 10, items: [] }, ask: nothing });
    const [offer] = await offersOf(ana, roomId);
    expect((await accept(ana, roomId, offer!.id)).statusCode).toBe(404);
    expect((await accept(bia, roomId, offer!.id)).statusCode).toBe(200);
    expect([(await purse(anaId)).gold, (await purse(biaId)).gold]).toEqual([40, 30]);
  });

  it('moves nothing when a side no longer covers its promise, without telling the other’s gold', async () => {
    const { roomId, ana, bia, anaId, biaId } = await pair();
    await propose(ana, roomId, {
      toProfileId: biaId,
      give: { gold: 0, items: ['it-potion'] },
      ask: { gold: 30, items: [] },
    });
    const [offer] = await offersOf(bia, roomId);
    const short = await accept(bia, roomId, offer!.id);
    expect(short.statusCode).toBe(409);
    expect(short.json()).toEqual({ error: 'ask_not_covered' });

    // Ana spends what she offered before Bia accepts.
    await setProfile(anaId, { inventory: ['it-helmet'] });
    await setProfile(biaId, { gold: 40 });
    expect((await accept(bia, roomId, offer!.id)).json()).toEqual({
      error: 'offer_no_longer_covered',
    });
    expect(await purse(biaId)).toEqual({ gold: 40, inventory: [] });
  });

  it('two offers of the same item accepted at once: only one goes through', async () => {
    const { roomId, ana, bia, anaId, biaId } = await pair();
    const cid = await signUp(app, 'Cid');
    await chooseClass(app, cid, roomId, 'cl-solo');
    const cidId = (await app.prisma.campaignProfile.findFirstOrThrow({ where: { userId: cid.id } }))
      .id;
    await setProfile(anaId, { inventory: ['it-helmet'] });
    const helmet = { gold: 0, items: ['it-helmet'] };
    await propose(ana, roomId, { toProfileId: biaId, give: helmet, ask: nothing });
    await propose(ana, roomId, { toProfileId: cidId, give: helmet, ask: nothing });
    const [toBia] = await offersOf(bia, roomId);
    const [toCid] = await offersOf(cid, roomId);

    const results = await Promise.all([
      accept(bia, roomId, toBia!.id),
      accept(cid, roomId, toCid!.id),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const holders = [await purse(biaId), await purse(cidId)].filter((p) =>
      (p.inventory as string[]).includes('it-helmet'),
    );
    expect(holders).toHaveLength(1);
    expect((await purse(anaId)).inventory).toEqual([]);
  });

  it('refuses an equipped item, a second offer for the pair, and a player in a battle', async () => {
    const { roomId, ana, bia, anaId, biaId } = await pair();
    // The sword is equipped, not in the inventory.
    const equipped = await propose(ana, roomId, {
      toProfileId: biaId,
      give: { gold: 0, items: ['it-sword'] },
      ask: nothing,
    });
    expect(equipped.json()).toEqual({ error: 'offer_not_covered' });

    await propose(ana, roomId, { toProfileId: biaId, give: { gold: 1, items: [] }, ask: nothing });
    const again = await propose(bia, roomId, {
      toProfileId: anaId,
      give: { gold: 1, items: [] },
      ask: nothing,
    });
    expect(again.json()).toEqual({ error: 'trade_pending' });

    // Going into a battle drops the player's offers, and a player in one cannot be offered to.
    expect((await openBattle(app, bia, roomId, 'n-rat')).statusCode).toBe(201);
    expect(await offersOf(ana, roomId)).toEqual([]);
    const busy = await propose(ana, roomId, {
      toProfileId: biaId,
      give: { gold: 1, items: [] },
      ask: nothing,
    });
    expect(busy.json()).toEqual({ error: 'target_in_battle' });
  });

  it('either party drops an offer, and it expires on its own', async () => {
    const { roomId, ana, bia, biaId } = await pair();
    await propose(ana, roomId, { toProfileId: biaId, give: { gold: 1, items: [] }, ask: nothing });
    const [offer] = await offersOf(ana, roomId);
    const declined = await requestAs(app, bia, {
      method: 'DELETE',
      url: `/api/rooms/${roomId}/trades/${offer!.id}`,
    });
    expect(declined.statusCode).toBe(204);
    expect(await offersOf(ana, roomId)).toEqual([]);

    await propose(ana, roomId, { toProfileId: biaId, give: { gold: 1, items: [] }, ask: nothing });
    expect(await offersOf(bia, roomId)).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS + 100));
    expect(await offersOf(bia, roomId)).toEqual([]);
  });

  it('shows another member’s inventory, never their gold', async () => {
    const { roomId, bia, anaId } = await pair();
    const res = await requestAs(app, bia, {
      method: 'GET',
      url: `/api/rooms/${roomId}/members/${anaId}/inventory`,
    });
    expect(res.json<MemberInventory>()).toEqual([
      { itemId: 'it-potion', name: 'Potion', quantity: 2 },
      { itemId: 'it-helmet', name: 'Helmet', quantity: 1 },
    ]);
  });
});

describe('offers survive a restart (Fase 6 plan decision 9)', () => {
  it('a pending offer is stored, comes back on the next boot, and still expires on time', async () => {
    const { roomId, ana, biaId } = await pair();
    await propose(ana, roomId, { toProfileId: biaId, give: { gold: 5, items: [] }, ask: nothing });
    await app.tradeStore.settled();
    const [stored] = await app.prisma.tradeOffer.findMany();
    expect(stored).toMatchObject({ roomId, toProfileId: biaId, give: { gold: 5, items: [] } });

    const next = await createTestApp({ trades: { timeoutMs: TIMEOUT_MS, restore: true } });
    try {
      expect(next.trades.involving(biaId).map((o) => o.id)).toEqual([stored!.id]);
      await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS + 50));
      expect(next.trades.involving(biaId)).toEqual([]);
      await next.tradeStore.settled();
      expect(await next.prisma.tradeOffer.count()).toBe(0);
    } finally {
      await next.close();
    }
  });

  it('accepting or declining removes the stored copy', async () => {
    const { roomId, ana, bia, biaId } = await pair();
    await propose(ana, roomId, { toProfileId: biaId, give: { gold: 5, items: [] }, ask: nothing });
    const [offer] = await offersOf(bia, roomId);
    expect((await accept(bia, roomId, offer!.id)).statusCode).toBe(200);
    await app.tradeStore.settled();
    expect(await app.prisma.tradeOffer.count()).toBe(0);

    await propose(ana, roomId, { toProfileId: biaId, give: { gold: 5, items: [] }, ask: nothing });
    const [second] = await offersOf(bia, roomId);
    await requestAs(app, bia, {
      method: 'DELETE',
      url: `/api/rooms/${roomId}/trades/${second!.id}`,
    });
    await app.tradeStore.settled();
    expect(await app.prisma.tradeOffer.count()).toBe(0);
  });
});
