import type { Prisma } from '@prisma/client';
import { CampaignSnapshotSchema, type CampaignSnapshot } from '@rpg-chains/shared-types';
import { hasActiveBattle } from './active-battles.js';

interface RoomVersionRef {
  id: string;
  campaignId: string;
  campaignVersionId: string;
  status: string;
}

export interface RoomVersion {
  version: number;
  snapshot: CampaignSnapshot;
}

/**
 * The snapshot a room plays, rolling it forward first (spec §2.2, Fase 2 plan decision 6): if the
 * campaign has a newer published version and the room is open and not mid-battle, the room's
 * pointer moves to it. Lazy — it runs when the room is read or joined, never in the background.
 * Safe without further checks because every publish already passed the compatibility gate.
 */
export async function syncRoomVersion(
  tx: Prisma.TransactionClient,
  room: RoomVersionRef,
): Promise<RoomVersion> {
  let current = await tx.campaignVersion.findUniqueOrThrow({
    where: { id: room.campaignVersionId },
  });
  if (room.status === 'open' && !hasActiveBattle(room.id)) {
    const latest = await tx.campaignVersion.findFirstOrThrow({
      where: { campaignId: room.campaignId },
      orderBy: { version: 'desc' },
    });
    if (latest.version > current.version) {
      await tx.room.update({ where: { id: room.id }, data: { campaignVersionId: latest.id } });
      current = latest;
    }
  }
  return { version: current.version, snapshot: CampaignSnapshotSchema.parse(current.snapshot) };
}
