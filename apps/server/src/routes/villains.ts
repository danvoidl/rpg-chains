import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { VillainInputSchema } from '@rpg-chains/shared-types';
import { toDraftVillain } from '../mappers/villain.js';

/** Villain authoring routes scoped to a campaign. */
export default async function villainsRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  app.get<{ Params: { campaignId: string } }>('/', { preHandler }, async (request) => {
    const rows = await app.prisma.villain.findMany({
      where: { campaignId: request.params.campaignId },
      orderBy: { name: 'asc' },
    });
    return rows.map(toDraftVillain);
  });

  app.post<{ Params: { campaignId: string } }>('/', { preHandler }, async (request, reply) => {
    const { campaignId } = request.params;
    const body = VillainInputSchema.parse(request.body);
    const attacks = (body.attacks ?? []).map((attack) => ({
      ...attack,
      id: attack.id ?? randomUUID(),
    }));
    const row = await app.prisma.villain.create({
      data: {
        campaignId,
        name: body.name,
        imageUrl: body.imageUrl ?? null,
        hp: body.hp,
        strength: body.strength,
        dexterity: body.dexterity,
        intelligence: body.intelligence,
        defense: body.defense,
        attacks: attacks as Prisma.InputJsonValue,
      },
    });
    return reply.code(201).send(toDraftVillain(row));
  });

  app.put<{ Params: { campaignId: string; villainId: string } }>(
    '/:villainId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, villainId } = request.params;
      const body = VillainInputSchema.parse(request.body);
      const existing = await app.prisma.villain.findFirst({
        where: { id: villainId, campaignId },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'villain_not_found' });
      }
      const attacks = (body.attacks ?? []).map((attack) => ({
        ...attack,
        id: attack.id ?? randomUUID(),
      }));
      const row = await app.prisma.villain.update({
        where: { id: villainId },
        data: {
          name: body.name,
          imageUrl: body.imageUrl ?? null,
          hp: body.hp,
          strength: body.strength,
          dexterity: body.dexterity,
          intelligence: body.intelligence,
          defense: body.defense,
          attacks: attacks as Prisma.InputJsonValue,
        },
      });
      return reply.code(200).send(toDraftVillain(row));
    },
  );

  app.delete<{ Params: { campaignId: string; villainId: string } }>(
    '/:villainId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, villainId } = request.params;
      const existing = await app.prisma.villain.findFirst({
        where: { id: villainId, campaignId },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'villain_not_found' });
      }
      await app.prisma.villain.delete({
        where: { id: villainId },
      });
      return reply.code(204).send();
    },
  );
}
