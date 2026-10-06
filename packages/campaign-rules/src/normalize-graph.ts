import type { DraftGraph } from '@rpg-chains/shared-types';

/**
 * Drops references to nodes that are not in the graph: dangling or duplicate edges,
 * prerequisites to removed nodes, and an entry/boss pointing at a removed node (edges and
 * these refs are not FKs). Applied on every graph save so deleting a node cleans up after it.
 */
export function normalizeGraph(graph: DraftGraph): DraftGraph {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const seenEdges = new Set<string>();
  const edges = graph.edges.filter(({ from, to }) => {
    const key = `${from}->${to}`;
    if (!nodeIds.has(from) || !nodeIds.has(to) || seenEdges.has(key)) return false;
    seenEdges.add(key);
    return true;
  });
  return {
    entryNodeId: graph.entryNodeId && nodeIds.has(graph.entryNodeId) ? graph.entryNodeId : null,
    bossNodeId: graph.bossNodeId && nodeIds.has(graph.bossNodeId) ? graph.bossNodeId : null,
    nodes: graph.nodes.map((node) => ({
      ...node,
      prerequisites: node.prerequisites.filter((id) => nodeIds.has(id) && id !== node.id),
    })),
    edges,
  };
}
