import type { FastifyInstance } from 'fastify';
import { spendPoints } from '@rpg-chains/battle-engine';
import { SpendPointsInputSchema } from '@rpg-chains/shared-types';
import { toProfileSheet } from '../mappers/profile-sheet.js';
import { lockRoom } from '../services/room-lock.js';
import { findRoom } from '../services/room-query.js';
import { syncRoomVersion } from '../services/room-version.js';

/**
 * The player's own character in a room (Fase 4 plan M3): reading the sheet, and investing the
 * points a level-up gave (decision 7). Gold is private, so only the owner reads their sheet.
 */
export default async function profileProgressRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  app.get<{ Params: { roomId: string } }>('/profile', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const room = await findRoom(app.prisma, request.params.roomId);
    const profile = room?.profiles.find((p) => p.userId === userId);
    if (!room || !profile) return reply.code(404).send({ error: 'not_a_player' });
    const { snapshot } = await syncRoomVersion(app.prisma, room, app.battles);
    return toProfileSheet(profile, snapshot);
  });

  app.post<{ Params: { roomId: string } }>(
    '/profile/points',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId } = request.params;
      const spend = SpendPointsInputSchema.parse(request.body);

      const outcome = await app.prisma.$transaction(async (tx) => {
        if (!(await lockRoom(tx, roomId))) return { error: 404, code: 'not_a_player' } as const;
        const room = (await findRoom(tx, roomId))!;
        const profile = room.profiles.find((p) => p.userId === userId);
        if (!profile) return { error: 404, code: 'not_a_player' } as const;
        if (room.status === 'closed') return { error: 409, code: 'room_closed' } as const;
        // The battle read the profile when it started; its write-back would undo the change.
        if (app.battles.battleOf(profile.id)) return { error: 409, code: 'in_battle' } as const;

        const { snapshot } = await syncRoomVersion(tx, room, app.battles);
        const cls = snapshot.classes.find((c) => c.id === profile.classId)!;
        const spent = spendPoints(
          cls,
          {
            level: profile.level,
            xp: profile.xp,
            availablePoints: profile.availablePoints,
            attributes: {
              strength: profile.strength,
              dexterity: profile.dexterity,
              intelligence: profile.intelligence,
            },
            currentHp: profile.currentHp,
            currentEnergy: profile.currentEnergy,
            downed: profile.downed,
          },
          spend,
        );
        if ('ok' in spent) return { error: 422, code: spent.reason } as const;
        const updated = await tx.campaignProfile.update({
          where: { id: profile.id },
          data: {
            availablePoints: spent.availablePoints,
            ...spent.attributes,
            currentHp: spent.currentHp,
            currentEnergy: spent.currentEnergy,
          },
        });
        return { error: null, sheet: toProfileSheet(updated, snapshot) } as const;
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      // Other members see the new ceilings in the room's member list.
      app.roomEvents.changed(roomId);
      return outcome.sheet;
    },
  );
}
