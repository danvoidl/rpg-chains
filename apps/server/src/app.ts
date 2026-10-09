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
import type { MediaQuotas } from './services/media-quota.js';
import campaignVersionRoutes from './routes/campaign-versions.js';
import itemsRoutes from './routes/items.js';
import classesRoutes from './routes/classes.js';
import classKitRoutes from './routes/class-kit.js';
import { randomInt } from 'node:crypto';
import { BATTLE_TIMERS, RECONNECT_GRACE_MS, TRADE_OFFER_TIMEOUT_MS } from '@rpg-chains/game-config';
import battlesPlugin, { type BattlesPluginOptions } from './plugins/battles.js';
import realtimePlugin from './plugins/realtime.js';
import catalogRoutes from './routes/catalog.js';
import roomsRoutes from './routes/rooms.js';
import roomProfileRoutes from './routes/room-profile.js';
import roomMasterRoutes from './routes/room-master.js';
import campfireRoutes from './routes/campfires.js';
import narrativeRoutes from './routes/narratives.js';
import historyRoutes from './routes/history.js';
import profileProgressRoutes from './routes/profile-progress.js';
import profileItemsRoutes from './routes/profile-items.js';
import shopsRoutes from './routes/shops.js';
import tradesRoutes from './routes/trades.js';
import tradesPlugin, { type TradesPluginOptions } from './plugins/trades.js';
import battlesRoutes from './routes/battles.js';

export interface AppOptions {
  logger: boolean;
  /** Overrides for tests: short turn timers, a fixed seed, a short reconnection grace. */
  battles?: Partial<BattlesPluginOptions>;
  /** Overrides for tests: a short trade offer timeout, no restore. */
  trades?: Partial<TradesPluginOptions>;
  /** Overrides for tests: small upload quotas. */
  media?: Partial<MediaQuotas>;
}

/**
 * Builds the Fastify app with every plugin and route registered (Socket.IO included), WITHOUT
 * listening. Kept
 * separate from `server.ts` so contract tests can drive it via `app.inject()` (spec §6).
 * Feature routes register here under a prefix as they land (Fase 1+).
 */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
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
  await app.register(battlesPlugin, {
    timers: BATTLE_TIMERS,
    seed: () => randomInt(2 ** 31),
    reconnectGraceMs: RECONNECT_GRACE_MS,
    restore: true,
    ...options.battles,
  });
  await app.register(realtimePlugin);
  await app.register(tradesPlugin, {
    timeoutMs: TRADE_OFFER_TIMEOUT_MS,
    restore: true,
    ...options.trades,
  });
  await app.register(healthRoutes);
  await app.register(campaignsRoutes, { prefix: '/api/campaigns' });
  await app.register(villainsRoutes, { prefix: '/api/campaigns/:campaignId/villains' });
  await app.register(questionsRoutes, { prefix: '/api/campaigns/:campaignId/questions' });
  await app.register(chaptersRoutes, { prefix: '/api/campaigns/:campaignId/chapters' });
  await app.register(itemsRoutes, { prefix: '/api/campaigns/:campaignId/items' });
  await app.register(classesRoutes, { prefix: '/api/campaigns/:campaignId/classes' });
  await app.register(classKitRoutes, { prefix: '/api/campaigns/:campaignId/classes' });
  await app.register(campaignDraftRoutes, { prefix: '/api/campaigns/:campaignId/draft' });
  await app.register(campaignVersionRoutes, { prefix: '/api/campaigns/:campaignId' });
  await app.register(mediaRoutes, {
    prefix: '/api/media',
    userBytes: config.MEDIA_USER_QUOTA_BYTES,
    userDailyUploads: config.MEDIA_USER_DAILY_UPLOADS,
    totalBytes: config.MEDIA_TOTAL_QUOTA_BYTES,
    ...options.media,
  });
  await app.register(catalogRoutes, { prefix: '/api/catalog' });
  await app.register(roomsRoutes, { prefix: '/api/rooms' });
  await app.register(roomProfileRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(roomMasterRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(campfireRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(narrativeRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(historyRoutes, { prefix: '/api/history' });
  await app.register(profileProgressRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(profileItemsRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(shopsRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(tradesRoutes, { prefix: '/api/rooms/:roomId' });
  await app.register(battlesRoutes, { prefix: '/api' });

  return app;
}
