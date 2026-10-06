import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Question } from '@rpg-chains/shared-types';
import { createTestApp, resetDatabase, signUp, requestAs } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await app.close();
});

describe('questions REST routes', () => {
  describe('authentication & authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const getRes = await requestAs(app, null, {
        method: 'GET',
        url: '/api/campaigns/c123/questions',
      });
      expect(getRes.statusCode).toBe(401);

      const postRes = await requestAs(app, null, {
        method: 'POST',
        url: '/api/campaigns/c123/questions',
        payload: {
          type: 'open',
          prompt: 'What is your quest?',
        },
      });
      expect(postRes.statusCode).toBe(401);

      const putRes = await requestAs(app, null, {
        method: 'PUT',
        url: '/api/campaigns/c123/questions/q123',
        payload: {
          type: 'open',
          prompt: 'What is your quest?',
        },
      });
      expect(putRes.statusCode).toBe(401);

      const delRes = await requestAs(app, null, {
        method: 'DELETE',
        url: '/api/campaigns/c123/questions/q123',
      });
      expect(delRes.statusCode).toBe(401);
    });

    it('returns 404 for unknown campaign id', async () => {
      const user = await signUp(app, 'Author');

      const getRes = await requestAs(app, user, {
        method: 'GET',
        url: '/api/campaigns/nonexistent/questions',
      });
      expect(getRes.statusCode).toBe(404);
      expect(getRes.json()).toEqual({ error: 'campaign_not_found' });

      const postRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns/nonexistent/questions',
        payload: {
          type: 'open',
          prompt: 'What is your quest?',
        },
      });
      expect(postRes.statusCode).toBe(404);
      expect(postRes.json()).toEqual({ error: 'campaign_not_found' });

      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: '/api/campaigns/nonexistent/questions/q123',
        payload: {
          type: 'open',
          prompt: 'What is your quest?',
        },
      });
      expect(putRes.statusCode).toBe(404);
      expect(putRes.json()).toEqual({ error: 'campaign_not_found' });

      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: '/api/campaigns/nonexistent/questions/q123',
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json()).toEqual({ error: 'campaign_not_found' });
    });

    it("returns 403 when user B touches user A's campaign questions", async () => {
      const userA = await signUp(app, 'Author A');
      const userB = await signUp(app, 'Author B');

      const cRes = await requestAs(app, userA, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: "User A's Campaign" },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const qRes = await requestAs(app, userA, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'open',
          prompt: 'Secret challenge',
        },
      });
      const questionId = qRes.json<{ id: string }>().id;

      const getRes = await requestAs(app, userB, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/questions`,
      });
      expect(getRes.statusCode).toBe(403);
      expect(getRes.json()).toEqual({ error: 'forbidden' });

      const postRes = await requestAs(app, userB, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'open',
          prompt: 'Hijack prompt',
        },
      });
      expect(postRes.statusCode).toBe(403);
      expect(postRes.json()).toEqual({ error: 'forbidden' });

      const putRes = await requestAs(app, userB, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/questions/${questionId}`,
        payload: {
          type: 'open',
          prompt: 'Hijacked challenge',
        },
      });
      expect(putRes.statusCode).toBe(403);
      expect(putRes.json()).toEqual({ error: 'forbidden' });

      const delRes = await requestAs(app, userB, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/questions/${questionId}`,
      });
      expect(delRes.statusCode).toBe(403);
      expect(delRes.json()).toEqual({ error: 'forbidden' });
    });
  });

  describe('CRUD operations & response format', () => {
    it('supports happy-path CRUD and conforms to Question schema shapes', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'My Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // 1. Create objective question
      const createObjRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'objective',
          prompt: 'Qual é o elemento mais resistente?',
          options: ['Ferro Negro', 'Adamantita', 'Mitril'],
          correctIndex: 1,
        },
      });
      expect(createObjRes.statusCode).toBe(201);
      const createdObj = createObjRes.json<Question>();
      expect(createdObj.type).toBe('objective');
      expect(createdObj.id).toBeTypeOf('string');
      expect(createdObj.prompt).toBe('Qual é o elemento mais resistente?');
      if (createdObj.type === 'objective') {
        expect(createdObj.options).toEqual(['Ferro Negro', 'Adamantita', 'Mitril']);
        expect(createdObj.correctIndex).toBe(1);
      }

      // 2. Create open question
      const createOpenRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'open',
          prompt: 'Como vocês pretendem desarmar a armadilha de runas?',
        },
      });
      expect(createOpenRes.statusCode).toBe(201);
      const createdOpen = createOpenRes.json<Question>();
      expect(createdOpen.type).toBe('open');
      expect(createdOpen.id).toBeTypeOf('string');
      expect(createdOpen.prompt).toBe('Como vocês pretendem desarmar a armadilha de runas?');
      // Ensure open questions do not expose options or correctIndex
      expect((createdOpen as unknown as { options?: unknown }).options).toBeUndefined();
      expect((createdOpen as unknown as { correctIndex?: unknown }).correctIndex).toBeUndefined();

      // 3. List both questions
      const listRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/questions`,
      });
      expect(listRes.statusCode).toBe(200);
      const list = listRes.json<Question[]>();
      expect(list).toHaveLength(2);

      // 4. PUT replace objective question with updated objective question
      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/questions/${createdObj.id}`,
        payload: {
          type: 'objective',
          prompt: 'Qual é o metal mais raro?',
          options: ['Oricalco', 'Adamantita', 'Mitril'],
          correctIndex: 0,
        },
      });
      expect(putRes.statusCode).toBe(200);
      const updatedObj = putRes.json<Question>();
      expect(updatedObj.id).toBe(createdObj.id);
      expect(updatedObj.prompt).toBe('Qual é o metal mais raro?');
      if (updatedObj.type === 'objective') {
        expect(updatedObj.options).toEqual(['Oricalco', 'Adamantita', 'Mitril']);
        expect(updatedObj.correctIndex).toBe(0);
      }

      // 5. PUT replace open question into an objective question
      const putToObjRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/questions/${createdOpen.id}`,
        payload: {
          type: 'objective',
          prompt: 'Armadilha desarmada?',
          options: ['Sim', 'Não'],
          correctIndex: 0,
        },
      });
      expect(putToObjRes.statusCode).toBe(200);
      const converted = putToObjRes.json<Question>();
      expect(converted.type).toBe('objective');

      // 6. Delete both
      const del1 = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/questions/${createdObj.id}`,
      });
      expect(del1.statusCode).toBe(204);

      const del2 = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/questions/${createdOpen.id}`,
      });
      expect(del2.statusCode).toBe(204);

      // 7. List empty
      const listEmpty = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/questions`,
      });
      expect(listEmpty.statusCode).toBe(200);
      expect(listEmpty.json()).toEqual([]);
    });

    it('filters questions by ?type= query parameter', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'objective',
          prompt: 'Objective 1',
          options: ['Option A', 'Option B'],
          correctIndex: 0,
        },
      });

      await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'open',
          prompt: 'Open 1',
        },
      });

      // Filter objective
      const objListRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/questions?type=objective`,
      });
      expect(objListRes.statusCode).toBe(200);
      const objList = objListRes.json<Question[]>();
      expect(objList).toHaveLength(1);
      expect(objList[0].type).toBe('objective');
      expect(objList[0].prompt).toBe('Objective 1');

      // Filter open
      const openListRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/questions?type=open`,
      });
      expect(openListRes.statusCode).toBe(200);
      const openList = openListRes.json<Question[]>();
      expect(openList).toHaveLength(1);
      expect(openList[0].type).toBe('open');
      expect(openList[0].prompt).toBe('Open 1');

      // Invalid filter → 400
      const invalidQueryRes = await requestAs(app, user, {
        method: 'GET',
        url: `/api/campaigns/${campaignId}/questions?type=unsupported`,
      });
      expect(invalidQueryRes.statusCode).toBe(400);
    });
  });

  describe('scoping & not-found', () => {
    it('returns 404 when a question id from campaign X is accessed under campaign Y of the same owner', async () => {
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

      const qX = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignXId}/questions`,
        payload: {
          type: 'open',
          prompt: 'Prompt in campaign X',
        },
      });
      const questionXId = qX.json<Question>().id;

      // Access question X under campaign Y
      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignYId}/questions/${questionXId}`,
        payload: {
          type: 'open',
          prompt: 'Hijacked Prompt',
        },
      });
      expect(putRes.statusCode).toBe(404);
      expect(putRes.json()).toEqual({ error: 'question_not_found' });

      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignYId}/questions/${questionXId}`,
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json()).toEqual({ error: 'question_not_found' });
    });

    it('returns 404 for unknown question id in the campaign', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      const putRes = await requestAs(app, user, {
        method: 'PUT',
        url: `/api/campaigns/${campaignId}/questions/nonexistent-question-id`,
        payload: {
          type: 'open',
          prompt: 'Prompt',
        },
      });
      expect(putRes.statusCode).toBe(404);
      expect(putRes.json()).toEqual({ error: 'question_not_found' });

      const delRes = await requestAs(app, user, {
        method: 'DELETE',
        url: `/api/campaigns/${campaignId}/questions/nonexistent-question-id`,
      });
      expect(delRes.statusCode).toBe(404);
      expect(delRes.json()).toEqual({ error: 'question_not_found' });
    });
  });

  describe('validation', () => {
    it('returns 400 on invalid question bodies', async () => {
      const user = await signUp(app, 'Author');
      const cRes = await requestAs(app, user, {
        method: 'POST',
        url: '/api/campaigns',
        payload: { name: 'Campaign' },
      });
      const campaignId = cRes.json<{ id: string }>().id;

      // Objective question with only 1 option (min 2 required)
      const oneOptionRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'objective',
          prompt: 'Question?',
          options: ['Only Option'],
          correctIndex: 0,
        },
      });
      expect(oneOptionRes.statusCode).toBe(400);

      // Objective question with correctIndex out of range
      const outOfRangeRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'objective',
          prompt: 'Question?',
          options: ['Option 1', 'Option 2'],
          correctIndex: 2,
        },
      });
      expect(outOfRangeRes.statusCode).toBe(400);

      // Objective question with negative correctIndex
      const negativeIndexRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'objective',
          prompt: 'Question?',
          options: ['Option 1', 'Option 2'],
          correctIndex: -1,
        },
      });
      expect(negativeIndexRes.statusCode).toBe(400);

      // Empty prompt
      const emptyPromptRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'open',
          prompt: '',
        },
      });
      expect(emptyPromptRes.statusCode).toBe(400);

      // Whitespace prompt
      const whitespacePromptRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'open',
          prompt: '   ',
        },
      });
      expect(whitespacePromptRes.statusCode).toBe(400);

      // Invalid type
      const invalidTypeRes = await requestAs(app, user, {
        method: 'POST',
        url: `/api/campaigns/${campaignId}/questions`,
        payload: {
          type: 'multiple_choice',
          prompt: 'Invalid type prompt',
        },
      });
      expect(invalidTypeRes.statusCode).toBe(400);
    });
  });
});
