import type { FastifyInstance } from 'fastify';
import { importDefaultKit } from '../services/default-kit.js';

/**
 * Imports the default kit by COPY (spec §5.1, Fase 1b decision 7). Importing twice creates two
 * copies.
 */
export default async function classKitRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  app.post<{ Params: { campaignId: string } }>(
    '/import-kit',
    { preHandler },
    async (request, reply) => {
      const { campaignId } = request.params;
      const classes = await app.prisma.$transaction((tx) => importDefaultKit(tx, campaignId));
      return reply.code(201).send(classes);
    },
  );
}
