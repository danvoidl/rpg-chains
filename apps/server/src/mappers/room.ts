import type { Room } from '@prisma/client';
import type {
  CampaignSnapshot,
  RoomDetail,
  RoomStatus,
  RoomSummary,
} from '@rpg-chains/shared-types';
import type { RoomWithRelations } from '../services/room-query.js';
import type { RoomVersion } from '../services/room-version.js';

type SummaryRow = Room & {
  campaign: { id: string; name: string };
  master: { id: string; name: string };
  _count: { profiles: number };
};

/** Maps a room row (with campaign, master and profile count) to a list entry. */
export function toRoomSummary(row: SummaryRow): RoomSummary {
  return {
    id: row.id,
    name: row.name,
    isPublic: row.isPublic,
    status: row.status as RoomStatus,
    campaign: row.campaign,
    master: row.master,
    playerCount: row._count.profiles,
    createdAt: row.createdAt.toISOString(),
  };
}

function className(snapshot: CampaignSnapshot, classId: string): string {
  return snapshot.classes.find((c) => c.id === classId)?.name ?? classId;
}

/**
 * The room page read model: members (master first if they have no profile yet), the classes of
 * the current version with slot usage, and the access code for the master only.
 */
export function toRoomDetail(
  room: RoomWithRelations,
  { version, snapshot }: RoomVersion,
  viewerId: string,
): RoomDetail {
  const isMaster = room.masterId === viewerId;
  const masterHasProfile = room.profiles.some((p) => p.userId === room.masterId);
  const taken = new Map<string, number>();
  for (const profile of room.profiles) {
    taken.set(profile.classId, (taken.get(profile.classId) ?? 0) + 1);
  }

  return {
    id: room.id,
    name: room.name,
    isPublic: room.isPublic,
    status: room.status as RoomStatus,
    accessCode: isMaster ? room.accessCode : null,
    campaign: room.campaign,
    version,
    master: room.master,
    members: [
      ...(masterHasProfile
        ? []
        : [{ userId: room.master.id, name: room.master.name, isMaster: true, profile: null }]),
      ...room.profiles.map((profile) => ({
        userId: profile.userId,
        name: profile.user.name,
        isMaster: profile.userId === room.masterId,
        profile: {
          classId: profile.classId,
          className: className(snapshot, profile.classId),
          level: profile.level,
          downed: profile.downed,
        },
      })),
    ],
    classes: snapshot.classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      description: cls.description,
      artUrl: cls.artUrl ?? null,
      baseHp: cls.baseHp,
      baseEnergy: cls.baseEnergy,
      maxSlots: cls.maxSlots,
      slotsTaken: taken.get(cls.id) ?? 0,
    })),
    viewer: { isMaster, hasProfile: room.profiles.some((p) => p.userId === viewerId) },
  };
}
