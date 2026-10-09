import type { FastifyInstance } from 'fastify';

/**
 * Turns the master's lobby presence into battle events (Fase 3 plan decision 2): every running
 * battle of the room that needs him learns when he comes or goes, so the fallback to objective
 * questions, the pause and the resume are facts in the log. Runs after every lobby presence change
 * and when a lobby grace runs out — so a master who reloads the page is back before the battle
 * notices (spec §3.2, Fase 6 plan decision 4).
 */
export function syncMasterPresence(app: FastifyInstance, roomId: string): void {
  for (const battle of app.battles.inRoom(roomId)) {
    if (battle.status !== 'running' || !battle.needsMaster || battle.state.result !== null)
      continue;
    const online = app.lobbyPresent(roomId, battle.masterId);
    if (online !== battle.state.masterOnline) {
      app.battles.apply(battle.battleId, { type: 'MasterPresenceChanged', online });
    }
  }
}
