import type { DraftNode } from '@rpg-chains/shared-types';
import { NODE_TYPE_LABELS } from './node-defaults';

/** Display name per node: its title, or "<Type label> <n>" (per-type array order) for untitled legacy nodes. */
export function nodeLabels(nodes: readonly DraftNode[]): Map<string, string> {
  const counters = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const node of nodes) {
    const n = (counters.get(node.type) ?? 0) + 1;
    counters.set(node.type, n);
    labels.set(node.id, node.title.trim() || `${NODE_TYPE_LABELS[node.type]} ${n}`);
  }
  return labels;
}
