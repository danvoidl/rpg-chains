import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DraftVillain } from '@rpg-chains/shared-types';
import { createTestApp, resetDatabase, signUp, requestAs } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await app.close();
});

describe('villains REST routes', () => {
  describe('authentication & authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const getRes = await requestAs(app, null, {
        method: 'GET',
        url: '/api/campaigns/c123/villains',
      });
      expect(getRes.statusCode).toBe(401);

      const postRes = await requestAs(app, null, {
        method: 'POST',
        url: '/api/campaigns/c123/villains',
        payload: {
          name: 'Goblin',
          hp: 20,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      expect(postRes.statusCode).toBe(401);

      const putRes = await requestAs(app, null, {
        method: 'PUT',
        url: '/api/campaigns/c123/villains/v123',
        payload: {
          name: 'Goblin',
          hp: 20,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      expect(putRes.statusCode).toBe(401);

      const delRes = await requestAs(app, null, {
        method: 'DELETE',
        url: '/api/campaigns/c123/villains/v123',
      });
      expect(delRes.statusCode).toBe(401);
    });

    it('returns 404 for unknown campaign id', async () => {
      const user = await signUp(app, 'Author');

      const getRes = await requestAs(app, user, {
        method: 'GET',
        url: '/api/campaigns/nonexistent/villains',
      });
      expect(getRes.statusCode).toBe(404);
      expect(getRes.json()).toEqual({ error: 'campaign_not_found' });

      const postRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns/nonexistent/villains',
        payload: {
          name: 'Goblin',
          hp: 20,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      expect(postRes.statusCode).toBe(404);
      expect(postRes.json()).toEqual({ error: 'campaign_not_found' });

      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: '/api/campaigns/nonexistent/villains/v123',
        payload: {
          name: 'Goblin',
          hp: 20,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      expect(putRes.statusCode).toBe(404);
      expect(putRes.json()).toEqual({ error: 'campaign_not_found' });

      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: '/api/campaigns/nonexistent/villains/v123',
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json()).toEqual({ error: 'campaign_not_found' });
    });

    it("returns 403 when user B touches user A's campaign villains", async () => {
      const userA = await signUp(app, 'Author A');
      const userB = await signUp(app, 'Author B');

      const cRes = await requestAs(app, userA, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: "User A's Campaign" },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const vRes = await requestAs(app, userA, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Goblin',
          hp: 20,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      const villainId = vRes.json<{ id: string }>().id;

      const getRes = await requestAs(app, userB, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/villains`,
      });
      expect(getRes.statusCode).toBe(403);
      expect(getRes.json()).toEqual({ error: 'forbidden' });

      const postRes = await requestAs(app, userB, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Orc',
          hp: 30,
          strength: 8,
          dexterity: 4,
          intelligence: 3,
          defense: 6,
        },
      });
      expect(postRes.statusCode).toBe(403);
      expect(postRes.json()).toEqual({ error: 'forbidden' });

      const putRes = await requestAs(app, userB, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/villains/${villainId}`,
        payload: {
          name: 'Hijacked Goblin',
          hp: 20,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      expect(putRes.statusCode).toBe(403);
      expect(putRes.json()).toEqual({ error: 'forbidden' });

      const delRes = await requestAs(app, userB, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/villains/${villainId}`,
      });
      expect(delRes.statusCode).toBe(403);
      expect(delRes.json()).toEqual({ error: 'forbidden' });
    });
  });

  describe('CRUD operations & response format', () => {
    it('supports happy-path CRUD and conforms to DraftVillain shape', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'My Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // 1. Create villain with omitted attacks and unset imageUrl
      const createRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Shadow Stalker',
          hp: 150,
          strength: 18,
          dexterity: 22,
          intelligence: 10,
          defense: 8,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json<DraftVillain>();
      expect(created.name).toBe('Shadow Stalker');
      expect(created.imageUrl).toBeNull();
      expect(created.hp).toBe(150);
      expect(created.strength).toBe(18);
      expect(created.dexterity).toBe(22);
      expect(created.intelligence).toBe(10);
      expect(created.defense).toBe(8);
      expect(created.attacks).toEqual([]);

      // 2. Create second villain with imageUrl and attacks
      const createRes2 = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Abyssal Lich',
          imageUrl: 'https://example.com/lich.png',
          hp: 200,
          strength: 12,
          dexterity: 14,
          intelligence: 28,
          defense: 12,
          attacks: [
            {
              name: 'Shadow Bolt',
              baseDamage: 25,
              targetType: 'single',
              cooldownRounds: 0,
            },
          ],
        },
      });
      expect(createRes2.statusCode).toBe(201);
      const created2 = createRes2.json<DraftVillain>();
      expect(created2.name).toBe('Abyssal Lich');
      expect(created2.imageUrl).toBe('https://example.com/lich.png');
      expect(created2.attacks).toHaveLength(1);
      expect(created2.attacks[0].id).toBeTypeOf('string');
      expect(created2.attacks[0].name).toBe('Shadow Bolt');

      // 3. List villains — ordered by name ascending ('Abyssal Lich' before 'Shadow Stalker')
      const listRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/villains`,
      });
      expect(listRes.statusCode).toBe(200);
      const list = listRes.json<DraftVillain[]>();
      expect(list).toHaveLength(2);
      expect(list[0].name).toBe('Abyssal Lich');
      expect(list[1].name).toBe('Shadow Stalker');

      // 4. PUT (full replace) Shadow Stalker
      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/villains/${created.id}`,
        payload: {
          name: 'Shadow Stalker Awakened',
          imageUrl: 'https://example.com/stalker-awakened.png',
          hp: 250,
          strength: 25,
          dexterity: 30,
          intelligence: 15,
          defense: 12,
          attacks: [
            {
              name: 'Ambush',
              baseDamage: 40,
              targetType: 'single',
              cooldownRounds: 2,
            },
          ],
        },
      });
      expect(putRes.statusCode).toBe(200);
      const updated = putRes.json<DraftVillain>();
      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Shadow Stalker Awakened');
      expect(updated.imageUrl).toBe('https://example.com/stalker-awakened.png');
      expect(updated.hp).toBe(250);
      expect(updated.attacks).toHaveLength(1);
      expect(updated.attacks[0].name).toBe('Ambush');

      // 5. Delete both
      const del1 = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/villains/${created.id}`,
      });
      expect(del1.statusCode).toBe(204);

      const del2 = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/villains/${created2.id}`,
      });
      expect(del2.statusCode).toBe(204);

      // 6. List empty
      const listEmpty = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/villains`,
      });
      expect(listEmpty.statusCode).toBe(200);
      expect(listEmpty.json()).toEqual([]);
    });

    it('assigns randomUUID to attacks without id, and preserves existing attack id on PUT', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // Create with attack lacking id
      const createRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Ogre',
          hp: 100,
          strength: 20,
          dexterity: 5,
          intelligence: 2,
          defense: 10,
          attacks: [
            {
              name: 'Club Smash',
              baseDamage: 30,
              targetType: 'single',
              cooldownRounds: 1,
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const villain = createRes.json<DraftVillain>();
      const existingAttackId = villain.attacks[0].id;
      expect(existingAttackId).toBeTypeOf('string');
      expect(existingAttackId.length).toBeGreaterThan(0);

      // PUT: preserve existing attack id, and add a second attack without id
      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/villains/${villain.id}`,
        payload: {
          name: 'Ogre Chief',
          hp: 120,
          strength: 22,
          dexterity: 6,
          intelligence: 3,
          defense: 12,
          attacks: [
            {
              id: existingAttackId,
              name: 'Club Smash+',
              baseDamage: 35,
              targetType: 'single',
              cooldownRounds: 1,
            },
            {
              name: 'Ground Slam',
              baseDamage: 25,
              targetType: 'area',
              cooldownRounds: 3,
            },
          ],
        },
      });
      expect(putRes.statusCode).toBe(200);
      const updated = putRes.json<DraftVillain>();
      expect(updated.attacks).toHaveLength(2);
      expect(updated.attacks[0].id).toBe(existingAttackId);
      expect(updated.attacks[0].name).toBe('Club Smash+');
      expect(updated.attacks[1].id).toBeTypeOf('string');
      expect(updated.attacks[1].id).not.toBe(existingAttackId);
      expect(updated.attacks[1].name).toBe('Ground Slam');
    });
  });

  describe('scoping & not-found', () => {
    it('returns 404 when a villain id from campaign X is accessed under campaign Y of the same owner', async () => {
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

      const vX = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignXId}/villains`,
        payload: {
          name: 'Goblin X',
          hp: 10,
          strength: 1,
          dexterity: 1,
          intelligence: 1,
          defense: 1,
        },
      });
      const villainXId = vX.json<DraftVillain>().id;

      // Access villain X under campaign Y
      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignYId}/villains/${villainXId}`,
        payload: {
          name: 'Goblin Y',
          hp: 10,
          strength: 1,
          dexterity: 1,
          intelligence: 1,
          defense: 1,
        },
      });
      expect(putRes.statusCode).toBe(404);
      expect(putRes.json()).toEqual({ error: 'villain_not_found' });

      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignYId}/villains/${villainXId}`,
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json()).toEqual({ error: 'villain_not_found' });
    });

    it('returns 404 for unknown villain id in the campaign', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/villains/unknown-villain-id`,
        payload: {
          name: 'Nonexistent',
          hp: 10,
          strength: 1,
          dexterity: 1,
          intelligence: 1,
          defense: 1,
        },
      });
      expect(putRes.statusCode).toBe(404);
      expect(putRes.json()).toEqual({ error: 'villain_not_found' });

      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/villains/unknown-villain-id`,
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json()).toEqual({ error: 'villain_not_found' });
    });
  });

  describe('validation', () => {
    it('returns 400 on invalid villain bodies', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // Negative hp
      const negHpRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Goblin',
          hp: -5,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      expect(negHpRes.statusCode).toBe(400);

      // Zero hp (must be positive)
      const zeroHpRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Goblin',
          hp: 0,
          strength: 5,
          dexterity: 5,
          intelligence: 5,
          defense: 5,
        },
      });
      expect(zeroHpRes.statusCode).toBe(400);

      // Empty name
      const emptyNameRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: '',
          hp: 10,
          strength: 1,
          dexterity: 1,
          intelligence: 1,
          defense: 1,
        },
      });
      expect(emptyNameRes.statusCode).toBe(400);

      // Negative strength (must be non-negative)
      const negStrengthRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Goblin',
          hp: 10,
          strength: -1,
          dexterity: 1,
          intelligence: 1,
          defense: 1,
        },
      });
      expect(negStrengthRes.statusCode).toBe(400);

      // Invalid imageUrl format
      const invalidUrlRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/villains`,
        payload: {
          name: 'Goblin',
          imageUrl: 'not-a-valid-url',
          hp: 10,
          strength: 1,
          dexterity: 1,
          intelligence: 1,
          defense: 1,
        },
      });
      expect(invalidUrlRes.statusCode).toBe(400);
    });
  });
});
