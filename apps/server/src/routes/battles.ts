import type { FastifyInstance, FastifyReply } from 'fastify';
import { toPublicQuestion } from '@rpg-chains/battle-engine';
import { BattleCreateInputSchema, type PublicQuestion } from '@rpg-chains/shared-types';
import { toBattleSummary } from '../mappers/battle.js';
import {
  forming,
  joinFormation,
  leaveFormation,
  mayCancel,
  openFormation,
  type Candidate,
  type Refusal,
} from '../services/battle-formation.js';
import { startBattle } from '../services/battle-start.js';
import { canView, findRoom } from '../services/room-query.js';
import { syncRoomVersion } from '../services/room-version.js';

type BattleParams = { Params: { battleId: string } };

/**
 * Forming, starting and cancelling battles (Fase 3 plan decision 9). These are room mutations, so
 * they are REST and signal the lobby like every other room write; the fight itself runs over the
 * battle socket. The registry is in memory, so every check against it runs after the last
 * `await` of the handler.
 */
export default async function battlesRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  const refuse = (reply: FastifyReply, refusal: Refusal) =>
    reply.code(refusal.status).send({ error: refusal.error });

  /** The caller as a fighter of the room: their Campaign Profile, or null without one. */
  async function candidate(roomId: string, userId: string): Promise<Candidate | null> {
    const profile = await app.prisma.campaignProfile.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { user: { select: { name: true } } },
    });
    return (
      profile && { profileId: profile.id, userId, name: profile.user.name, downed: profile.downed }
    );
  }

  app.post<{ Params: { roomId: string } }>(
    '/rooms/:roomId/battles',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId } = request.params;
      const { nodeId } = BattleCreateInputSchema.parse(request.body);

      const room = await findRoom(app.prisma, roomId);
      if (!room || !canView(room, userId)) return reply.code(404).send({ error: 'room_not_found' });
      if (room.status === 'closed') return reply.code(409).send({ error: 'room_closed' });
      const opener = await candidate(roomId, userId);
      if (!opener) return reply.code(403).send({ error: 'not_a_player' });
      const version = await syncRoomVersion(app.prisma, room, app.battles);

      const battle = openFormation(app.battles, {
        roomId,
        campaignVersionId: version.id,
        snapshot: version.snapshot,
        nodeId,
        opener,
        masterId: room.masterId,
      });
      if ('error' in battle) return refuse(reply, battle);
      // Going into a battle drops the player's trade offers (Fase 4 plan decision 9).
      app.trades.dropProfile(opener.profileId);
      app.roomEvents.changed(roomId);
      return reply.code(201).send(toBattleSummary(battle));
    },
  );

  app.post<BattleParams>(
    '/battles/:battleId/participants',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const { battleId } = request.params;
      const found = app.battles.get(battleId);
      if (!found) return reply.code(404).send({ error: 'battle_not_found' });
      const joiner = await candidate(found.roomId, userId);
      if (!joiner) return reply.code(403).send({ error: 'not_a_player' });

      // Re-read: the formation may have started, dissolved or filled up during the query.
      const battle = app.battles.get(battleId);
      if (!battle) return reply.code(404).send({ error: 'battle_not_found' });
      const open = forming(battle);
      if ('error' in open) return refuse(reply, open);
      const refused = joinFormation(app.battles, open, joiner);
      if (refused) return refuse(reply, refused);
      app.trades.dropProfile(joiner.profileId);
      app.roomEvents.changed(open.roomId);
      return toBattleSummary(open);
    },
  );

  app.delete<BattleParams>(
    '/battles/:battleId/participants',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const battle = app.battles.get(request.params.battleId);
      if (!battle) return reply.code(404).send({ error: 'battle_not_found' });
      const open = forming(battle);
      if ('error' in open) return refuse(reply, open);
      const me = open.participants.find((p) => p.userId === userId);
      if (!me) return reply.code(404).send({ error: 'not_a_participant' });
      leaveFormation(app.battles, open, me.profileId);
      app.roomEvents.changed(open.roomId);
      return reply.code(204).send();
    },
  );

  app.post<BattleParams>('/battles/:battleId/start', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const battle = app.battles.get(request.params.battleId);
    if (!battle) return reply.code(404).send({ error: 'battle_not_found' });
    const open = forming(battle);
    if ('error' in open) return refuse(reply, open);
    if (!open.participants.some((p) => p.userId === userId)) {
      return reply.code(403).send({ error: 'not_a_participant' });
    }

    const running = await startBattle(
      {
        prisma: app.prisma,
        registry: app.battles,
        seed: app.battleSeed,
        masterOnline: (roomId, masterId) => app.lobbyPresence.has(roomId, masterId),
      },
      open,
    );
    if ('error' in running) return refuse(reply, running);
    app.roomEvents.changed(running.roomId);
    return toBattleSummary(running);
  });

  /**
   * The node's questions for the master to choose from (spec §3.2), without answer keys: he picks
   * by prompt, and the engine judges objective answers itself.
   */
  app.get<BattleParams>('/battles/:battleId/questions', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const found = app.battles.get(request.params.battleId);
    if (found?.status !== 'running') return reply.code(404).send({ error: 'battle_not_found' });
    const room = await app.prisma.room.findUniqueOrThrow({
      where: { id: found.roomId },
      select: { masterId: true },
    });
    if (room.masterId !== userId) return reply.code(403).send({ error: 'not_master' });
    const questions: PublicQuestion[] = found.content.questions.map(toPublicQuestion);
    return questions;
  });

  app.post<BattleParams>('/battles/:battleId/cancel', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { battleId } = request.params;
    const found = app.battles.get(battleId);
    if (!found) return reply.code(404).send({ error: 'battle_not_found' });
    const room = await app.prisma.room.findUniqueOrThrow({
      where: { id: found.roomId },
      select: { masterId: true },
    });

    const battle = app.battles.get(battleId);
    if (!battle) return reply.code(404).send({ error: 'battle_not_found' });
    if (battle.status === 'forming' && battle.starting) {
      return reply.code(409).send({ error: 'battle_starting' });
    }
    // A resolved battle is being written back; it leaves on its own.
    if (battle.status === 'running' && battle.state.result !== null) {
      return reply.code(409).send({ error: 'battle_ended' });
    }
    if (!mayCancel(battle, userId, room.masterId)) {
      return reply.code(403).send({ error: 'not_allowed' });
    }
    app.battles.remove(battleId);
    app.roomEvents.changed(battle.roomId);
    return reply.code(204).send();
  });
}
