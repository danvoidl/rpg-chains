import type { FastifyInstance } from 'fastify';
import { checkNodeEntry, clearedNodeIds, recordNodeCleared } from '@rpg-chains/campaign-rules';
import type { NarrativeView } from '@rpg-chains/shared-types';
import { NODE_ENTRY_STATUS } from '../mappers/node-entry.js';
import { readRoomDetail } from '../services/room-detail.js';
import { lockRoom } from '../services/room-lock.js';
import { findRoom } from '../services/room-query.js';
import { changeProgress, loadProgress } from '../services/room-progress.js';
import { syncRoomVersion } from '../services/room-version.js';

/**
 * Narrative nodes (Fase 5 plan decisions 1 and 12): any member reads an unlocked one on their own;
 * any player continuing past it clears it for the room, which unlocks what follows. Continuing one
 * already cleared is a no-op.
 */
export default async function narrativeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { roomId: string; nodeId: string } }>(
    '/narratives/:nodeId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId, nodeId } = request.params;

      const outcome = await app.prisma.$transaction(async (tx) => {
        if (!(await lockRoom(tx, roomId))) return { error: 404, code: 'room_not_found' } as const;
        const room = (await findRoom(tx, roomId))!;
        const member = room.masterId === userId || room.profiles.some((p) => p.userId === userId);
        if (!member) return { error: 404, code: 'not_a_player' } as const;

        const { snapshot } = await syncRoomVersion(tx, room, app.battles);
        const progress = await loadProgress(tx, roomId);
        const refusal = checkNodeEntry(snapshot, progress, nodeId, ['narrative']);
        if (refusal && refusal !== 'node_cleared') {
          return { error: NODE_ENTRY_STATUS[refusal], code: refusal } as const;
        }
        const node = snapshot.chapters.flatMap((c) => c.nodes).find((n) => n.id === nodeId);
        if (node?.type !== 'narrative') return { error: 404, code: 'node_not_found' } as const;
        const view: NarrativeView = {
          nodeId,
          title: node.title,
          text: node.text,
          videoUrl: node.videoUrl ?? null,
          cleared: clearedNodeIds(progress).has(nodeId),
        };
        return { error: null, view } as const;
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      return outcome.view;
    },
  );

  app.post<{ Params: { roomId: string; nodeId: string } }>(
    '/narratives/:nodeId/continue',
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

        const { snapshot } = await syncRoomVersion(tx, room, app.battles);
        const refusal = checkNodeEntry(snapshot, await loadProgress(tx, roomId), nodeId, [
          'narrative',
        ]);
        // An already cleared narrative is fine: recording it again changes nothing.
        if (refusal && refusal !== 'node_cleared') {
          return { error: NODE_ENTRY_STATUS[refusal], code: refusal } as const;
        }
        await changeProgress(tx, room, snapshot, (p) =>
          recordNodeCleared(snapshot, p, nodeId, [caller.id]),
        );
        return { error: null } as const;
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      app.roomEvents.changed(roomId);
      return readRoomDetail(app.prisma, app.battles, roomId, userId);
    },
  );
}
