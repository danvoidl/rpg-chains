import type {
  CampaignProgressView,
  ChapterProgressView,
  NodeProgressView,
} from '@rpg-chains/shared-types';
import { nodeName } from '../trail/node-label';

export function findNode(
  progress: CampaignProgressView,
  nodeId: string,
): { chapter: ChapterProgressView; node: NodeProgressView } | null {
  for (const chapter of progress.chapters) {
    const node = chapter.nodes.find((n) => n.nodeId === nodeId);
    if (node) return { chapter, node };
  }
  return null;
}

/** Ids of every cleared node of the room's progress. */
export function clearedNodeIds(progress: CampaignProgressView): Set<string> {
  const ids = new Set<string>();
  for (const chapter of progress.chapters) {
    for (const node of chapter.nodes) if (node.state === 'cleared') ids.add(node.nodeId);
  }
  return ids;
}

/** Nodes that were cleared before and no longer are (what a defeat rolled back). */
export function reopenedNodes(
  before: ReadonlySet<string>,
  progress: CampaignProgressView,
): NodeProgressView[] {
  return progress.chapters.flatMap((chapter) =>
    chapter.nodes.filter((node) => node.state !== 'cleared' && before.has(node.nodeId)),
  );
}

/** Where the defeated group went back to. */
export function defeatReturnText(chapter: ChapterProgressView | null): string {
  if (!chapter || chapter.campfireNodeId === null) return 'O grupo voltou ao início do capítulo.';
  const campfire = chapter.nodes.find((n) => n.nodeId === chapter.campfireNodeId);
  return `O grupo voltou à fogueira ${campfire ? nodeName(campfire) : 'Fogueira'}.`;
}
