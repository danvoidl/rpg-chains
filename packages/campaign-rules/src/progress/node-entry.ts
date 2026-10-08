import type { CampaignSnapshot, NodeType } from '@rpg-chains/shared-types';
import { locateNode, nodeState } from './node-state.js';
import type { RoomProgress } from './room-progress.js';

export type NodeEntryRefusal =
  'node_not_found' | 'wrong_node_type' | 'node_locked' | 'node_cleared';

const COMBAT_TYPES: ReadonlySet<NodeType> = new Set(['battle', 'boss']);

/**
 * Whether the room may use `nodeId` as one of the `expected` types now (Fase 5 plan decisions
 * 2–4, 12): it must be unlocked or cleared. A cleared battle or boss is closed — no refight, so no
 * XP farming (decision 3); a cleared shop, campfire or narrative stays open.
 */
export function checkNodeEntry(
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
  nodeId: string,
  expected: readonly NodeType[],
): NodeEntryRefusal | null {
  const located = locateNode(snapshot, nodeId);
  if (!located) return 'node_not_found';
  if (!expected.includes(located.node.type)) return 'wrong_node_type';
  const state = nodeState(snapshot, progress, located);
  if (state === 'locked') return 'node_locked';
  if (state === 'cleared' && COMBAT_TYPES.has(located.node.type)) return 'node_cleared';
  return null;
}
