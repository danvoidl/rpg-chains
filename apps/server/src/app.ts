import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import errorsPlugin from './plugins/errors.js';
import campaignOwnerPlugin from './plugins/campaign-owner.js';
import healthRoutes from './routes/health.js';
import campaignsRoutes from './routes/campaigns.js';
import villainsRoutes from './routes/villains.js';
import questionsRoutes from './routes/questions.js';
import chaptersRoutes from './routes/chapters.js';
import campaignDraftRoutes from './routes/campaign-draft.js';
import mediaRoutes from './routes/media.js';
import campaignVersionRoutes from './routes/campaign-versions.js';

/**
 * Builds the Fastify app with every plugin and route registered, WITHOUT listening. Kept
 * separate from `server.ts` so contract tests can drive it via `app.inject()` (spec §6).
 * Feature routes register here under a prefix as they land (Fase 1+).
 */
export async function buildApp(options: { logger: boolean }): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger });

  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(errorsPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(campaignOwnerPlugin);
  await app.register(healthRoutes);
  await app.register(campaignsRoutes, { prefix: '/api/campaigns' });
  await app.register(villainsRoutes, { prefix: '/api/campaigns/:campaignId/villains' });
  await app.register(questionsRoutes, { prefix: '/api/campaigns/:campaignId/questions' });
  await app.register(chaptersRoutes, { prefix: '/api/campaigns/:campaignId/chapters' });
  await app.register(campaignDraftRoutes, { prefix: '/api/campaigns/:campaignId/draft' });
  await app.register(campaignVersionRoutes, { prefix: '/api/campaigns/:campaignId' });
  await app.register(mediaRoutes, { prefix: '/api/media' });

  return app;
}
