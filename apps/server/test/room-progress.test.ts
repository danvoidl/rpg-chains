import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import type { BattleSummary, RoomDetail } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import {
  battleAction,
  battleCampaign,
  battleSnapshot,
  clearGate,
  openBattle,
} from './battle-fixtures.js';
import { playBattleToEnd } from './battle-play.js';
import { chooseClass, createRoom } from './room-fixtures.js';

/**
 * The room's progress through battles (Fase 5 plan M2): the unlock gate on formations, a victory
 * clearing its node, a defeat returning to the campfire in what the defeated did, the room
 * completing with the last boss, and a defeat and a victory racing in one chapter.
 */

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp({ battles: { seed: () => 7 } });
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

interface Table {
  roomId: string;
  campaignId: string;
  master: TestUser;
  ana: TestUser;
  bia: TestUser;
  anaProfile: string;
  biaProfile: string;
}

async function table({ gate = true } = {}): Promise<Table> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const bia = await signUp(app, 'Bia');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  if (gate) await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  await chooseClass(app, bia, roomId, 'cl-duo');
  const profileOf = async (user: TestUser) =>
    (await app.prisma.campaignProfile.findFirstOrThrow({ where: { userId: user.id } })).id;
  return {
    roomId,
    campaignId,
    master,
    ana,
    bia,
    anaProfile: await profileOf(ana),
    biaProfile: await profileOf(bia),
  };
}

/** `user` alone in a started battle on `nodeId`. */
async function solo(t: Table, user: TestUser, nodeId: string): Promise<string> {
  const opened = await openBattle(app, user, t.roomId, nodeId);
  expect(opened.statusCode, opened.body).toBe(201);
  const { battleId } = opened.json<BattleSummary>();
  expect((await battleAction(app, user, battleId, 'start')).statusCode).toBe(200);
  return battleId;
}

/** Loses a solo battle: its only player leaves (spec §3.7). */
function lose(battleId: string, profileId: string): void {
  expect(app.battles.apply(battleId, { type: 'PlayerLeft', profileId })).toEqual({ ok: true });
}

async function room(t: Table, user: TestUser = t.ana): Promise<RoomDetail> {
  const res = await requestAs(app, user, { method: 'GET', url: `/api/rooms/${t.roomId}` });
  expect(res.statusCode, res.body).toBe(200);
  return res.json<RoomDetail>();
}

const nodeStates = (detail: RoomDetail) =>
  Object.fromEntries(detail.progress.chapters[0]!.nodes.map((n) => [n.nodeId, n.state]));

async function clears(roomId: string) {
  const rows = await app.prisma.roomNodeClear.findMany({
    where: { roomId },
    orderBy: { seq: 'asc' },
  });
  return rows.map((r) => [r.nodeId, r.profileIds]);
}

/** Adds clears after the gate (seq 1) as if they had happened, in order. */
async function seedClears(roomId: string, entries: Array<[nodeId: string, profileId: string]>) {
  await app.prisma.$transaction([
    ...entries.map(([nodeId, profileId], i) =>
      app.prisma.roomNodeClear.create({
        data: { roomId, chapterId: 'ch-1', nodeId, seq: i + 2, profileIds: [profileId] },
      }),
    ),
    app.prisma.room.update({ where: { id: roomId }, data: { progressSeq: entries.length + 1 } }),
  ]);
}

describe('the unlock gate on formations (Fase 5 plan decisions 2–3)', () => {
  it('refuses a locked node, and a won one', async () => {
    const t = await table({ gate: false });
    const locked = await openBattle(app, t.ana, t.roomId, 'n-rat');
    expect(locked.statusCode).toBe(409);
    expect(locked.json()).toEqual({ error: 'node_locked' });

    await clearGate(app, t.roomId);
    playBattleToEnd(app, await solo(t, t.ana, 'n-rat'));
    await app.battleResolution.settled();

    const won = await openBattle(app, t.bia, t.roomId, 'n-rat');
    expect(won.statusCode).toBe(409);
    expect(won.json()).toEqual({ error: 'node_cleared' });
  });

  it('shows the battle on its node while it runs', async () => {
    const t = await table();
    const battleId = await solo(t, t.ana, 'n-rat');
    const rat = (await room(t)).progress.chapters[0]!.nodes.find((n) => n.nodeId === 'n-rat')!;
    expect(rat).toMatchObject({ state: 'unlocked', battleId });
  });
});

describe('a battle ends in the progress (Fase 5 plan decisions 1 and 5)', () => {
  it('a victory clears the node, crediting who fought', async () => {
    const t = await table();
    playBattleToEnd(app, await solo(t, t.ana, 'n-rat'));
    await app.battleResolution.settled();
    expect(await clears(t.roomId)).toEqual([
      ['n-gate', []],
      ['n-rat', [t.anaProfile]],
    ]);
    expect(nodeStates(await room(t))['n-rat']).toBe('cleared');
  });

  it('a defeat undoes only what the defeated did after the campfire, and restores them', async () => {
    const t = await table();
    // Before the campfire Ana opened the shop; Bia lights the campfire; after it Ana won n-open
    // and Bia n-silent (seeded as facts).
    await seedClears(t.roomId, [['n-shop', t.anaProfile]]);
    const lit = await requestAs(app, t.bia, {
      method: 'POST',
      url: `/api/rooms/${t.roomId}/campfires/n-camp`,
    });
    expect(lit.statusCode, lit.body).toBe(200);
    const after = await app.prisma.room.findUniqueOrThrow({ where: { id: t.roomId } });
    await app.prisma.$transaction([
      app.prisma.roomNodeClear.createMany({
        data: [
          {
            roomId: t.roomId,
            chapterId: 'ch-1',
            nodeId: 'n-open',
            seq: after.progressSeq + 1,
            profileIds: [t.anaProfile],
          },
          {
            roomId: t.roomId,
            chapterId: 'ch-1',
            nodeId: 'n-silent',
            seq: after.progressSeq + 2,
            profileIds: [t.biaProfile],
          },
        ],
      }),
      app.prisma.room.update({
        where: { id: t.roomId },
        data: { progressSeq: after.progressSeq + 2 },
      }),
    ]);

    lose(await solo(t, t.ana, 'n-rat'), t.anaProfile);
    await app.battleResolution.settled();

    expect((await clears(t.roomId)).map(([nodeId]) => nodeId)).toEqual([
      'n-gate',
      'n-shop',
      'n-camp',
      'n-silent',
    ]);
    const detail = await room(t);
    expect(detail.progress.chapters[0]!.campfireNodeId).toBe('n-camp');
    expect(nodeStates(detail)['n-open']).toBe('unlocked');
    const ana = detail.members.find((m) => m.userId === t.ana.id)!.profile!;
    expect(ana).toMatchObject({ downed: false, currentHp: ana.maxHp });
  });

  it('without a lit campfire, a defeat returns to the chapter entry', async () => {
    const t = await table();
    await seedClears(t.roomId, [
      ['n-shop', t.anaProfile],
      ['n-silent', t.biaProfile],
    ]);
    lose(await solo(t, t.ana, 'n-rat'), t.anaProfile);
    await app.battleResolution.settled();
    // The gate was cleared by nobody in the battle; Bia's clear stays.
    expect((await clears(t.roomId)).map(([nodeId]) => nodeId)).toEqual(['n-gate', 'n-silent']);
  });
});

describe('the room completes with the last boss (spec §7, Fase 5 plan decision 9)', () => {
  it('beating the boss completes the room; a new chapter reopens it', async () => {
    const t = await table();
    playBattleToEnd(app, await solo(t, t.ana, 'n-boss'));
    await app.battleResolution.settled();

    const done = await room(t);
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBeNull();
    expect(done.progress.completed).toBe(true);
    expect(done.progress.chapters[0]!.state).toBe('cleared');
    // Still playable: the shop opens.
    const shop = await requestAs(app, t.bia, {
      method: 'GET',
      url: `/api/rooms/${t.roomId}/shops/n-shop`,
    });
    expect(shop.statusCode).toBe(200);

    // Version 2 appends a chapter: the room rolls forward and is open again.
    const v1 = battleSnapshot(t.campaignId, 1);
    const extra = structuredClone(v1.chapters[0]!);
    const renamed = (id: string) => `${id}-2`;
    const chapter2 = {
      ...extra,
      id: 'ch-2',
      name: 'Sewers',
      entryNodeId: renamed(extra.entryNodeId),
      bossNodeId: renamed(extra.bossNodeId),
      nodes: extra.nodes.map((n) => ({ ...n, id: renamed(n.id) })),
      edges: extra.edges.map((e) => ({ from: renamed(e.from), to: renamed(e.to) })),
    };
    await app.prisma.campaignVersion.create({
      data: {
        campaignId: t.campaignId,
        version: 2,
        snapshot: {
          ...battleSnapshot(t.campaignId, 2),
          chapters: [v1.chapters[0]!, chapter2],
        } as unknown as Prisma.InputJsonValue,
      },
    });
    const reopened = await room(t);
    expect(reopened).toMatchObject({ version: 2, status: 'open', completedAt: null });
    expect(reopened.progress.chapters.map((c) => c.state)).toEqual(['cleared', 'current']);
    expect(reopened.progress.completed).toBe(false);
  });
});

describe('a defeat and a victory racing in one chapter (Fase 5 plan risks)', () => {
  for (const order of ['victory first', 'defeat first'] as const) {
    it(`ends the same with the ${order}`, async () => {
      const t = await table();
      // Ana opened the shop: her defeat undoes it. Bia beats the boss meanwhile.
      await seedClears(t.roomId, [['n-shop', t.anaProfile]]);
      const anaBattle = await solo(t, t.ana, 'n-rat');
      const biaBattle = await solo(t, t.bia, 'n-boss');
      if (order === 'victory first') {
        playBattleToEnd(app, biaBattle);
        lose(anaBattle, t.anaProfile);
      } else {
        lose(anaBattle, t.anaProfile);
        playBattleToEnd(app, biaBattle);
      }
      await app.battleResolution.settled();

      expect(await clears(t.roomId)).toEqual([
        ['n-gate', []],
        ['n-boss', [t.biaProfile]],
      ]);
      expect((await room(t)).status).toBe('completed');
    });
  }
});
