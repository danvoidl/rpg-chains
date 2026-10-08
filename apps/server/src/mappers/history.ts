import type { History, Room } from '@prisma/client';
import {
  HistoryFinalDataSchema,
  type CampaignSnapshot,
  type HistoryEntry,
  type HistoryFinalData,
} from '@rpg-chains/shared-types';
import type { RoomWithRelations } from '../services/room-query.js';

/**
 * A player's character as the room closes (spec §7, Fase 5 plan decision 10): their own record,
 * with their private gold and how far the room got.
 */
export function toHistoryFinalData(
  profile: RoomWithRelations['profiles'][number],
  snapshot: CampaignSnapshot,
  progress: { completed: boolean; chaptersCleared: number },
): HistoryFinalData {
  return {
    classId: profile.classId,
    className: snapshot.classes.find((c) => c.id === profile.classId)?.name ?? null,
    level: profile.level,
    xp: profile.xp,
    attributes: {
      strength: profile.strength,
      dexterity: profile.dexterity,
      intelligence: profile.intelligence,
    },
    downed: profile.downed,
    gold: profile.gold,
    equipment: HistoryFinalDataSchema.shape.equipment.parse(profile.equipment),
    inventory: HistoryFinalDataSchema.shape.inventory.parse(profile.inventory),
    ...progress,
  };
}

/** A history row as the player's history page lists it; rows from before Fase 5 get defaults. */
export function toHistoryEntry(
  row: History & { room: Pick<Room, 'name' | 'closedAt'> },
): HistoryEntry {
  return {
    id: row.id,
    roomId: row.roomId,
    roomName: row.room.name,
    campaignName: row.campaignName,
    closedAt: (row.room.closedAt ?? row.createdAt).toISOString(),
    character: HistoryFinalDataSchema.parse(row.finalData),
  };
}
