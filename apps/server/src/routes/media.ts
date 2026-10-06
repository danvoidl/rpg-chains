import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { s3 } from '../storage.js';

const EXTENSION_BY_CONTENT_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

const PRESIGN_EXPIRES_IN_SECONDS = 300;

const PresignBodySchema = z.object({
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  size: z.number().int().positive().max(config.MEDIA_MAX_UPLOAD_BYTES),
});

/** Media routes: presigned URLs for direct browser-to-S3 image uploads. */
export default async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.post('/presign', { preHandler: [app.authenticate] }, async (request) => {
    const { contentType, size } = PresignBodySchema.parse(request.body);
    const key = `users/${request.user!.id}/${randomUUID()}.${EXTENSION_BY_CONTENT_TYPE[contentType]}`;
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
