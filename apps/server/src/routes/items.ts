import type { FastifyInstance } from 'fastify';
import { ItemInputSchema } from '@rpg-chains/shared-types';
import { toItem, toItemData } from '../mappers/item.js';

/** Item authoring routes scoped to a campaign (Fase 1b: base weapons; shops use them in Fase 4). */
export default async function itemsRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  app.get<{ Params: { campaignId: string } }>('/', { preHandler }, async (request) => {
    const rows = await app.prisma.item.findMany({
      where: { campaignId: request.params.campaignId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toItem);
  });

  app.post<{ Params: { campaignId: string } }>('/', { preHandler }, async (request, reply) => {
    const body = ItemInputSchema.parse(request.body);
    const row = await app.prisma.item.create({
      data: { campaignId: request.params.campaignId, ...toItemData(body) },
    });
    return reply.code(201).send(toItem(row));
  });

  app.put<{ Params: { campaignId: string; itemId: string } }>(
    '/:itemId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, itemId } = request.params;
      const body = ItemInputSchema.parse(request.body);
      const existing = await app.prisma.item.findFirst({ where: { id: itemId, campaignId } });
      if (!existing) return reply.code(404).send({ error: 'item_not_found' });
      const row = await app.prisma.item.update({ where: { id: itemId }, data: toItemData(body) });
      return toItem(row);
    },
  );

  // Deleting an item still used as a base weapon is allowed in the draft; the publish gate
  // reports it (`base_weapon_invalid`), same as a villain used by a node (Fase 1b decision 9).
  app.delete<{ Params: { campaignId: string; itemId: string } }>(
    '/:itemId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, itemId } = request.params;
      const existing = await app.prisma.item.findFirst({ where: { id: itemId, campaignId } });
      if (!existing) return reply.code(404).send({ error: 'item_not_found' });
      await app.prisma.item.delete({ where: { id: itemId } });
      return reply.code(204).send();
    },
  );
}
