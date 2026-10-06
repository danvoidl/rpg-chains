import type { FastifyInstance } from 'fastify';
import { ClassInputSchema } from '@rpg-chains/shared-types';
import {
  InvalidSkillIdError,
  createClass,
  findClass,
  listClasses,
  replaceClass,
} from '../services/character-classes.js';

/** Class and skill authoring routes scoped to a campaign (spec §5, Fase 1b). */
export default async function classesRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  app.get<{ Params: { campaignId: string } }>('/', { preHandler }, async (request) =>
    listClasses(app.prisma, request.params.campaignId),
  );

  app.post<{ Params: { campaignId: string } }>('/', { preHandler }, async (request, reply) => {
    const body = ClassInputSchema.parse(request.body);
    const created = await app.prisma.$transaction((tx) =>
      createClass(tx, request.params.campaignId, body),
    );
    return reply.code(201).send(created);
  });

  app.put<{ Params: { campaignId: string; classId: string } }>(
    '/:classId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, classId } = request.params;
      const body = ClassInputSchema.parse(request.body);
      if (!(await findClass(app.prisma, campaignId, classId))) {
        return reply.code(404).send({ error: 'class_not_found' });
      }
      try {
        return await app.prisma.$transaction((tx) => replaceClass(tx, classId, body));
      } catch (error) {
        if (error instanceof InvalidSkillIdError) {
          return reply.code(400).send({ error: 'invalid_skill_id', skillId: error.skillId });
        }
        throw error;
      }
    },
  );

  app.delete<{ Params: { campaignId: string; classId: string } }>(
    '/:classId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, classId } = request.params;
      if (!(await findClass(app.prisma, campaignId, classId))) {
        return reply.code(404).send({ error: 'class_not_found' });
      }
      await app.prisma.characterClass.delete({ where: { id: classId } });
      return reply.code(204).send();
    },
  );
}
