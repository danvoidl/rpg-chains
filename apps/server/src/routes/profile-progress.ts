import type { FastifyInstance } from 'fastify';
import { spendPoints } from '@rpg-chains/battle-engine';
import { SpendPointsInputSchema } from '@rpg-chains/shared-types';
import { toProfileSheet } from '../mappers/profile-sheet.js';
import { classOf, progressOf } from '../mappers/profile-state.js';
import { lockOwnedProfile } from '../services/owned-profile.js';
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
        const owned = await lockOwnedProfile(tx, app.battles, roomId, userId);
        if ('error' in owned) return owned;
        const { profile, snapshot } = owned;
        const spent = spendPoints(classOf(snapshot, profile), progressOf(profile), spend);
        if ('ok' in spent) return { error: 422, code: spent.reason };
        const updated = await tx.campaignProfile.update({
          where: { id: profile.id },
          data: {
            availablePoints: spent.availablePoints,
            ...spent.attributes,
            currentHp: spent.currentHp,
            currentEnergy: spent.currentEnergy,
          },
        });
        return { error: null, sheet: toProfileSheet(updated, snapshot) };
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      // Other members see the new ceilings in the room's member list.
      app.roomEvents.changed(roomId);
      return outcome.sheet;
    },
  );
}
