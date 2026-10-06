import type { Prisma } from '@prisma/client';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { toRoomDetail } from '../mappers/room.js';
import { findRoom } from './room-query.js';
import { syncRoomVersion } from './room-version.js';

/** The room page read model for `viewerId`, rolling the room forward first; null if missing. */
export async function readRoomDetail(
  tx: Prisma.TransactionClient,
  roomId: string,
  viewerId: string,
): Promise<RoomDetail | null> {
  const room = await findRoom(tx, roomId);
  if (!room) return null;
  return toRoomDetail(room, await syncRoomVersion(tx, room), viewerId);
}
