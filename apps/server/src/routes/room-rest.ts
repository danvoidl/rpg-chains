import type { FastifyInstance } from 'fastify';
import { restoreAtCampfire } from '@rpg-chains/battle-engine';
import { readRoomDetail } from '../services/room-detail.js';
import { lockRoom } from '../services/room-lock.js';
import { findRoom } from '../services/room-query.js';
import { syncRoomVersion } from '../services/room-version.js';

/**
 * The master's provisional rest (Fase 3 plan decision 11): every profile of the room is revived
 * and refilled, as a campfire will do. It goes away when Fase 5 brings campfire nodes, which call
 * the same `restoreAtCampfire`.
 */
export default async function roomRestRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { roomId: string } }>(
    '/rest',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId } = request.params;

      const outcome = await app.prisma.$transaction(async (tx) => {
        if (!(await lockRoom(tx, roomId))) return { error: 404, code: 'room_not_found' } as const;
        const room = (await findRoom(tx, roomId))!;
        if (room.masterId !== userId) return { error: 403, code: 'not_master' } as const;
        if (room.status === 'closed') return { error: 409, code: 'room_closed' } as const;
        // A rest mid-battle would be overwritten by the battle's write-back.
        if (app.battles.hasActive(roomId)) {
          return { error: 409, code: 'battle_in_progress' } as const;
        }

        const { snapshot } = await syncRoomVersion(tx, room, app.battles);
        for (const profile of room.profiles) {
          const cls = snapshot.classes.find((c) => c.id === profile.classId);
          if (!cls) continue;
          const attributes = {
            strength: profile.strength,
            dexterity: profile.dexterity,
            intelligence: profile.intelligence,
          };
          await tx.campaignProfile.update({
            where: { id: profile.id },
            data: restoreAtCampfire(cls, profile.level, attributes),
          });
        }
        return { error: null } as const;
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      app.roomEvents.changed(roomId);
      return readRoomDetail(app.prisma, app.battles, roomId, userId);
    },
  );
}
