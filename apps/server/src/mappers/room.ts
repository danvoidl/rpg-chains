import type { Room } from '@prisma/client';
import { deriveStats } from '@rpg-chains/battle-engine';
import type {
  BattleNodeOption,
  BattleSummary,
  CampaignSnapshot,
  RoomDetail,
  RoomStatus,
  RoomSummary,
  ShopNodeOption,
} from '@rpg-chains/shared-types';
import { RoomTurnTimersSchema } from '@rpg-chains/shared-types';
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

/** Every `battle`/`boss` node of the version, in chapter order. */
function battleNodes(snapshot: CampaignSnapshot): BattleNodeOption[] {
  const open = new Set(snapshot.questions.filter((q) => q.type === 'open').map((q) => q.id));
  return snapshot.chapters.flatMap((chapter) =>
    chapter.nodes.flatMap((node): BattleNodeOption[] =>
      node.type === 'battle' || node.type === 'boss'
        ? [
            {
              nodeId: node.id,
              title: node.title,
              type: node.type,
              chapterName: chapter.name,
              participantLimit: node.type === 'battle' ? node.participantLimit : null,
              needsMaster: node.questionIds.some((id) => open.has(id)),
            },
          ]
        : [],
    ),
  );
}

/** Every `shop` node of the version, in chapter order (provisional list until the map). */
function shopNodes(snapshot: CampaignSnapshot): ShopNodeOption[] {
  return snapshot.chapters.flatMap((chapter) =>
    chapter.nodes.flatMap((node): ShopNodeOption[] =>
      node.type === 'shop'
        ? [{ nodeId: node.id, title: node.title, chapterName: chapter.name }]
        : [],
    ),
  );
}

/** A profile's resources with the ceilings its class, level and points give. */
function resources(snapshot: CampaignSnapshot, profile: RoomWithRelations['profiles'][number]) {
  const cls = snapshot.classes.find((c) => c.id === profile.classId);
  const { maxHp, maxEnergy } = cls
    ? deriveStats(cls, profile.level, {
        strength: profile.strength,
        dexterity: profile.dexterity,
        intelligence: profile.intelligence,
      })
    : { maxHp: profile.currentHp, maxEnergy: profile.currentEnergy };
  return {
    currentHp: profile.currentHp,
    maxHp: Math.max(maxHp, 1),
    currentEnergy: profile.currentEnergy,
    maxEnergy,
  };
}

/**
 * The room page read model: members (master first if they have no profile yet), the classes of
 * the current version with slot usage, the battles forming or running, and the access code for
 * the master only.
 */
export function toRoomDetail(
  room: RoomWithRelations,
  { version, snapshot }: RoomVersion,
  battles: BattleSummary[],
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
          profileId: profile.id,
          classId: profile.classId,
          className: className(snapshot, profile.classId),
          level: profile.level,
          downed: profile.downed,
          ...resources(snapshot, profile),
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
    battles,
    battleNodes: battleNodes(snapshot),
    shopNodes: shopNodes(snapshot),
    turnTimers: RoomTurnTimersSchema.parse(room.turnTimers),
    viewer: { isMaster, hasProfile: room.profiles.some((p) => p.userId === viewerId) },
  };
}
