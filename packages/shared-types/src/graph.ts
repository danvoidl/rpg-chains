import type { Chapter } from './content.js';

/** Lightweight directed-graph view of a chapter for reachability analysis. */
interface ChapterGraph {
  entryId: string;
  bossId: string;
  nodeIds: Set<string>;
  adjacency: Map<string, string[]>;
}

function toGraph(chapter: Chapter): ChapterGraph {
  const nodeIds = new Set(chapter.nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const { from, to } of chapter.edges) {
    if (nodeIds.has(from) && nodeIds.has(to)) adjacency.get(from)!.push(to);
  }
  return { entryId: chapter.entryNodeId, bossId: chapter.bossNodeId, nodeIds, adjacency };
}

/** Whether `boss` is reachable from `entry` while skipping every node in `blocked`. */
function reachableAvoiding(graph: ChapterGraph, blocked: Set<string>): boolean {
  if (blocked.has(graph.entryId)) return false;
  const seen = new Set<string>([graph.entryId]);
  const stack = [graph.entryId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === graph.bossId) return true;
    for (const next of graph.adjacency.get(current) ?? []) {
      if (!seen.has(next) && !blocked.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return false;
}

/**
 * A node is single-path when every route from entry to boss passes through it — i.e.
 * removing it disconnects the boss from the entry. Only single-path battles (and bosses)
 * may host open questions (spec §3.2); parallel-branch nodes must use objective ones.
 */
export function isSinglePathNode(chapter: Chapter, nodeId: string): boolean {
  const graph = toGraph(chapter);
  if (nodeId === graph.entryId || nodeId === graph.bossId) return true;
  if (!graph.nodeIds.has(nodeId)) return false;
  return !reachableAvoiding(graph, new Set([nodeId]));
}
