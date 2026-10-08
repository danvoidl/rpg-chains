import type { Edge, NodeType } from '@rpg-chains/shared-types';

/** The slice of a node the unlock rule reads; a snapshot node and a draft node both fit. */
export interface FlowNode {
  id: string;
  type: NodeType;
  mandatory: boolean;
  prerequisites: readonly string[];
}

/** The slice of a chapter the unlock rule reads (entry and boss resolved). */
export interface FlowChapter {
  entryNodeId: string;
  bossNodeId: string;
  nodes: readonly FlowNode[];
  edges: readonly Edge[];
}

/**
 * The unlock rule (spec §2.3, Fase 5 plan decision 2), for a node of a chapter the room has
 * reached: edges are the path, prerequisites are the lock. A node is unlocked when it is the
 * entry or some edge into it comes from a cleared node (OR — that is what makes branches), and
 * every prerequisite is cleared (AND). The boss also waits for every mandatory node of the
 * chapter, of any type.
 */
export function isNodeUnlocked(
  chapter: FlowChapter,
  cleared: ReadonlySet<string>,
  nodeId: string,
): boolean {
  const node = chapter.nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  const onPath =
    nodeId === chapter.entryNodeId ||
    chapter.edges.some((edge) => edge.to === nodeId && cleared.has(edge.from));
  if (!onPath || !node.prerequisites.every((id) => cleared.has(id))) return false;
  if (nodeId !== chapter.bossNodeId) return true;
  return chapter.nodes.every((n) => n.id === nodeId || !n.mandatory || cleared.has(n.id));
}

/**
 * Nodes that can never unlock, however the chapter is played (Fase 5 plan decision 8): clear
 * everything that unlocks until nothing changes; whatever is left is stuck — a prerequisite that
 * comes after the node, prerequisites waiting on each other, a mandatory node behind the boss.
 */
export function neverUnlockingNodes(chapter: FlowChapter): string[] {
  const cleared = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of chapter.nodes) {
      if (!cleared.has(node.id) && isNodeUnlocked(chapter, cleared, node.id)) {
        cleared.add(node.id);
        changed = true;
      }
    }
  }
  return chapter.nodes.filter((n) => !cleared.has(n.id)).map((n) => n.id);
}
