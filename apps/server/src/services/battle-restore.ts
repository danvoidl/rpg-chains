import type { FastifyInstance } from 'fastify';
import { buildBattleContent } from '@rpg-chains/battle-engine';
import {
  BattleEventSchema,
  CampaignSnapshotSchema,
  RoomTurnTimersSchema,
} from '@rpg-chains/shared-types';
import type {
  BattleHeader,
  BattleNode,
  BattleParticipant,
  RunningBattle,
} from './battle-registry.js';
import { lobbyGraceKey, participantGraceKey } from './grace-timers.js';

const LogSchema = BattleEventSchema.array();

/**
 * Brings the journaled battles back after a restart (spec §3.7, Fase 6 plan decision 6). Each comes
 * back as it was, with everyone away: the participants are `PlayerDisconnected` — so the battle
 * pauses until one returns — each with a fresh reconnection grace, and the master gets the lobby
 * grace. If the grace runs out with nobody back, the battle is cancelled, not lost: the restart
 * was the server's fault. A battle that had resolved but was not written back is written back now.
 * `onMasterGraceExpired` re-reads the master's presence for the room's battles.
 */
export async function restoreBattles(
  app: FastifyInstance,
  onMasterGraceExpired: (roomId: string) => void,
): Promise<void> {
  const journals = await app.prisma.battleJournal.findMany({
    include: { entries: { orderBy: { fromSeq: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const journal of journals) {
    try {
      const version = await app.prisma.campaignVersion.findUniqueOrThrow({
        where: { id: journal.campaignVersionId },
      });
      const node = journal.node as unknown as BattleNode;
      // The version is immutable, so this is the content the battle started on.
      const content = buildBattleContent(CampaignSnapshotSchema.parse(version.snapshot), node.id);
      if ('ok' in content) throw new Error(`battle ${journal.battleId}: ${content.reason}`);
      const header: BattleHeader = {
        battleId: journal.battleId,
        roomId: journal.roomId,
        node,
        needsMaster: journal.needsMaster,
        masterId: journal.masterId,
        campaignVersionId: journal.campaignVersionId,
        participants: journal.participants as unknown as BattleParticipant[],
      };
      const events = journal.entries.flatMap((entry) => LogSchema.parse(entry.events));
      const battle = app.battles.restore(
        header,
        content,
        events,
        RoomTurnTimersSchema.parse(journal.turnTimers),
      );
      if (battle.state.result !== null) app.battleResolution.appended(battle);
      else awayFromRestart(app, battle, onMasterGraceExpired);
    } catch (error) {
      // A journal that cannot come back is dropped, like a battle lost in a crash used to be.
      app.log.error(error, 'battle restore failed');
      await app.prisma.battleJournal.deleteMany({ where: { battleId: journal.battleId } });
    }
  }
}

function awayFromRestart(
  app: FastifyInstance,
  battle: RunningBattle,
  onMasterGraceExpired: (roomId: string) => void,
): void {
  const { battleId, roomId } = battle;
  for (const combatant of battle.state.combatants) {
    if (combatant.left) continue;
    const { profileId } = combatant;
    if (combatant.connected) app.battles.apply(battleId, { type: 'PlayerDisconnected', profileId });
    app.grace.start(participantGraceKey(battleId, profileId), () =>
      graceAfterRestartEnded(app, battleId, profileId),
    );
  }
  if (battle.needsMaster) {
    app.grace.start(lobbyGraceKey(roomId, battle.masterId), () => onMasterGraceExpired(roomId));
  }
}

/** Nobody back since the restart: cancel. Otherwise this one is out, as after any drop. */
function graceAfterRestartEnded(app: FastifyInstance, battleId: string, profileId: string): void {
  const battle = app.battles.get(battleId);
  if (battle?.status !== 'running' || battle.state.result !== null) return;
  const someoneBack = battle.log
    .slice(battle.restoredAtSeq)
    .some((event) => event.type === 'PlayerReconnected');
  if (!someoneBack) {
    app.battles.remove(battleId);
    app.roomEvents.changed(battle.roomId);
    return;
  }
  const combatant = battle.state.combatants.find((c) => c.profileId === profileId);
  if (combatant && !combatant.left && !combatant.connected) {
    app.battles.apply(battleId, { type: 'PlayerLeft', profileId });
  }
}
