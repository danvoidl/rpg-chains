import type { DraftGraph, DraftNode } from '@rpg-chains/shared-types';

/** Appends a node to the graph. */
export function addNode(graph: DraftGraph, node: DraftNode): DraftGraph {
  return { ...graph, nodes: [...graph.nodes, node] };
}

/** Replaces one node's position. */
export function moveNode(
  graph: DraftGraph,
  id: string,
  position: { x: number; y: number },
): DraftGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, position } : n)) };
}

/** Applies an updater to one node. */
export function updateNode(
  graph: DraftGraph,
  id: string,
  updater: (node: DraftNode) => DraftNode,
): DraftGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? updater(n) : n)) };
}

/** Removes nodes with their edges, clears entry/boss and drops them from prerequisites. */
export function removeNodes(graph: DraftGraph, ids: readonly string[]): DraftGraph {
  const gone = new Set(ids);
  return {
    entryNodeId: graph.entryNodeId && gone.has(graph.entryNodeId) ? null : graph.entryNodeId,
    bossNodeId: graph.bossNodeId && gone.has(graph.bossNodeId) ? null : graph.bossNodeId,
    nodes: graph.nodes
      .filter((n) => !gone.has(n.id))
      .map((n) => ({ ...n, prerequisites: n.prerequisites.filter((p) => !gone.has(p)) })),
    edges: graph.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)),
  };
}

/** Adds the edge when missing. */
export function connect(graph: DraftGraph, from: string, to: string): DraftGraph {
  if (from === to || graph.edges.some((e) => e.from === from && e.to === to)) return graph;
  return { ...graph, edges: [...graph.edges, { from, to }] };
}

/** Removes the given edges. */
export function disconnect(
  graph: DraftGraph,
  edges: ReadonlyArray<{ from: string; to: string }>,
): DraftGraph {
  return {
    ...graph,
    edges: graph.edges.filter((e) => !edges.some((r) => r.from === e.from && r.to === e.to)),
  };
}

/** Adds the edge when missing, removes it otherwise. */
export function toggleEdge(graph: DraftGraph, from: string, to: string): DraftGraph {
  return graph.edges.some((e) => e.from === from && e.to === to)
    ? disconnect(graph, [{ from, to }])
    : connect(graph, from, to);
}
