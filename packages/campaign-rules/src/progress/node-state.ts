import type {
  CampaignSnapshot,
  Chapter,
  ChapterNode,
  ChapterState,
  NodeState,
} from '@rpg-chains/shared-types';
import type { RoomProgress } from './room-progress.js';
import { isNodeUnlocked } from './unlock.js';

export interface LocatedNode {
  chapter: Chapter;
  chapterIndex: number;
  node: ChapterNode;
}

export function locateNode(snapshot: CampaignSnapshot, nodeId: string): LocatedNode | null {
  for (const [chapterIndex, chapter] of snapshot.chapters.entries()) {
    const node = chapter.nodes.find((n) => n.id === nodeId);
    if (node) return { chapter, chapterIndex, node };
  }
  return null;
}

export function clearedNodeIds(progress: RoomProgress): Set<string> {
  return new Set(progress.clears.map((c) => c.nodeId));
}

/**
 * A chapter is reached once the previous one is cleared; the first one always is. Cleared
 * chapters stay open (Fase 5 plan decision 6).
 */
export function chapterState(
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
  chapterIndex: number,
): ChapterState {
  const chapter = snapshot.chapters[chapterIndex]!;
  if (progress.clearedChapterIds.includes(chapter.id)) return 'cleared';
  const previous = snapshot.chapters[chapterIndex - 1];
  if (!previous || progress.clearedChapterIds.includes(previous.id)) return 'current';
  return 'locked';
}

/** A node's state in a chapter whose state and cleared set the caller already has. */
export function stateInChapter(
  chapter: Chapter,
  reached: boolean,
  cleared: ReadonlySet<string>,
  nodeId: string,
): NodeState {
  if (cleared.has(nodeId)) return 'cleared';
  return reached && isNodeUnlocked(chapter, cleared, nodeId) ? 'unlocked' : 'locked';
}

export function nodeState(
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
  located: LocatedNode,
): NodeState {
  const reached = chapterState(snapshot, progress, located.chapterIndex) !== 'locked';
  return stateInChapter(located.chapter, reached, clearedNodeIds(progress), located.node.id);
}

/** The boss of the last published chapter has been beaten (spec §7). */
export function campaignCompleted(snapshot: CampaignSnapshot, progress: RoomProgress): boolean {
  return (
    snapshot.chapters.length > 0 &&
    snapshot.chapters.every((c) => progress.clearedChapterIds.includes(c.id))
  );
}
