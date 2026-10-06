import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import healthRoutes from './routes/health.js';

/**
 * Builds the Fastify app with every plugin and route registered, WITHOUT listening. Kept
 * separate from `server.ts` so contract tests can drive it via `app.inject()` (spec §6).
 * Feature routes register here under a prefix as they land (Fase 1+).
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(healthRoutes);
  // Fase 1+: await app.register(campaignRoutes, { prefix: '/api/campaigns' }); etc.

  return app;
}
