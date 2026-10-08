import type { FastifyInstance } from 'fastify';
import { restoreAtCampfire } from '@rpg-chains/battle-engine';
import { checkNodeEntry, recordCampfireLit } from '@rpg-chains/campaign-rules';
import { NODE_ENTRY_STATUS } from '../mappers/node-entry.js';
import { readRoomDetail } from '../services/room-detail.js';
import { lockRoom } from '../services/room-lock.js';
import { findRoom } from '../services/room-query.js';
import { changeProgress, loadProgress } from '../services/room-progress.js';
import { syncRoomVersion } from '../services/room-version.js';

/**
 * Lighting a campfire (Fase 5 plan decisions 4 and 12): any player of the room, outside a battle,
 * on an unlocked campfire node. Everyone in the room who is not fighting is revived and refilled,
 * and the chapter's return point moves here. Relighting a lit campfire is allowed.
 */
export default async function campfireRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { roomId: string; nodeId: string } }>(
    '/campfires/:nodeId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId, nodeId } = request.params;

      const outcome = await app.prisma.$transaction(async (tx) => {
        if (!(await lockRoom(tx, roomId))) return { error: 404, code: 'room_not_found' } as const;
        const room = (await findRoom(tx, roomId))!;
        const caller = room.profiles.find((p) => p.userId === userId);
        if (!caller) return { error: 404, code: 'not_a_player' } as const;
        if (room.status === 'closed') return { error: 409, code: 'room_closed' } as const;
        if (app.battles.battleOf(caller.id)) return { error: 409, code: 'in_battle' } as const;

        const { snapshot } = await syncRoomVersion(tx, room, app.battles);
        const refusal = checkNodeEntry(snapshot, await loadProgress(tx, roomId), nodeId, [
          'campfire',
        ]);
        if (refusal) return { error: NODE_ENTRY_STATUS[refusal], code: refusal } as const;

        // Whoever is in a battle keeps what the battle writes back.
        for (const profile of room.profiles) {
          if (app.battles.battleOf(profile.id)) continue;
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
        await changeProgress(tx, room, snapshot, (p) =>
          recordCampfireLit(snapshot, p, nodeId, [caller.id]),
        );
        return { error: null } as const;
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      app.roomEvents.changed(roomId);
      return readRoomDetail(app.prisma, app.battles, roomId, userId);
    },
  );
}
