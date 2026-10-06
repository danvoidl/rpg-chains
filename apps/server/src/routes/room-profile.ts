import type { FastifyInstance } from 'fastify';
import { deriveStats } from '@rpg-chains/battle-engine';
import { ChooseClassInputSchema } from '@rpg-chains/shared-types';
import { readRoomDetail } from '../services/room-detail.js';
import { lockRoom } from '../services/room-lock.js';
import { canView, findRoom } from '../services/room-query.js';
import { syncRoomVersion } from '../services/room-version.js';

const NO_POINTS = { strength: 0, dexterity: 0, intelligence: 0 };

/**
 * Entering and abandoning a room (spec §5.2, §7). Entering = picking a class with a free slot,
 * which creates the durable Campaign Profile. Leaving the page is only presence; abandoning
 * deletes the profile, which is what frees the slot (Fase 2 plan decision 5).
 */
export default async function roomProfileRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  app.post<{ Params: { roomId: string } }>('/profile', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { roomId } = request.params;
    const body = ChooseClassInputSchema.parse(request.body);

    // The room row lock serializes slot checks: two players can never both take the last slot.
    const outcome = await app.prisma.$transaction(async (tx) => {
      if (!(await lockRoom(tx, roomId))) return { error: 404, code: 'room_not_found' } as const;
      const room = (await findRoom(tx, roomId))!;
      if (!canView(room, userId, body.accessCode)) {
        return { error: 404, code: 'room_not_found' } as const;
      }
      if (room.status !== 'open') return { error: 409, code: 'room_closed' } as const;
      if (room.profiles.some((p) => p.userId === userId)) {
        return { error: 409, code: 'already_member' } as const;
      }

      const { snapshot } = await syncRoomVersion(tx, room);
      const cls = snapshot.classes.find((c) => c.id === body.classId);
      if (!cls) return { error: 422, code: 'unknown_class' } as const;
      const taken = room.profiles.filter((p) => p.classId === cls.id).length;
      if (taken >= cls.maxSlots) return { error: 409, code: 'class_full' } as const;

      // A late joiner starts at level 1; the relevance factor makes that viable (spec §7, §4.5).
      const { maxHp, maxEnergy } = deriveStats(cls, 1, NO_POINTS);
      await tx.campaignProfile.create({
        data: {
          roomId,
          userId,
          classId: cls.id,
          currentHp: maxHp,
          currentEnergy: maxEnergy,
          // Players start with only their class's base weapon (spec §6).
          equipment: { weapon: cls.baseWeaponId },
        },
      });
      return { error: null } as const;
    });

    if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
    app.roomEvents.changed(roomId);
    return reply.code(201).send(await readRoomDetail(app.prisma, roomId, userId));
  });

  app.delete<{ Params: { roomId: string } }>('/profile', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { roomId } = request.params;

    const outcome = await app.prisma.$transaction(async (tx) => {
      if (!(await lockRoom(tx, roomId))) return { error: 404, code: 'room_not_found' } as const;
      const room = (await findRoom(tx, roomId))!;
      const profile = room.profiles.find((p) => p.userId === userId);
      if (!profile) return { error: 404, code: 'not_a_player' } as const;
      if (room.status === 'closed') return { error: 409, code: 'room_closed' } as const;
      // The room must keep a master who is still around; hand the role over first.
      const othersPlaying = room.profiles.some((p) => p.userId !== userId);
      if (room.masterId === userId && othersPlaying) {
        return { error: 409, code: 'master_must_transfer' } as const;
      }
      await tx.campaignProfile.delete({ where: { id: profile.id } });
      return { error: null } as const;
    });

    if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
    app.roomEvents.changed(roomId);
    return reply.code(204).send();
  });
}
