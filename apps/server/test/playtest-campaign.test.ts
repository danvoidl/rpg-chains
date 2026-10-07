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

describe('the playtest campaign (Fase 3 plan M5)', () => {
  it('passes the publish gate with the kit, three battles, a shop and a boss', async () => {
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
      'battle',
      'boss',
    ]);
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

    expect(room.battleNodes).toHaveLength(4);
    for (const node of room.battleNodes) {
      expect(node.needsMaster).toBe(false);
      const opened = await openBattle(app, author, roomId, node.nodeId);
      expect(opened.statusCode, node.title).toBe(201);
      const { battleId } = opened.json<{ battleId: string }>();
      expect((await battleAction(app, author, battleId, 'start')).statusCode, node.title).toBe(200);
      expect((await battleAction(app, author, battleId, 'cancel')).statusCode).toBe(204);
    }
  });
});
