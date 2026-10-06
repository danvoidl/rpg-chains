import type { Prisma } from '@prisma/client';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { toBattleSummary } from '../mappers/battle.js';
import { toRoomDetail } from '../mappers/room.js';
import type { BattleRegistry } from './battle-registry.js';
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
  return toRoomDetail(room, version, battles.inRoom(roomId).map(toBattleSummary), viewerId);
}
