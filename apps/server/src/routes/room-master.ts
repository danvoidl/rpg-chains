import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import {
  CampaignSnapshotSchema,
  RoomPatchSchema,
  TransferMasterInputSchema,
} from '@rpg-chains/shared-types';
import { withFreshAccessCode } from '../services/access-code.js';
import { readRoomDetail } from '../services/room-detail.js';
import { lockRoom } from '../services/room-lock.js';
import { findRoom, type RoomWithRelations } from '../services/room-query.js';

/**
 * Master-only room management (spec §7, Fase 2 M4): edit, regenerate the code, hand over the
 * role, close. A closed room is read-only.
 */
export default async function roomMasterRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  /** The room when the caller is its master and it is not closed; otherwise replies an error. */
  async function openRoomAsMaster(
    roomId: string,
    userId: string,
    reply: FastifyReply,
  ): Promise<RoomWithRelations | null> {
    const room = await findRoom(app.prisma, roomId);
    if (!room) {
      reply.code(404).send({ error: 'room_not_found' });
      return null;
    }
    if (room.masterId !== userId) {
      reply.code(403).send({ error: 'not_master' });
      return null;
    }
    if (room.status === 'closed') {
      reply.code(409).send({ error: 'room_closed' });
      return null;
    }
    return room;
  }

  /** Replies the updated room and signals its lobby. */
  async function changed(roomId: string, userId: string) {
    app.roomEvents.changed(roomId);
    return readRoomDetail(app.prisma, app.battles, roomId, userId);
  }

  app.patch<{ Params: { roomId: string } }>('/', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { roomId } = request.params;
    const body = RoomPatchSchema.parse(request.body);
    const room = await openRoomAsMaster(roomId, userId, reply);
    if (!room) return reply;

    const update = (data: Prisma.RoomUpdateInput) =>
      app.prisma.room.update({ where: { id: roomId }, data });
    if (body.isPublic === false && room.accessCode === null) {
      // Turning private: generate the code that lets players in.
      await withFreshAccessCode((accessCode) => update({ ...body, accessCode }));
    } else {
      await update({ ...body, ...(body.isPublic ? { accessCode: null } : {}) });
    }
    return changed(roomId, userId);
  });

  app.post<{ Params: { roomId: string } }>(
    '/access-code',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId } = request.params;
      const room = await openRoomAsMaster(roomId, userId, reply);
      if (!room) return reply;
      if (room.isPublic) return reply.code(409).send({ error: 'room_is_public' });
      // The previous code stops working immediately.
      await withFreshAccessCode((accessCode) =>
        app.prisma.room.update({ where: { id: roomId }, data: { accessCode } }),
      );
      return changed(roomId, userId);
    },
  );

  app.post<{ Params: { roomId: string } }>('/transfer', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { roomId } = request.params;
    const body = TransferMasterInputSchema.parse(request.body);
    const room = await openRoomAsMaster(roomId, userId, reply);
    if (!room) return reply;
    // Only someone actually playing (with a profile) can become master.
    if (!room.profiles.some((p) => p.userId === body.userId) || body.userId === userId) {
      return reply.code(422).send({ error: 'invalid_new_master' });
    }
    // The judge of an open-question battle cannot change mid-fight (spec §3.2).
    if (app.battles.needsMaster(roomId)) {
      return reply.code(409).send({ error: 'battle_needs_master' });
    }
    await app.prisma.room.update({ where: { id: roomId }, data: { masterId: body.userId } });
    return changed(roomId, userId);
  });

  app.post<{ Params: { roomId: string } }>('/close', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { roomId } = request.params;
    if (!(await openRoomAsMaster(roomId, userId, reply))) return reply;

    // Closing writes the history: the campaign and each player's final character (spec §7).
    const outcome = await app.prisma.$transaction(async (tx) => {
      await lockRoom(tx, roomId);
      const room = (await findRoom(tx, roomId))!;
      if (room.status === 'closed') return { error: 409, code: 'room_closed' } as const;
      if (app.battles.hasActive(roomId)) return { error: 409, code: 'battle_in_progress' } as const;

      const version = await tx.campaignVersion.findUniqueOrThrow({
        where: { id: room.campaignVersionId },
      });
      const snapshot = CampaignSnapshotSchema.parse(version.snapshot);
      await tx.history.createMany({
        data: room.profiles.map((profile) => ({
          roomId,
          userId: profile.userId,
          campaignName: snapshot.name,
          finalData: {
            classId: profile.classId,
            className: snapshot.classes.find((c) => c.id === profile.classId)?.name ?? null,
            level: profile.level,
            xp: profile.xp,
            attributes: {
              strength: profile.strength,
              dexterity: profile.dexterity,
              intelligence: profile.intelligence,
            },
            downed: profile.downed,
            equipment: profile.equipment as Prisma.InputJsonValue,
            inventory: profile.inventory as Prisma.InputJsonValue,
          },
        })),
      });
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'closed', closedAt: new Date() },
      });
      return { error: null } as const;
    });

    if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
    return changed(roomId, userId);
  });
}
