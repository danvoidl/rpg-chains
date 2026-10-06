import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { CampaignSnapshotSchema } from '@rpg-chains/shared-types';
import { checkCompatibility, draftToSnapshot, draftWarnings } from '@rpg-chains/campaign-rules';
import { loadCampaignDraft } from '../services/campaign-draft.js';

/**
 * Publishing (spec §2.2, Fase 1 plan M5): runs the validation gate and, from the second publish
 * on, the compatibility gate against the latest version, then stores the next immutable
 * snapshot, echoing the non-blocking balancing warnings. Both gates are pure (`campaign-rules`); this route only loads, decides, persists.
 */
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
        const outcome = await app.prisma.$transaction(async (tx) => {
          const draft = await loadCampaignDraft(tx, campaignId);
          const latest = await tx.campaignVersion.findFirst({
            where: { campaignId },
            orderBy: { version: 'desc' },
          });
          const built = draftToSnapshot(draft, (latest?.version ?? 0) + 1);
          if (!built.ok) return { status: 'invalid', issues: built.issues } as const;

          if (latest) {
            const violations = checkCompatibility(
              CampaignSnapshotSchema.parse(latest.snapshot),
              built.snapshot,
            );
            if (violations.length > 0) return { status: 'incompatible', violations } as const;
          }
          const created = await tx.campaignVersion.create({
            data: {
              campaignId,
              version: built.snapshot.version,
              snapshot: built.snapshot as Prisma.InputJsonValue,
            },
            select: { id: true, version: true, publishedAt: true },
          });
          return { status: 'published', version: created, warnings: draftWarnings(draft) } as const;
        });

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
