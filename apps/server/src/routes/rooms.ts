import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { JoinByCodeInputSchema, RoomCreateInputSchema } from '@rpg-chains/shared-types';
import { toRoomSummary } from '../mappers/room.js';
import { withFreshAccessCode } from '../services/access-code.js';
import { readRoomDetail } from '../services/room-detail.js';
import { canView, findRoom } from '../services/room-query.js';

const summaryInclude = {
  campaign: { select: { id: true, name: true } },
  master: { select: { id: true, name: true } },
  _count: { select: { profiles: true } },
} as const;

/** Lists are short-lived lobbies, not archives; the newest rooms are the relevant ones. */
const LIST_LIMIT = 50;

const ViewQuerySchema = z.object({ code: z.string().optional() });

/** Room creation, listing, joining by code and the room page read (spec §7, Fase 2 M1–M2). */
export default async function roomsRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  app.post('/', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const body = RoomCreateInputSchema.parse(request.body);
    const latest = await app.prisma.campaignVersion.findFirst({
      where: { campaignId: body.campaignId },
      orderBy: { version: 'desc' },
    });
    if (!latest) return reply.code(404).send({ error: 'campaign_not_published' });

    const create = (accessCode: string | null) =>
      app.prisma.room.create({
        data: {
          name: body.name,
          isPublic: body.isPublic,
          accessCode,
          campaignId: body.campaignId,
          campaignVersionId: latest.id,
          masterId: userId,
        },
      });
    const room = body.isPublic ? await create(null) : await withFreshAccessCode(create);
    return reply.code(201).send(await readRoomDetail(app.prisma, app.battles, room.id, userId));
  });

  app.get('/', { preHandler }, async () => {
    const rows = await app.prisma.room.findMany({
      where: { isPublic: true, status: { in: ['open', 'completed'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: LIST_LIMIT,
      include: summaryInclude,
    });
    return rows.map(toRoomSummary);
  });

  app.get('/mine', { preHandler }, async (request) => {
    const userId = request.user!.id;
    const rows = await app.prisma.room.findMany({
      where: {
        status: { not: 'closed' },
        OR: [{ masterId: userId }, { profiles: { some: { userId } } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: LIST_LIMIT,
      include: summaryInclude,
    });
    return rows.map(toRoomSummary);
  });

  app.post('/join', { preHandler }, async (request, reply) => {
    const { code } = JoinByCodeInputSchema.parse(request.body);
    const room = await app.prisma.room.findUnique({
      where: { accessCode: code },
      select: { id: true, status: true },
    });
    if (!room || room.status === 'closed') {
      return reply.code(404).send({ error: 'invalid_access_code' });
    }
    return { roomId: room.id };
  });

  app.get<{ Params: { roomId: string } }>('/:roomId', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { code } = ViewQuerySchema.parse(request.query);
    const room = await findRoom(app.prisma, request.params.roomId);
    if (!room || !canView(room, userId, code)) {
      return reply.code(404).send({ error: 'room_not_found' });
    }
    return readRoomDetail(app.prisma, app.battles, room.id, userId);
  });
}
