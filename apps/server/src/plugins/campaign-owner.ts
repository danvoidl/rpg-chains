import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * preHandler for every `/api/campaigns/:campaignId/*` route: 404 when the campaign does not
     * exist, 403 when the caller is not its author. Must run after `authenticate`.
     */
    requireCampaignOwner: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Shared author-only access check for campaign-scoped routes (Fase 1 plan, decision 7). */
export default fp(async (app) => {
  app.decorate('requireCampaignOwner', async (request: FastifyRequest, reply: FastifyReply) => {
    const { campaignId } = request.params as { campaignId?: string };
    const campaign = campaignId
      ? await app.prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { authorId: true },
        })
      : null;
    if (!campaign) {
      reply.code(404).send({ error: 'campaign_not_found' });
      return;
    }
    if (campaign.authorId !== request.user?.id) {
      reply.code(403).send({ error: 'forbidden' });
    }
  });
});
