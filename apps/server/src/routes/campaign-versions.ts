import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { publishCampaign } from '../services/publish-campaign.js';

/** Version list and publishing (`services/publish-campaign.ts` holds the gates). */
export default async function campaignVersionRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  app.get<{ Params: { campaignId: string } }>('/versions', { preHandler }, async (request) => {
    return app.prisma.campaignVersion.findMany({
      where: { campaignId: request.params.campaignId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, publishedAt: true },
    });
  });

  app.post<{ Params: { campaignId: string } }>(
    '/publish',
    { preHandler },
    async (request, reply) => {
      const { campaignId } = request.params;
      try {
        const outcome = await app.prisma.$transaction((tx) => publishCampaign(tx, campaignId));

        switch (outcome.status) {
          case 'invalid':
            return reply.code(422).send({ error: 'invalid_draft', issues: outcome.issues });
          case 'incompatible':
            return reply
              .code(422)
              .send({ error: 'incompatible_changes', violations: outcome.violations });
          case 'published':
            // Balancing warnings never block a publish; they are echoed back for the author.
            return reply.code(201).send({ ...outcome.version, warnings: outcome.warnings });
        }
      } catch (error) {
        // A concurrent publish took the same version number (unique campaignId+version).
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply.code(409).send({ error: 'publish_conflict' });
        }
        throw error;
      }
    },
  );
}
