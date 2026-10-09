import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config } from '../src/config.js';
import { createTestApp, resetDatabase, signUp, requestAs, type TestUser } from './helpers.js';

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

  it('takes a video up to its own, larger ceiling (Fase 5 plan decision 11)', async () => {
    const user = await signUp(app);
    const presign = (contentType: string, size: number) =>
      requestAs(app, user, {
        method: 'POST',
        url: '/api/media/presign',
        payload: { contentType, size },
      });
    const video = await presign('video/mp4', config.MEDIA_MAX_UPLOAD_BYTES + 1);
    expect(video.statusCode).toBe(200);
    expect(video.json<{ key: string }>().key.endsWith('.mp4')).toBe(true);
    expect((await presign('video/webm', config.MEDIA_MAX_VIDEO_BYTES + 1)).statusCode).toBe(400);
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

describe('upload quotas', () => {
  const KB = 1024;
  let quotaApp: FastifyInstance;

  beforeEach(async () => {
    // Small limits: 3 uploads a day, 10 KB per user, 16 KB for everyone together.
    quotaApp ??= await createTestApp({
      media: { userDailyUploads: 3, userBytes: 10 * KB, totalBytes: 16 * KB },
    });
    await resetDatabase(quotaApp);
  });

  afterAll(async () => {
    await quotaApp.close();
  });

  const presign = (user: TestUser, size: number) =>
    requestAs(quotaApp, user, {
      method: 'POST',
      url: '/api/media/presign',
      payload: { contentType: 'image/png', size },
    });

  it('refuses the upload past the daily count, naming the quota', async () => {
    const user = await signUp(quotaApp);
    for (let i = 0; i < 3; i++) expect((await presign(user, KB)).statusCode).toBe(200);
    const refused = await presign(user, KB);
    expect(refused.statusCode).toBe(429);
    expect(refused.json()).toEqual({ error: 'upload_quota_exceeded', quota: 'daily' });
  });

  it('counts uploads in a rolling 24 h: older ones free the daily count, not the bytes', async () => {
    const user = await signUp(quotaApp);
    for (let i = 0; i < 3; i++) expect((await presign(user, 2 * KB)).statusCode).toBe(200);
    await quotaApp.prisma.mediaUpload.updateMany({
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    expect((await presign(user, 2 * KB)).statusCode).toBe(200);
    // 4 × 2 KB stored; another 4 KB would pass the 10 KB per user.
    expect((await presign(user, 4 * KB)).json()).toMatchObject({ quota: 'user' });
  });

  it("refuses an upload that would pass the user's bytes, and records nothing", async () => {
    const user = await signUp(quotaApp);
    expect((await presign(user, 8 * KB)).statusCode).toBe(200);
    const refused = await presign(user, 3 * KB);
    expect(refused.statusCode).toBe(429);
    expect(refused.json()).toMatchObject({ quota: 'user' });
    expect(await quotaApp.prisma.mediaUpload.count()).toBe(1);
    expect((await presign(user, 2 * KB)).statusCode).toBe(200);
  });

  it('holds the total ceiling across accounts', async () => {
    const [a, b] = [await signUp(quotaApp), await signUp(quotaApp)];
    expect((await presign(a, 9 * KB)).statusCode).toBe(200);
    expect((await presign(b, 7 * KB)).statusCode).toBe(200);
    expect((await presign(b, 1)).json()).toMatchObject({ quota: 'total' });
  });

  it('lets no burst of concurrent requests past a limit', async () => {
    const user = await signUp(quotaApp);
    const results = await Promise.all(Array.from({ length: 10 }, () => presign(user, KB)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(3);
    expect(results.filter((r) => r.statusCode === 429)).toHaveLength(7);
    expect(await quotaApp.prisma.mediaUpload.count()).toBe(3);
  });
});
