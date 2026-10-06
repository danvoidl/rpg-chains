import type { FastifyInstance } from 'fastify';

/** Liveness probe. */
export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));
}
