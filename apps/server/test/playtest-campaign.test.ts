import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { CampaignSnapshotSchema, type RoomDetail } from '@rpg-chains/shared-types';
import { createPlaytestCampaign } from '../src/services/playtest-campaign.js';
import { createTestApp, requestAs, resetDatabase, signUp } from './helpers.js';
import { battleAction, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

/** Replaces the room's progress with every node of the chapter cleared except `nodeId`. */
async function everythingClearedBut(
  roomId: string,
  chapterId: string,
  nodes: RoomDetail['progress']['chapters'][number]['nodes'],
  nodeId: string,
): Promise<void> {
  const others = nodes.filter((n) => n.nodeId !== nodeId);
  await app.prisma.$transaction([
    app.prisma.roomNodeClear.deleteMany({ where: { roomId } }),
    app.prisma.roomNodeClear.createMany({
      data: others.map((n, i) => ({
        roomId,
        chapterId,
        nodeId: n.nodeId,
        seq: i + 1,
        profileIds: [],
      })),
    }),
    app.prisma.room.update({ where: { id: roomId }, data: { progressSeq: others.length } }),
  ]);
}

describe('the playtest campaign (Fase 3 plan M5)', () => {
  it('passes the publish gate with the kit, three battles, a shop, a campfire and a boss', async () => {
    const author = await signUp(app, 'Mestre');
    const { campaignId, version, warnings } = await app.prisma.$transaction((tx) =>
      createPlaytestCampaign(tx, author.id, 'Playtest'),
    );
    expect(version).toBe(1);
    // Rewards inside the guide and every shop item priced (Fase 4 plan M3).
    expect(warnings).toEqual([]);

    const row = await app.prisma.campaignVersion.findFirstOrThrow({ where: { campaignId } });
    const snapshot = CampaignSnapshotSchema.parse(row.snapshot);
    expect(snapshot.classes.map((c) => c.name).sort()).toEqual([
      'Arauto',
      'Guardião',
      'Penitente',
      'Sacerdote',
    ]);
    const nodes = snapshot.chapters[0]!.nodes;
    expect(nodes.map((n) => n.type)).toEqual([
      'narrative',
      'battle',
      'battle',
      'shop',
      'campfire',
      'battle',
      'boss',
    ]);
    expect(snapshot.chapters).toHaveLength(2);
    expect(snapshot.chapters[1]!.nodes.map((n) => n.type)).toEqual([
      'narrative',
      'battle',
      'battle',
      'battle',
      'shop',
      'campfire',
      'boss',
    ]);
    expect(snapshot.chapters[1]!.nodes[0]!.mandatory).toBe(true);
    for (const chapter of snapshot.chapters)
      expect(chapter.opening?.text.length).toBeGreaterThan(0);
    expect(snapshot.villains.every((v) => v.xpReward > 0 && v.drops.length > 0)).toBe(true);
  });

  it('every battle of it can be formed and started from a room', async () => {
    const author = await signUp(app, 'Mestre');
    const { campaignId } = await app.prisma.$transaction((tx) =>
      createPlaytestCampaign(tx, author.id, 'Playtest'),
    );
    const { id: roomId } = await createRoom(app, author, campaignId);
    const room = (
      await requestAs(app, author, { method: 'GET', url: `/api/rooms/${roomId}` })
    ).json<RoomDetail>();
    await chooseClass(app, author, roomId, room.classes.find((c) => c.name === 'Guardião')!.id);

    const [chapter] = room.progress.chapters;
    const battles = chapter!.nodes.filter((n) => n.type === 'battle' || n.type === 'boss');
    expect(battles).toHaveLength(4);
    for (const node of battles) {
      expect(node.needsMaster).toBe(false);
      // Every other node cleared: this one is unlocked (Fase 5 plan decision 2).
      await everythingClearedBut(roomId, chapter!.chapterId, chapter!.nodes, node.nodeId);
      const opened = await openBattle(app, author, roomId, node.nodeId);
      expect(opened.statusCode, node.title).toBe(201);
      const { battleId } = opened.json<{ battleId: string }>();
      expect((await battleAction(app, author, battleId, 'start')).statusCode, node.title).toBe(200);
      expect((await battleAction(app, author, battleId, 'cancel')).statusCode).toBe(204);
    }
  });
});
