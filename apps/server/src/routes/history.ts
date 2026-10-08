import type { FastifyInstance } from 'fastify';
import { toHistoryEntry } from '../mappers/history.js';

/** The caller's closed campaigns, newest first (spec §7, Fase 5 plan decision 10). */
export default async function historyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const rows = await app.prisma.history.findMany({
      where: { userId: request.user!.id },
      include: { room: { select: { name: true, closedAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toHistoryEntry);
  });
}
