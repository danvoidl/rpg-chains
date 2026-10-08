import type { CampaignSnapshot } from '@rpg-chains/shared-types';
import { locateNode } from './node-state.js';
import type { RoomProgress } from './room-progress.js';

/**
 * The facts a room records (Fase 5 plan decisions 1, 4 and 5). Pure: each takes the progress and
 * returns the next one. They record, they do not gate — the caller checks `checkNodeEntry`
 * first. An unknown node leaves the progress unchanged.
 */

/**
 * `nodeId` was cleared by `profileIds`: a battle won by its participants, a shop opened, a
 * narrative continued. Clearing the chapter's boss clears the chapter, which reaches the next
 * one. Clearing an already cleared node changes nothing (the first ones keep the credit).
 */
export function recordNodeCleared(
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
  nodeId: string,
  profileIds: readonly string[],
): RoomProgress {
  const located = locateNode(snapshot, nodeId);
  if (!located || progress.clears.some((c) => c.nodeId === nodeId)) return progress;
  const { chapter } = located;
  const seq = progress.seq + 1;
  const clearsChapter =
    nodeId === chapter.bossNodeId && !progress.clearedChapterIds.includes(chapter.id);
  return {
    ...progress,
    seq,
    clears: [...progress.clears, { chapterId: chapter.id, nodeId, seq, profileIds }],
    clearedChapterIds: clearsChapter
      ? [...progress.clearedChapterIds, chapter.id]
      : progress.clearedChapterIds,
  };
}

/**
 * A campfire was lit (decision 4): it is cleared on first lighting, and becomes the chapter's
 * point of return — relighting an older campfire moves the point back to it.
 */
export function recordCampfireLit(
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
  nodeId: string,
  profileIds: readonly string[],
): RoomProgress {
  const located = locateNode(snapshot, nodeId);
  if (!located || located.node.type !== 'campfire') return progress;
  const chapterId = located.chapter.id;
  const seq = progress.seq + 1;
  const alreadyCleared = progress.clears.some((c) => c.nodeId === nodeId);
  return {
    ...progress,
    seq,
    clears: alreadyCleared
      ? progress.clears
      : [...progress.clears, { chapterId, nodeId, seq, profileIds }],
    campfires: [
      ...progress.campfires.filter((c) => c.chapterId !== chapterId),
      { chapterId, nodeId, seq },
    ],
  };
}

/**
 * A battle on `nodeId` was lost by `defeatedProfileIds` (spec §3.7, decision 5, option b): the
 * chapter returns to its last lit campfire — or its entry, without one — but only in what the
 * defeated took part in. Clears of that chapter made after the campfire with any of them are
 * undone; what another group cleared without them stays, and so does everything before the
 * campfire, the campfire itself, other chapters, and a beaten boss (a cleared chapter is
 * permanent). A node whose unlocker was undone stays cleared if it was cleared.
 */
export function rollbackDefeat(
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
  nodeId: string,
  defeatedProfileIds: readonly string[],
): RoomProgress {
  const located = locateNode(snapshot, nodeId);
  if (!located) return progress;
  const { chapter } = located;
  const since = progress.campfires.find((c) => c.chapterId === chapter.id)?.seq ?? 0;
  const defeated = new Set(defeatedProfileIds);
  const undone = (clear: RoomProgress['clears'][number]) =>
    clear.chapterId === chapter.id &&
    clear.seq > since &&
    clear.nodeId !== chapter.bossNodeId &&
    clear.profileIds.some((id) => defeated.has(id));
  if (!progress.clears.some(undone)) return progress;
  return { ...progress, clears: progress.clears.filter((clear) => !undone(clear)) };
}
