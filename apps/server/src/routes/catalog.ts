import type { FastifyInstance } from 'fastify';
import type { CatalogCampaign } from '@rpg-chains/shared-types';

/** Published campaigns any signed-in user can open a room for (spec §7). */
export default async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [app.authenticate] }, async (): Promise<CatalogCampaign[]> => {
    const rows = await app.prisma.campaign.findMany({
      where: { versions: { some: {} } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        author: { select: { id: true, name: true } },
        versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      author: row.author,
      latestVersion: row.versions[0]!.version,
    }));
  });
}
