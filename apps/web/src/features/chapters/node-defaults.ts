import type { DraftNode, NodeType } from '@rpg-chains/shared-types';
import { randomId } from '@/lib/random-id';

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  battle: 'Batalha',
  boss: 'Chefe',
  shop: 'Loja',
  campfire: 'Fogueira',
  narrative: 'Narrativa',
};

/** Next default title "<Type label> <n>", where n follows the highest number already used for the type. */
function nextTitle(type: NodeType, existingNodes: readonly DraftNode[]): string {
  const label = NODE_TYPE_LABELS[type];
  const pattern = new RegExp(`^${label} (\\d+)$`);
  const highest = existingNodes.reduce((max, node) => {
    if (node.type !== type) return max;
    const match = pattern.exec(node.title.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${label} ${highest + 1}`;
}

/** Builds a new node of the given type with sensible defaults and a client-side id. */
export function createNode(
  type: NodeType,
  position: { x: number; y: number },
  existingNodes: readonly DraftNode[],
): DraftNode {
  const base = {
    id: randomId(),
    title: nextTitle(type, existingNodes),
    mandatory: type === 'boss',
    recommendedLevel: null,
    participantLimit: null,
    position,
    prerequisites: [],
  };

  switch (type) {
    case 'battle':
      return { ...base, type, config: { villainIds: [], questionIds: [] } };
    case 'boss':
      return { ...base, type, config: { villainIds: [], questionIds: [] } };
    case 'shop':
      return { ...base, type, config: { itemIds: [] } };
    case 'campfire':
      return { ...base, type, config: {} };
    case 'narrative':
      return { ...base, type, config: { text: '', videoUrl: null } };
  }
}
