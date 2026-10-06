import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config } from '../src/config.js';
import { createTestApp, resetDatabase, signUp, requestAs } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await app.close();
});

describe('media REST routes', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await requestAs(app, null, {
      method: 'POST',
      url: '/api/media/presign',
      payload: { contentType: 'image/png', size: 1024 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for a disallowed content type', async () => {
    const user = await signUp(app);
    const res = await requestAs(app, user, {
      method: 'POST',
      url: '/api/media/presign',
      payload: { contentType: 'text/plain', size: 1024 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when size exceeds the maximum', async () => {
    const user = await signUp(app);
    const res = await requestAs(app, user, {
      method: 'POST',
      url: '/api/media/presign',
      payload: { contentType: 'image/png', size: config.MEDIA_MAX_UPLOAD_BYTES + 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns a presigned upload url for a valid request', async () => {
    const user = await signUp(app);
    const res = await requestAs(app, user, {
      method: 'POST',
      url: '/api/media/presign',
      payload: { contentType: 'image/png', size: 1024 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      uploadUrl: string;
      publicUrl: string;
      key: string;
      headers: Record<string, string>;
    }>();
    expect(body.key.startsWith(`users/${user.id}/`)).toBe(true);
    expect(body.key.endsWith('.png')).toBe(true);
    expect(body.publicUrl).toBe(`${config.S3_PUBLIC_BASE_URL}/${body.key}`);
    expect(body.uploadUrl).toContain('X-Amz-Signature');
    expect(body.headers).toEqual({ 'Content-Type': 'image/png' });
  });
});
