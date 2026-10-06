import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { QuestionInputSchema } from '@rpg-chains/shared-types';
import { toQuestion } from '../mappers/question.js';

const QuerySchema = z.object({
  type: z.enum(['objective', 'open']).optional(),
});

/** Question authoring routes scoped to a campaign. */
export default async function questionsRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  app.get<{ Params: { campaignId: string } }>('/', { preHandler }, async (request) => {
    const { type } = QuerySchema.parse(request.query);
    const rows = await app.prisma.question.findMany({
      where: {
        campaignId: request.params.campaignId,
        ...(type ? { type } : {}),
      },
      orderBy: { id: 'asc' },
    });
    return rows.map(toQuestion);
  });

  app.post<{ Params: { campaignId: string } }>('/', { preHandler }, async (request, reply) => {
    const { campaignId } = request.params;
    const body = QuestionInputSchema.parse(request.body);
    const data =
      body.type === 'objective'
        ? {
            campaignId,
            type: 'objective',
            prompt: body.prompt,
            options: body.options as Prisma.InputJsonValue,
            correctIndex: body.correctIndex,
          }
        : {
            campaignId,
            type: 'open',
            prompt: body.prompt,
            options: Prisma.DbNull,
            correctIndex: null,
          };
    const row = await app.prisma.question.create({ data });
    return reply.code(201).send(toQuestion(row));
  });

  app.put<{ Params: { campaignId: string; questionId: string } }>(
    '/:questionId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, questionId } = request.params;
      const body = QuestionInputSchema.parse(request.body);
      const existing = await app.prisma.question.findFirst({
        where: { id: questionId, campaignId },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'question_not_found' });
      }
      const data =
        body.type === 'objective'
          ? {
              type: 'objective',
              prompt: body.prompt,
              options: body.options as Prisma.InputJsonValue,
              correctIndex: body.correctIndex,
            }
          : {
              type: 'open',
              prompt: body.prompt,
              options: Prisma.DbNull,
              correctIndex: null,
            };
      const row = await app.prisma.question.update({
        where: { id: questionId },
        data,
      });
      return reply.code(200).send(toQuestion(row));
    },
  );

  app.delete<{ Params: { campaignId: string; questionId: string } }>(
    '/:questionId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, questionId } = request.params;
      const existing = await app.prisma.question.findFirst({
        where: { id: questionId, campaignId },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'question_not_found' });
      }
      await app.prisma.question.delete({
        where: { id: questionId },
      });
      return reply.code(204).send();
    },
  );
}
