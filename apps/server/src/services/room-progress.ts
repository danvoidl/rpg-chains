import type { Prisma } from '@prisma/client';
import { campaignCompleted, type RoomProgress } from '@rpg-chains/campaign-rules';
import type { CampaignSnapshot, RoomStatus } from '@rpg-chains/shared-types';

/**
 * A room's progress through its campaign (Fase 5 plan decisions 1 and 14): the stored facts in
 * `RoomNodeClear`, `RoomChapterState` and `Room.progressSeq`, turned into the `RoomProgress` the
 * pure rules of `campaign-rules` read and return. The server never decides what unlocks: it
 * loads, calls a rule, and saves the difference. Every change runs under the room lock.
 */

export async function loadProgress(
  tx: Prisma.TransactionClient,
  roomId: string,
): Promise<RoomProgress> {
  const [room, clears, chapters] = await Promise.all([
    tx.room.findUniqueOrThrow({ where: { id: roomId }, select: { progressSeq: true } }),
    tx.roomNodeClear.findMany({ where: { roomId }, orderBy: { seq: 'asc' } }),
    tx.roomChapterState.findMany({ where: { roomId } }),
  ]);
  return {
    seq: room.progressSeq,
    clears: clears.map(({ chapterId, nodeId, seq, profileIds }) => ({
      chapterId,
      nodeId,
      seq,
      profileIds,
    })),
    campfires: chapters.flatMap((c) =>
      c.campfireNodeId !== null && c.campfireSeq !== null
        ? [{ chapterId: c.chapterId, nodeId: c.campfireNodeId, seq: c.campfireSeq }]
        : [],
    ),
    clearedChapterIds: chapters.filter((c) => c.clearedAt !== null).map((c) => c.chapterId),
  };
}

/** Writes what changed between `before` and `after` (both from the same lock). */
async function saveProgress(
  tx: Prisma.TransactionClient,
  roomId: string,
  before: RoomProgress,
  after: RoomProgress,
): Promise<void> {
  const kept = new Set(after.clears.map((c) => c.nodeId));
  const removed = before.clears.filter((c) => !kept.has(c.nodeId)).map((c) => c.nodeId);
  if (removed.length > 0) {
    await tx.roomNodeClear.deleteMany({ where: { roomId, nodeId: { in: removed } } });
  }
  const had = new Set(before.clears.map((c) => c.nodeId));
  const added = after.clears.filter((c) => !had.has(c.nodeId));
  if (added.length > 0) {
    await tx.roomNodeClear.createMany({
      data: added.map((c) => ({ roomId, ...c, profileIds: [...c.profileIds] })),
    });
  }

  const chapterIds = new Set([
    ...after.campfires.map((c) => c.chapterId),
    ...after.clearedChapterIds,
  ]);
  for (const chapterId of chapterIds) {
    const campfire = after.campfires.find((c) => c.chapterId === chapterId);
    const wasCampfire = before.campfires.find((c) => c.chapterId === chapterId);
    const cleared = after.clearedChapterIds.includes(chapterId);
    const wasCleared = before.clearedChapterIds.includes(chapterId);
    if (campfire?.seq === wasCampfire?.seq && cleared === wasCleared) continue;
    const data = {
      campfireNodeId: campfire?.nodeId ?? null,
      campfireSeq: campfire?.seq ?? null,
      ...(cleared && !wasCleared ? { clearedAt: new Date() } : {}),
    };
    await tx.roomChapterState.upsert({
      where: { roomId_chapterId: { roomId, chapterId } },
      create: { roomId, chapterId, ...data },
      update: data,
    });
  }
  if (after.seq !== before.seq) {
    await tx.room.update({ where: { id: roomId }, data: { progressSeq: after.seq } });
  }
}

/**
 * Keeps the room's status in step with its progress (spec §7, decision 9): beating the last
 * chapter's boss completes it; a new version with a chapter it has not cleared reopens it. A
 * closed room never changes.
 */
export async function syncCompletion(
  tx: Prisma.TransactionClient,
  room: { id: string; status: string },
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
): Promise<RoomStatus> {
  if (room.status === 'closed') return 'closed';
  const status: RoomStatus = campaignCompleted(snapshot, progress) ? 'completed' : 'open';
  if (status !== room.status) {
    await tx.room.update({
      where: { id: room.id },
      data: { status, completedAt: status === 'completed' ? new Date() : null },
    });
  }
  return status;
}

/**
 * Loads the room's progress, applies one pure rule to it, saves the difference and keeps the
 * room's status in step. Call it inside a transaction that already holds `lockRoom`.
 */
export async function changeProgress(
  tx: Prisma.TransactionClient,
  room: { id: string; status: string },
  snapshot: CampaignSnapshot,
  change: (progress: RoomProgress) => RoomProgress,
): Promise<RoomProgress> {
  const before = await loadProgress(tx, room.id);
  const after = change(before);
  if (after !== before) {
    await saveProgress(tx, room.id, before, after);
    await syncCompletion(tx, room, snapshot, after);
  }
  return after;
}
