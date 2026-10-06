import type { Chapter } from './content.js';

/**
 * The structural slice of a chapter that graph analysis needs. Both a snapshot `Chapter` and
 * a draft chapter (with its nullable entry/boss resolved) satisfy it, so the editor and the
 * publish gate share one implementation.
 */
export type GraphShape = Pick<Chapter, 'entryNodeId' | 'bossNodeId' | 'edges'> & {
  nodes: ReadonlyArray<{ id: string }>;
};

/** Lightweight directed-graph view of a chapter for reachability analysis. */
interface ChapterGraph {
  entryId: string;
  bossId: string;
  nodeIds: Set<string>;
  adjacency: Map<string, string[]>;
}

function toGraph(chapter: GraphShape): ChapterGraph {
  const nodeIds = new Set(chapter.nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const { from, to } of chapter.edges) {
    if (nodeIds.has(from) && nodeIds.has(to)) adjacency.get(from)!.push(to);
  }
  return { entryId: chapter.entryNodeId, bossId: chapter.bossNodeId, nodeIds, adjacency };
}

/** Every node reachable from `entry` while skipping every node in `blocked`. */
function reachableSet(graph: ChapterGraph, blocked: Set<string>): Set<string> {
  const seen = new Set<string>();
  if (blocked.has(graph.entryId) || !graph.nodeIds.has(graph.entryId)) return seen;
  seen.add(graph.entryId);
  const stack = [graph.entryId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const next of graph.adjacency.get(current) ?? []) {
      if (!seen.has(next) && !blocked.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

/** Ids of every node reachable from the chapter's entry (the entry included, if it exists). */
export function reachableNodeIds(chapter: GraphShape): Set<string> {
  return reachableSet(toGraph(chapter), new Set());
}

/**
 * A node is single-path when every route from entry to boss passes through it — i.e.
 * removing it disconnects the boss from the entry. Only single-path battles (and bosses)
 * may host open questions (spec §3.2); parallel-branch nodes must use objective ones.
 */
export function isSinglePathNode(chapter: GraphShape, nodeId: string): boolean {
  const graph = toGraph(chapter);
  if (nodeId === graph.entryId || nodeId === graph.bossId) return true;
  if (!graph.nodeIds.has(nodeId)) return false;
  return !reachableSet(graph, new Set([nodeId])).has(graph.bossId);
}
