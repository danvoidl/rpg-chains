import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, resetDatabase, signUp, requestAs } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await app.close();
});

describe('campaigns REST routes', () => {
  describe('authentication & authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const getList = await requestAs(app, null, { method: 'GET', url: '/api/campaigns' });
      expect(getList.statusCode).toBe(401);

      const post = await requestAs(app, null, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Unauthorized' },
      });
      expect(post.statusCode).toBe(401);

      const getOne = await requestAs(app, null, { method: 'GET', url: '/api/campaigns/c123' });
      expect(getOne.statusCode).toBe(401);

      const patch = await requestAs(app, null, {
        method: 'PATCH',
        url: '/api/campaigns/c123',
        payload: { name: 'Unauthorized' },
      });
      expect(patch.statusCode).toBe(401);

      const del = await requestAs(app, null, { method: 'DELETE', url: '/api/campaigns/c123' });
      expect(del.statusCode).toBe(401);
    });

    it('returns 404 for unknown campaign id', async () => {
      const user = await signUp(app, 'Author');

      const getRes = await requestAs(app, user, {
        method: 'GET',
        url: '/api/campaigns/nonexistent',
      });
      expect(getRes.statusCode).toBe(404);
      expect(getRes.json()).toEqual({ error: 'campaign_not_found' });

      const patchRes = await requestAs(app, user, {
        method: 'PATCH',
        url: '/api/campaigns/nonexistent',
        payload: { name: 'New' },
      });
      expect(patchRes.statusCode).toBe(404);
      expect(patchRes.json()).toEqual({ error: 'campaign_not_found' });

      const deleteRes = await requestAs(app, user, {
        method: 'DELETE',
        url: '/api/campaigns/nonexistent',
      });
      expect(deleteRes.statusCode).toBe(404);
      expect(deleteRes.json()).toEqual({ error: 'campaign_not_found' });
    });

    it("returns 403 when user B touches user A's campaign", async () => {
      const userA = await signUp(app, 'Author A');
      const userB = await signUp(app, 'Author B');

      const createRes = await requestAs(app, userA, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: "User A's Campaign", description: 'A secret campaign' },
      });
      expect(createRes.statusCode).toBe(201);
      const campaignId = createRes.json<{ id: string }>().id;

      const getRes = await requestAs(app, userB, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}`,
      });
      expect(getRes.statusCode).toBe(403);
      expect(getRes.json()).toEqual({ error: 'forbidden' });

      const patchRes = await requestAs(app, userB, {
        method: 'PATCH',
        url: `/api/campaigns/${campaignId}`,
        payload: { name: 'Hijacked' },
      });
      expect(patchRes.statusCode).toBe(403);
      expect(patchRes.json()).toEqual({ error: 'forbidden' });

      const deleteRes = await requestAs(app, userB, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}`,
      });
      expect(deleteRes.statusCode).toBe(403);
      expect(deleteRes.json()).toEqual({ error: 'forbidden' });
    });
  });

  describe('CRUD operations & isolation', () => {
    it('supports happy-path CRUD (create → list → get → update → delete → list empty)', async () => {
      const user = await signUp(app, 'Author');

      // Create
      const createRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'As Sete Correntes', description: 'Epic fantasy adventure' },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json<{
        id: string;
        name: string;
        description: string;
        createdAt: string;
        updatedAt: string;
      }>();
      expect(created.name).toBe('As Sete Correntes');
      expect(created.description).toBe('Epic fantasy adventure');
      expect(created.id).toBeTypeOf('string');

      // List
      const listRes = await requestAs(app, user, { method: 'GET', url: '/api/campaigns' });
      expect(listRes.statusCode).toBe(200);
      const list = listRes.json<(typeof created)[]>();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(created.id);
      expect(list[0].name).toBe('As Sete Correntes');

      // Get
      const getRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${created.id}`,
      });
      expect(getRes.statusCode).toBe(200);
      const retrieved = getRes.json<typeof created>();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('As Sete Correntes');

      // Update
      const patchRes = await requestAs(app, user, {
        method: 'PATCH',
        url: `/api/campaigns/${created.id}`,
        payload: { name: 'As Sete Correntes: Remastered', description: 'Updated desc' },
      });
      expect(patchRes.statusCode).toBe(200);
      const updated = patchRes.json<typeof created>();
      expect(updated.name).toBe('As Sete Correntes: Remastered');
      expect(updated.description).toBe('Updated desc');

      // Delete
      const deleteRes = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${created.id}`,
      });
      expect(deleteRes.statusCode).toBe(204);
      expect(deleteRes.body).toBe('');

      // List empty
      const listEmptyRes = await requestAs(app, user, { method: 'GET', url: '/api/campaigns' });
      expect(listEmptyRes.statusCode).toBe(200);
      expect(listEmptyRes.json()).toEqual([]);
    });

    it("lists only the caller's campaigns ordered by updatedAt desc", async () => {
      const userA = await signUp(app, 'Author A');
      const userB = await signUp(app, 'Author B');

      const resA1 = await requestAs(app, userA, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign A1' },
      });
      const cA1 = resA1.json<{ id: string }>();

      // Wait a tiny tick so updatedAt differs
      await new Promise((r) => setTimeout(r, 50));

      const resA2 = await requestAs(app, userA, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign A2' },
      });
      const cA2 = resA2.json<{ id: string }>();

      await requestAs(app, userB, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign B1' },
      });

      const listA = await requestAs(app, userA, { method: 'GET', url: '/api/campaigns' });
      expect(listA.statusCode).toBe(200);
      const campaignsA = listA.json<{ id: string; name: string }[]>();
      expect(campaignsA).toHaveLength(2);
      expect(campaignsA[0].id).toBe(cA2.id);
      expect(campaignsA[1].id).toBe(cA1.id);

      const listB = await requestAs(app, userB, { method: 'GET', url: '/api/campaigns' });
      expect(listB.statusCode).toBe(200);
      const campaignsB = listB.json<{ id: string; name: string }[]>();
      expect(campaignsB).toHaveLength(1);
      expect(campaignsB[0].name).toBe('Campaign B1');
    });
  });

  describe('validation', () => {
    it('returns 400 on invalid bodies', async () => {
      const user = await signUp(app, 'Author');

      // Empty name on create
      const emptyNameRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: '' },
      });
      expect(emptyNameRes.statusCode).toBe(400);
      expect(emptyNameRes.json<{ error: string }>().error).toBe('invalid_body');

      // Whitespace name on create
      const whitespaceNameRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: '   ' },
      });
      expect(whitespaceNameRes.statusCode).toBe(400);

      // Missing name on create
      const missingNameRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { description: 'Missing name' },
      });
      expect(missingNameRes.statusCode).toBe(400);

      // Create a valid campaign to test PATCH
      const valid = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Valid campaign' },
      });
      const campaignId = valid.json<{ id: string }>().id;

      // Empty name on patch
      const emptyPatchRes = await requestAs(app, user, {
        method: 'PATCH',
        url: `/api/campaigns/${campaignId}`,
        payload: { name: '' },
      });
      expect(emptyPatchRes.statusCode).toBe(400);
    });
  });
});
