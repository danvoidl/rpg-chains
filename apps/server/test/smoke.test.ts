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

describe('test harness', () => {
  it('signs up a user and resolves its session', async () => {
    const user = await signUp(app);
    const res = await requestAs(app, user, { method: 'GET', url: '/api/auth/get-session' });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(user.id);
  });
});
