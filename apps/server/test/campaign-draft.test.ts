import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { CampaignDraftSchema, type CampaignDraft } from '@rpg-chains/shared-types';
import { createTestApp, resetDatabase, signUp, requestAs } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await app.close();
});

describe('campaign-draft REST routes', () => {
  describe('authentication & authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await requestAs(app, null, {
        method: 'GET',
        url: '/api/campaigns/c123/draft',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 for unknown campaign id', async () => {
      const user = await signUp(app, 'Author');
      const res = await requestAs(app, user, {
        method: 'GET',
        url: '/api/campaigns/nonexistent/draft',
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'campaign_not_found' });
    });

    it("returns 403 when user B reads user A's campaign draft", async () => {
      const userA = await signUp(app, 'Author A');
      const userB = await signUp(app, 'Author B');

      const cRes = await requestAs(app, userA, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: "User A's Campaign" },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const res = await requestAs(app, userB, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/draft`,
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'forbidden' });
    });
  });

  describe('GET /draft — content and ordering', () => {
    it('returns the full campaign draft with chapters, villains and questions', async () => {
      const user = await signUp(app, 'Author');

      // Create campaign.
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Epic Adventure', description: 'A grand quest' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // Create chapters in non-sequential order to verify ordering.
      const ch2Res = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Act II', order: 2 },
      });
      const ch2Id = ch2Res.json<{ id: string }>().id;

      const ch1Res = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Prologue', order: 0 },
      });
      const ch1Id = ch1Res.json<{ id: string }>().id;

      const ch1bRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/chapters`,
        payload: { name: 'Act I', order: 1 },
      });
      const ch1bId = ch1bRes.json<{ id: string }>().id;

      // Add a graph to one chapter.
      const nodeId = randomUUID();
      await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/chapters/${ch1Id}/graph`,
        payload: {
          entryNodeId: nodeId,
          bossNodeId: null,
          nodes: [
            {
              id: nodeId,
              type: 'campfire',
              mandatory: false,
              recommendedLevel: null,
              participantLimit: null,
              position: { x: 10, y: 20 },
              prerequisites: [],
              config: {},
            },
          ],
          edges: [],
        },
      });

      // Create a villain.
      const vRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Dragon',
          hp: 500,
          strength: 30,
          dexterity: 15,
          intelligence: 20,
          defense: 25,
        },
      });
      expect(vRes.statusCode).toBe(201);

      // Create a question.
      const qRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: { type: 'open', prompt: 'What is your name?' },
      });
      expect(qRes.statusCode).toBe(201);

      // Fetch the draft.
      const draftRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/draft`,
      });
      expect(draftRes.statusCode).toBe(200);

      const draft = draftRes.json<CampaignDraft>();

      // Must parse cleanly with CampaignDraftSchema.
      expect(() => CampaignDraftSchema.parse(draft)).not.toThrow();

      // Top-level fields.
      expect(draft.id).toBe(campaignId);
      expect(draft.name).toBe('Epic Adventure');
      expect(draft.description).toBe('A grand quest');

      // Chapters ordered by order asc.
      expect(draft.chapters).toHaveLength(3);
      expect(draft.chapters[0].id).toBe(ch1Id);
      expect(draft.chapters[0].order).toBe(0);
      expect(draft.chapters[1].id).toBe(ch1bId);
      expect(draft.chapters[1].order).toBe(1);
      expect(draft.chapters[2].id).toBe(ch2Id);
      expect(draft.chapters[2].order).toBe(2);

      // First chapter has the node we put.
      expect(draft.chapters[0].nodes).toHaveLength(1);
      expect(draft.chapters[0].nodes[0].id).toBe(nodeId);
      expect(draft.chapters[0].nodes[0].position).toEqual({ x: 10, y: 20 });
      expect(draft.chapters[0].entryNodeId).toBe(nodeId);

      // Villains included.
      expect(draft.villains).toHaveLength(1);
      expect(draft.villains[0].name).toBe('Dragon');

      // Questions included.
      expect(draft.questions).toHaveLength(1);
      expect(draft.questions[0].prompt).toBe('What is your name?');
    });

    it('returns an empty draft for a fresh campaign', async () => {
      const user = await signUp(app, 'Author');

      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Empty Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const draftRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/draft`,
      });
      expect(draftRes.statusCode).toBe(200);

      const draft = draftRes.json<CampaignDraft>();
      expect(() => CampaignDraftSchema.parse(draft)).not.toThrow();
      expect(draft.chapters).toEqual([]);
      expect(draft.villains).toEqual([]);
      expect(draft.questions).toEqual([]);
    });
  });
});
