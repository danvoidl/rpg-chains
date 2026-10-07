import type { CampaignProfile, Prisma } from '@prisma/client';
import type { CampaignSnapshot } from '@rpg-chains/shared-types';
import type { BattleRegistry } from './battle-registry.js';
import { lockRoom } from './room-lock.js';
import { findRoom, type RoomWithRelations } from './room-query.js';
import { syncRoomVersion } from './room-version.js';

export interface OwnedProfile {
  room: RoomWithRelations;
  profile: CampaignProfile;
  snapshot: CampaignSnapshot;
}

export interface Refused {
  error: 404 | 409;
  code: string;
}

/**
 * The caller's own profile for a change only its owner makes out of battle (Fase 4 plan decisions
 * 7, 11–13): locks the room first (call it inside a transaction), then refuses a missing profile,
 * a closed room and a profile in a battle — the battle read it when it started, and its write-back
 * would undo the change.
 */
export async function lockOwnedProfile(
  tx: Prisma.TransactionClient,
  battles: BattleRegistry,
  roomId: string,
  userId: string,
): Promise<OwnedProfile | Refused> {
  if (!(await lockRoom(tx, roomId))) return { error: 404, code: 'not_a_player' };
  const room = (await findRoom(tx, roomId))!;
  const profile = room.profiles.find((p) => p.userId === userId);
  if (!profile) return { error: 404, code: 'not_a_player' };
  if (room.status === 'closed') return { error: 409, code: 'room_closed' };
  if (battles.battleOf(profile.id)) return { error: 409, code: 'in_battle' };
  const { snapshot } = await syncRoomVersion(tx, room, battles);
  return { room, profile, snapshot };
}
