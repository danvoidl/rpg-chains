import type { FastifyInstance } from 'fastify';
import { CampaignInputSchema, CampaignPatchSchema } from '@rpg-chains/shared-types';

/** Campaign authoring routes: CRUD for the authenticated user's campaigns. */
export default async function campaignsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    return app.prisma.campaign.findMany({
      where: { authorId: request.user!.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = CampaignInputSchema.parse(request.body);
    const campaign = await app.prisma.campaign.create({
      data: {
        name: body.name,
        description: body.description ?? '',
        authorId: request.user!.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return reply.code(201).send(campaign);
  });

  app.get<{ Params: { campaignId: string } }>(
    '/:campaignId',
    { preHandler: [app.authenticate, app.requireCampaignOwner] },
    async (request) => {
      return app.prisma.campaign.findUnique({
        where: { id: request.params.campaignId },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },
  );

  app.patch<{ Params: { campaignId: string } }>(
    '/:campaignId',
    { preHandler: [app.authenticate, app.requireCampaignOwner] },
    async (request) => {
      const body = CampaignPatchSchema.parse(request.body);
      return app.prisma.campaign.update({
        where: { id: request.params.campaignId },
        data: body,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },
  );

  app.delete<{ Params: { campaignId: string } }>(
    '/:campaignId',
    { preHandler: [app.authenticate, app.requireCampaignOwner] },
    async (request, reply) => {
      // Rooms of other players may be playing it; the author cannot see them (spec §2.2), so
      // deleting the campaign must never take them down.
      const rooms = await app.prisma.room.count({
        where: { campaignId: request.params.campaignId },
      });
      if (rooms > 0) return reply.code(409).send({ error: 'campaign_has_rooms' });
      await app.prisma.campaign.delete({
        where: { id: request.params.campaignId },
      });
      return reply.code(204).send();
    },
  );
}
