import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { s3 } from '../storage.js';
import { reserveUpload, type MediaQuotas } from '../services/media-quota.js';

const EXTENSION_BY_CONTENT_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;

const PRESIGN_EXPIRES_IN_SECONDS = 300;

/** Videos (chapter openings and narratives, Fase 5 plan decision 11) have their own ceiling. */
const PresignBodySchema = z
  .object({
    contentType: z.enum([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
    ]),
    size: z.number().int().positive(),
  })
  .refine(
    ({ contentType, size }) =>
      size <=
      (contentType.startsWith('video/')
        ? config.MEDIA_MAX_VIDEO_BYTES
        : config.MEDIA_MAX_UPLOAD_BYTES),
    { message: 'File too large', path: ['size'] },
  );

/**
 * Media routes: presigned URLs for direct browser-to-S3 image and video uploads. Signing is the
 * only way into the bucket, so every signature first passes the upload quotas (429 otherwise).
 */
export default async function mediaRoutes(
  app: FastifyInstance,
  quotas: MediaQuotas,
): Promise<void> {
  app.post('/presign', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { contentType, size } = PresignBodySchema.parse(request.body);
    const userId = request.user!.id;
    const key = `users/${userId}/${randomUUID()}.${EXTENSION_BY_CONTENT_TYPE[contentType]}`;
    const exceeded = await app.prisma.$transaction((tx) =>
      reserveUpload(tx, { userId, key, contentType, size }, quotas, new Date()),
    );
    if (exceeded) return reply.code(429).send({ error: 'upload_quota_exceeded', quota: exceeded });
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      }),
      { expiresIn: PRESIGN_EXPIRES_IN_SECONDS },
    );
    return {
      uploadUrl,
      publicUrl: `${config.S3_PUBLIC_BASE_URL}/${key}`,
      key,
      headers: { 'Content-Type': contentType },
    };
  });
}
