import type { Prisma } from '@prisma/client';
import { campaignProgress } from '@rpg-chains/campaign-rules';
import type { BattleSummary, CampaignProgressView, RoomDetail } from '@rpg-chains/shared-types';
import { toBattleSummary } from '../mappers/battle.js';
import { toRoomDetail } from '../mappers/room.js';
import type { BattleRegistry } from './battle-registry.js';
import { loadProgress } from './room-progress.js';
import { findRoom } from './room-query.js';
import { syncRoomVersion } from './room-version.js';

/** The room page read model for `viewerId`, rolling the room forward first; null if missing. */
export async function readRoomDetail(
  tx: Prisma.TransactionClient,
  battles: BattleRegistry,
  roomId: string,
  viewerId: string,
): Promise<RoomDetail | null> {
  const room = await findRoom(tx, roomId);
  if (!room) return null;
  const version = await syncRoomVersion(tx, room, battles);
  const progress = campaignProgress(version.snapshot, await loadProgress(tx, roomId));
  // Re-read after the room roll-forward: its status may have changed (spec §7).
  const current = (await findRoom(tx, roomId))!;
  // After the last await: the registry is memory, read it at once.
  const summaries = battles.inRoom(roomId).map(toBattleSummary);
  return toRoomDetail(current, version, withBattles(progress, summaries), summaries, viewerId);
}

/** Overlays the battle forming or running on each node (the registry is memory, not a fact). */
function withBattles(
  progress: CampaignProgressView,
  battles: BattleSummary[],
): CampaignProgressView {
  return {
    ...progress,
    chapters: progress.chapters.map((chapter) => ({
      ...chapter,
      nodes: chapter.nodes.map((node) => ({
        ...node,
        battleId: battles.find((b) => b.nodeId === node.nodeId)?.battleId ?? null,
      })),
    })),
  };
}
