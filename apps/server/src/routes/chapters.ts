import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { ChapterInputSchema, ChapterPatchSchema, DraftGraphSchema } from '@rpg-chains/shared-types';
import { normalizeGraph } from '@rpg-chains/campaign-rules';
import { toBackgroundColumns, toDraftChapter } from '../mappers/chapter.js';

/** Loads a chapter with its nodes and edges, scoped to a campaign (returns null if not found). */
async function findChapter(
  prisma: FastifyInstance['prisma'],
  campaignId: string,
  chapterId: string,
) {
  return prisma.chapter.findFirst({
    where: { id: chapterId, campaignId },
    include: { nodes: true, edges: true },
  });
}

/** Chapter authoring routes scoped to a campaign. */
export default async function chaptersRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  /** GET / — list chapters ordered by order, then id. */
  app.get<{ Params: { campaignId: string } }>('/', { preHandler }, async (request) => {
    const rows = await app.prisma.chapter.findMany({
      where: { campaignId: request.params.campaignId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, order: true, underConstruction: true },
    });
    return rows;
  });

  /** POST / — create a chapter; defaults order to the current chapter count. */
  app.post<{ Params: { campaignId: string } }>('/', { preHandler }, async (request, reply) => {
    const { campaignId } = request.params;
    const body = ChapterInputSchema.parse(request.body);

    let order = body.order;
    if (order === undefined) {
      const count = await app.prisma.chapter.count({ where: { campaignId } });
      order = count;
    }

    const row = await app.prisma.chapter.create({
      data: {
        campaignId,
        name: body.name,
        order,
        underConstruction: body.underConstruction ?? false,
        ...toBackgroundColumns(body.background),
      },
      select: { id: true, name: true, order: true, underConstruction: true },
    });
    return reply.code(201).send(row);
  });

  /** GET /:chapterId — return DraftChapter with nodes and edges. */
  app.get<{ Params: { campaignId: string; chapterId: string } }>(
    '/:chapterId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, chapterId } = request.params;
      const row = await findChapter(app.prisma, campaignId, chapterId);
      if (!row) {
        return reply.code(404).send({ error: 'chapter_not_found' });
      }
      return toDraftChapter(row);
    },
  );

  /** PATCH /:chapterId — partial update of chapter metadata. */
  app.patch<{ Params: { campaignId: string; chapterId: string } }>(
    '/:chapterId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, chapterId } = request.params;
      const existing = await app.prisma.chapter.findFirst({
        where: { id: chapterId, campaignId },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'chapter_not_found' });
      }
      const { background, ...fields } = ChapterPatchSchema.parse(request.body);
      const row = await app.prisma.chapter.update({
        where: { id: chapterId },
        data: { ...fields, ...toBackgroundColumns(background) },
        select: { id: true, name: true, order: true, underConstruction: true },
      });
      return reply.code(200).send(row);
    },
  );

  /** DELETE /:chapterId — delete chapter; nodes and edges cascade in the DB. */
  app.delete<{ Params: { campaignId: string; chapterId: string } }>(
    '/:chapterId',
    { preHandler },
    async (request, reply) => {
      const { campaignId, chapterId } = request.params;
      const existing = await app.prisma.chapter.findFirst({
        where: { id: chapterId, campaignId },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'chapter_not_found' });
      }
      await app.prisma.chapter.delete({ where: { id: chapterId } });
      return reply.code(204).send();
    },
  );

  /**
   * PUT /:chapterId/graph — atomically replaces the whole chapter graph.
   * Validates node id uniqueness, checks cross-chapter node conflicts, normalizes the graph,
   * then performs the full update in a single transaction.
   */
  app.put<{ Params: { campaignId: string; chapterId: string } }>(
    '/:chapterId/graph',
    { preHandler },
    async (request, reply) => {
      const { campaignId, chapterId } = request.params;

      const existing = await app.prisma.chapter.findFirst({
        where: { id: chapterId, campaignId },
      });
      if (!existing) {
        return reply.code(404).send({ error: 'chapter_not_found' });
      }

      const body = DraftGraphSchema.parse(request.body);

      // a. Check for duplicate node ids in the request body.
      const nodeIds = body.nodes.map((n) => n.id);
      const uniqueNodeIds = new Set(nodeIds);
      if (uniqueNodeIds.size !== nodeIds.length) {
        return reply.code(400).send({ error: 'duplicate_node_ids' });
      }

      // b. Normalize the graph (drops dangling edges/prerequisites and stale entry/boss).
      const normalized = normalizeGraph(body);

      // c. Detect node ids that already belong to a DIFFERENT chapter.
      if (nodeIds.length > 0) {
        const conflicting = await app.prisma.chapterNode.findFirst({
          where: {
            id: { in: nodeIds },
            chapterId: { not: chapterId },
          },
          select: { id: true },
        });
        if (conflicting) {
          return reply.code(409).send({ error: 'node_id_conflict' });
        }
      }

      // d. Execute the full graph update in a single transaction.
      await app.prisma.$transaction(async (tx) => {
        // Delete nodes that are no longer in the body.
        await tx.chapterNode.deleteMany({
          where: {
            chapterId,
            id: { notIn: nodeIds },
          },
        });

        // Upsert each node.
        for (const node of normalized.nodes) {
          await tx.chapterNode.upsert({
            where: { id: node.id },
            create: {
              id: node.id,
              chapterId,
              type: node.type,
              title: node.title,
              mandatory: node.mandatory,
              recommendedLevel: node.recommendedLevel ?? null,
              participantLimit: ('participantLimit' in node ? node.participantLimit : null) ?? null,
              posX: node.position.x,
              posY: node.position.y,
              prerequisites: node.prerequisites as Prisma.InputJsonValue,
              config: node.config as Prisma.InputJsonValue,
            },
            update: {
              type: node.type,
              title: node.title,
              mandatory: node.mandatory,
              recommendedLevel: node.recommendedLevel ?? null,
              participantLimit: ('participantLimit' in node ? node.participantLimit : null) ?? null,
              posX: node.position.x,
              posY: node.position.y,
              prerequisites: node.prerequisites as Prisma.InputJsonValue,
              config: node.config as Prisma.InputJsonValue,
            },
          });
        }

        // Replace all edges.
        await tx.nodeEdge.deleteMany({ where: { chapterId } });
        if (normalized.edges.length > 0) {
          await tx.nodeEdge.createMany({
            data: normalized.edges.map((e) => ({
              chapterId,
              fromId: e.from,
              toId: e.to,
            })),
          });
        }

        // Update entry/boss pointers.
        await tx.chapter.update({
          where: { id: chapterId },
          data: {
            entryNodeId: normalized.entryNodeId ?? null,
            bossNodeId: normalized.bossNodeId ?? null,
          },
        });
      });

      // e. Return the reloaded chapter.
      const reloaded = await findChapter(app.prisma, campaignId, chapterId);
      return reply.code(200).send(toDraftChapter(reloaded!));
    },
  );
}
