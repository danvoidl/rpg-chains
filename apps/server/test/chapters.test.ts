import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DraftChapter } from '@rpg-chains/shared-types';
import { createTestApp, resetDatabase, signUp, requestAs } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await app.close();
});

describe('chapters REST routes', () => {
  describe('authentication & authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const getRes = await requestAs(app, null, {
        method: 'GET',
        url: '/api/campaigns/c123/chapters',
      });
      expect(getRes.statusCode).toBe(401);

      const postRes = await requestAs(app, null, {
        method: 'POST',
        url: '/api/campaigns/c123/chapters',
        payload: { name: 'Chapter 1' },
      });
      expect(postRes.statusCode).toBe(401);

      const getOneRes = await requestAs(app, null, {
        method: 'GET',
        url: '/api/campaigns/c123/chapters/ch123',
      });
      expect(getOneRes.statusCode).toBe(401);

      const patchRes = await requestAs(app, null, {
        method: 'PATCH',
        url: '/api/campaigns/c123/chapters/ch123',
        payload: { name: 'Updated' },
      });
      expect(patchRes.statusCode).toBe(401);

      const delRes = await requestAs(app, null, {
        method: 'DELETE',
        url: '/api/campaigns/c123/chapters/ch123',
      });
      expect(delRes.statusCode).toBe(401);

      const putGraphRes = await requestAs(app, null, {
        method: 'PUT',
        url: '/api/campaigns/c123/chapters/ch123/graph',
        payload: { entryNodeId: null, bossNodeId: null, nodes: [], edges: [] },
      });
      expect(putGraphRes.statusCode).toBe(401);
    });

    it("returns 403 when user B touches user A's campaign chapters", async () => {
      const userA = await signUp(app, 'Author A');
      const userB = await signUp(app, 'Author B');

      const cRes = await requestAs(app, userA, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: "User A's Campaign" },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const chRes = await requestAs(app, userA, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Chapter 1' },
      });
      const chapterId = chRes.json<{ id: string }>().id;

      const getRes = await requestAs(app, userB, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/chapters`,
      });
      expect(getRes.statusCode).toBe(403);
      expect(getRes.json()).toEqual({ error: 'forbidden' });

      const postRes = await requestAs(app, userB, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Hijacked Chapter' },
      });
      expect(postRes.statusCode).toBe(403);

      const getOneRes = await requestAs(app, userB, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}`,
      });
      expect(getOneRes.statusCode).toBe(403);

      const patchRes = await requestAs(app, userB, {
        method: 'PATCH',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}`,
        payload: { name: 'Hijacked' },
      });
      expect(patchRes.statusCode).toBe(403);

      const delRes = await requestAs(app, userB, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}`,
      });
      expect(delRes.statusCode).toBe(403);
    });
  });

  describe('CRUD operations & default order', () => {
    it('supports happy-path CRUD and uses chapter count as default order', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'My Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // Create first chapter — order omitted, defaults to 0 (count = 0).
      const ch1Res = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Prologue' },
      });
      expect(ch1Res.statusCode).toBe(201);
      const ch1 = ch1Res.json<{
        id: string;
        name: string;
        order: number;
        underConstruction: boolean;
      }>();
      expect(ch1.name).toBe('Prologue');
      expect(ch1.order).toBe(0);
      expect(ch1.underConstruction).toBe(false);

      // Create second chapter — order omitted, defaults to 1 (count = 1).
      const ch2Res = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Act I', underConstruction: true },
      });
      expect(ch2Res.statusCode).toBe(201);
      const ch2 = ch2Res.json<{
        id: string;
        name: string;
        order: number;
        underConstruction: boolean;
      }>();
      expect(ch2.order).toBe(1);
      expect(ch2.underConstruction).toBe(true);

      // Create third chapter with explicit order.
      const ch3Res = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Act II', order: 5 },
      });
      expect(ch3Res.statusCode).toBe(201);
      const ch3 = ch3Res.json<{
        id: string;
        name: string;
        order: number;
        underConstruction: boolean;
      }>();
      expect(ch3.order).toBe(5);

      // List — ordered by order asc, then id.
      const listRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/chapters`,
      });
      expect(listRes.statusCode).toBe(200);
      const list = listRes.json<{ id: string; name: string; order: number }[]>();
      expect(list).toHaveLength(3);
      expect(list[0].order).toBe(0);
      expect(list[1].order).toBe(1);
      expect(list[2].order).toBe(5);

      // GET single chapter — returns DraftChapter shape.
      const getRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/chapters/${ch1.id}`,
      });
      expect(getRes.statusCode).toBe(200);
      const draftChapter = getRes.json<DraftChapter>();
      expect(draftChapter.id).toBe(ch1.id);
      expect(draftChapter.nodes).toEqual([]);
      expect(draftChapter.edges).toEqual([]);
      expect(draftChapter.entryNodeId).toBeNull();
      expect(draftChapter.bossNodeId).toBeNull();

      // PATCH — partial update.
      const patchRes = await requestAs(app, user, {
        method: 'PATCH',
        url: `/api/campaigns/${campaignId}/chapters/${ch1.id}`,
        payload: { name: 'Prologue Updated', order: 10 },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json<{ id: string; name: string; order: number }>();
      expect(patched.id).toBe(ch1.id);
      expect(patched.name).toBe('Prologue Updated');
      expect(patched.order).toBe(10);

      // DELETE.
      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/chapters/${ch1.id}`,
      });
      expect(delRes.statusCode).toBe(204);

      // Verify it's gone.
      const listAfterRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/chapters`,
      });
      const listAfter = listAfterRes.json<{ id: string }[]>();
      expect(listAfter.every((c) => c.id !== ch1.id)).toBe(true);
    });
  });

  describe('scoping & not-found', () => {
    it('returns 404 when a chapter id from another campaign is accessed', async () => {
      const user = await signUp(app, 'Author');

      const cX = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign X' },
      });
      const campaignXId = cX.json<{ id: string }>().id;

      const cY = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign Y' },
      });
      const campaignYId = cY.json<{ id: string }>().id;

      const chX = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignXId}/chapters`,
        payload: { name: 'Chapter in X' },
      });
      const chapterId = chX.json<{ id: string }>().id;

      // Access chapter X under campaign Y — must 404.
      const getRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignYId}/chapters/${chapterId}`,
      });
      expect(getRes.statusCode).toBe(404);
      expect(getRes.json()).toEqual({ error: 'chapter_not_found' });

      const patchRes = await requestAs(app, user, {
        method: 'PATCH',
        url: `/api/campaigns/${campaignYId}/chapters/${chapterId}`,
        payload: { name: 'Hijacked' },
      });
      expect(patchRes.statusCode).toBe(404);
      expect(patchRes.json()).toEqual({ error: 'chapter_not_found' });

      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignYId}/chapters/${chapterId}`,
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json()).toEqual({ error: 'chapter_not_found' });

      const graphRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignYId}/chapters/${chapterId}/graph`,
        payload: { entryNodeId: null, bossNodeId: null, nodes: [], edges: [] },
      });
      expect(graphRes.statusCode).toBe(404);
      expect(graphRes.json()).toEqual({ error: 'chapter_not_found' });
    });
  });

  describe('PUT /:chapterId/graph', () => {
    it('creates nodes of every type and edges, then verifies the returned DraftChapter', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const chRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Chapter 1' },
      });
      const chapterId = chRes.json<{ id: string }>().id;

      const battleId = randomUUID();
      const bossId = randomUUID();
      const shopId = randomUUID();
      const campfireId = randomUUID();
      const narrativeId = randomUUID();
      const entryNodeId = battleId;

      const graphPayload = {
        entryNodeId,
        bossNodeId: bossId,
        nodes: [
          {
            id: battleId,
            type: 'battle',
            mandatory: false,
            recommendedLevel: 1,
            participantLimit: 4,
            position: { x: 0, y: 0 },
            prerequisites: [],
            config: { villainIds: [], questionIds: [] },
          },
          {
            id: bossId,
            type: 'boss',
            mandatory: true,
            recommendedLevel: 5,
            participantLimit: null,
            position: { x: 100, y: 0 },
            prerequisites: [battleId],
            config: { villainIds: [], questionIds: [] },
          },
          {
            id: shopId,
            type: 'shop',
            mandatory: false,
            recommendedLevel: null,
            participantLimit: null,
            position: { x: 50, y: 50 },
            prerequisites: [],
            config: { itemIds: [] },
          },
          {
            id: campfireId,
            type: 'campfire',
            mandatory: false,
            recommendedLevel: null,
            participantLimit: null,
            position: { x: 200, y: 0 },
            prerequisites: [bossId],
            config: {},
          },
          {
            id: narrativeId,
            type: 'narrative',
            mandatory: false,
            recommendedLevel: null,
            participantLimit: null,
            position: { x: 300, y: 0 },
            prerequisites: [],
            config: { text: 'Hello world', videoUrl: null },
          },
        ],
        edges: [
          { from: battleId, to: bossId },
          { from: bossId, to: campfireId },
        ],
      };

      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}/graph`,
        payload: graphPayload,
      });
      expect(putRes.statusCode).toBe(200);

      const chapter = putRes.json<DraftChapter>();
      expect(chapter.id).toBe(chapterId);
      expect(chapter.entryNodeId).toBe(entryNodeId);
      expect(chapter.bossNodeId).toBe(bossId);
      expect(chapter.nodes).toHaveLength(5);
      expect(chapter.edges).toHaveLength(2);

      // Verify node types are present.
      const typeSet = new Set(chapter.nodes.map((n) => n.type));
      expect(typeSet).toContain('battle');
      expect(typeSet).toContain('boss');
      expect(typeSet).toContain('shop');
      expect(typeSet).toContain('campfire');
      expect(typeSet).toContain('narrative');
    });

    it('second PUT moves a node, deletes a node, and verifies cleanup of edges and prerequisites', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const chRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Chapter 1' },
      });
      const chapterId = chRes.json<{ id: string }>().id;

      const nodeA = randomUUID();
      const nodeB = randomUUID();
      const nodeC = randomUUID();

      // First PUT: three nodes, two edges, nodeC is boss.
      await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}/graph`,
        payload: {
          entryNodeId: nodeA,
          bossNodeId: nodeC,
          nodes: [
            {
              id: nodeA,
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 0, y: 0 },
              prerequisites: [],
              config: {},
            },
            {
              id: nodeB,
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 100, y: 0 },
              prerequisites: [nodeA],
              config: {},
            },
            {
              id: nodeC,
              type: 'boss',
              mandatory: true,
              recommendedLevel: 3,
              participantLimit: null,
              position: { x: 200, y: 0 },
              prerequisites: [nodeB],
              config: { villainIds: [], questionIds: [] },
            },
          ],
          edges: [
            { from: nodeA, to: nodeB },
            { from: nodeB, to: nodeC },
          ],
        },
      });

      // Second PUT: remove nodeB, move nodeA, update nodeC prerequisites (should be cleaned).
      const put2Res = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}/graph`,
        payload: {
          entryNodeId: nodeA,
          bossNodeId: nodeC,
          nodes: [
            {
              id: nodeA,
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 50, y: 100 }, // moved
              prerequisites: [],
              config: {},
            },
            {
              id: nodeC,
              type: 'boss',
              mandatory: true,
              recommendedLevel: 3,
              participantLimit: null,
              position: { x: 200, y: 0 },
              prerequisites: [nodeB], // nodeB removed — normalizeGraph should clean this
              config: { villainIds: [], questionIds: [] },
            },
          ],
          edges: [
            { from: nodeA, to: nodeC },
            { from: nodeB, to: nodeC }, // nodeB removed — normalizeGraph should drop this
          ],
        },
      });
      expect(put2Res.statusCode).toBe(200);

      const chapter = put2Res.json<DraftChapter>();
      expect(chapter.nodes).toHaveLength(2);

      // nodeB must be gone.
      expect(chapter.nodes.some((n) => n.id === nodeB)).toBe(false);

      // nodeA position must reflect the move.
      const nodeAResult = chapter.nodes.find((n) => n.id === nodeA);
      expect(nodeAResult?.position).toEqual({ x: 50, y: 100 });

      // Dangling edge nodeB→nodeC must be removed.
      expect(chapter.edges.some((e) => e.from === nodeB)).toBe(false);

      // Valid edge nodeA→nodeC must remain.
      expect(chapter.edges.some((e) => e.from === nodeA && e.to === nodeC)).toBe(true);

      // nodeC's prerequisite on nodeB must be cleaned.
      const nodeCResult = chapter.nodes.find((n) => n.id === nodeC);
      expect(nodeCResult?.prerequisites).not.toContain(nodeB);

      // entry/boss pointers must still be valid.
      expect(chapter.entryNodeId).toBe(nodeA);
      expect(chapter.bossNodeId).toBe(nodeC);
    });

    it('returns 400 for duplicate node ids in body', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const chRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Chapter 1' },
      });
      const chapterId = chRes.json<{ id: string }>().id;

      const dupId = randomUUID();
      const res = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}/graph`,
        payload: {
          entryNodeId: null,
          bossNodeId: null,
          nodes: [
            {
              id: dupId,
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 0, y: 0 },
              prerequisites: [],
              config: {},
            },
            {
              id: dupId, // duplicate
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 100, y: 0 },
              prerequisites: [],
              config: {},
            },
          ],
          edges: [],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'duplicate_node_ids' });
    });

    it('returns 400 for invalid node config (battle without villainIds)', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const chRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Chapter 1' },
      });
      const chapterId = chRes.json<{ id: string }>().id;

      const res = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${chapterId}/graph`,
        payload: {
          entryNodeId: null,
          bossNodeId: null,
          nodes: [
            {
              id: randomUUID(),
              type: 'battle',
              mandatory: false,
              recommendedLevel: 1,
              participantLimit: null,
              position: { x: 0, y: 0 },
              prerequisites: [],
              config: {}, // missing villainIds — invalid
            },
          ],
          edges: [],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 409 when a node id belongs to another chapter', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // Chapter A with one node.
      const chARes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Chapter A' },
      });
      const chapterAId = chARes.json<{ id: string }>().id;

      // Chapter B.
      const chBRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Chapter B' },
      });
      const chapterBId = chBRes.json<{ id: string }>().id;

      const existingNodeId = randomUUID();

      // Put the node in chapter A.
      await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${chapterAId}/graph`,
        payload: {
          entryNodeId: null,
          bossNodeId: null,
          nodes: [
            {
              id: existingNodeId,
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 0, y: 0 },
              prerequisites: [],
              config: {},
            },
          ],
          edges: [],
        },
      });

      // Attempt to use the same node id in chapter B — must 409.
      const res = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${chapterBId}/graph`,
        payload: {
          entryNodeId: null,
          bossNodeId: null,
          nodes: [
            {
              id: existingNodeId,
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 0, y: 0 },
              prerequisites: [],
              config: {},
            },
          ],
          edges: [],
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'node_id_conflict' });
    });
  });
});

describe('chapter map background and node titles (prepared for the map editor)', () => {
  it('stores, returns and clears a chapter background, and persists node titles', async () => {
    const user = await signUp(app);
    const campaign = (
      await requestAs(app, user, { method: 'POST', url: '/api/campaigns', payload: { name: 'C' } })
    ).json<{ id: string }>();
    const base = `/api/campaigns/${campaign.id}/chapters`;
    const chapter = (
      await requestAs(app, user, { method: 'POST', url: base, payload: { name: 'Map' } })
    ).json<{ id: string }>();

    const background = {
      imageUrl: 'http://localhost:9000/rpg-chains-media/map.png',
      width: 2048,
      height: 1536,
    };
    const patched = await requestAs(app, user, {
      method: 'PATCH',
      url: `${base}/${chapter.id}`,
      payload: { background },
    });
    expect(patched.statusCode).toBe(200);

    const nodeId = randomUUID();
    await requestAs(app, user, {
      method: 'PUT',
      url: `${base}/${chapter.id}/graph`,
      payload: {
        entryNodeId: nodeId,
        bossNodeId: null,
        nodes: [
          {
            id: nodeId,
            title: 'Portão Norte',
            type: 'campfire',
            mandatory: false,
            recommendedLevel: null,
            participantLimit: null,
            position: { x: 1200, y: 340 },
            prerequisites: [],
            config: {},
          },
        ],
        edges: [],
      },
    });
    const loaded = (
      await requestAs(app, user, { method: 'GET', url: `${base}/${chapter.id}` })
    ).json();
    expect(loaded.background).toEqual(background);
    expect(loaded.nodes[0]).toMatchObject({ title: 'Portão Norte', position: { x: 1200, y: 340 } });

    await requestAs(app, user, {
      method: 'PATCH',
      url: `${base}/${chapter.id}`,
      payload: { background: null },
    });
    const cleared = (
      await requestAs(app, user, { method: 'GET', url: `${base}/${chapter.id}` })
    ).json();
    expect(cleared.background).toBeNull();
  });
});
