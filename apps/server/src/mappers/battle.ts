import type { BattleSummary } from '@rpg-chains/shared-types';
import type { ActiveBattle } from '../services/battle-registry.js';

/** A battle as the room page lists it; a battle resolving its write-back still shows as running. */
export function toBattleSummary(battle: ActiveBattle): BattleSummary {
  return {
    battleId: battle.battleId,
    nodeId: battle.node.id,
    nodeTitle: battle.node.title,
    nodeType: battle.node.type,
    status: battle.status,
    participants: battle.participants.map(({ profileId, userId, name }) => ({
      profileId,
      userId,
      name,
    })),
    participantLimit: battle.node.participantLimit,
    needsMaster: battle.needsMaster,
  };
}
