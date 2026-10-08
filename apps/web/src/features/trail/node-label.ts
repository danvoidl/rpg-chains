import type { NodeProgressView, NodeType } from '@rpg-chains/shared-types';

const TYPE_LABELS: Record<NodeType, string> = {
  battle: 'Batalha',
  boss: 'Chefe',
  shop: 'Loja',
  campfire: 'Fogueira',
  narrative: 'Narrativa',
};

const TYPE_ICONS: Record<NodeType, string> = {
  battle: '⚔️',
  boss: '👑',
  shop: '🛒',
  campfire: '🔥',
  narrative: '📜',
};

/** The node's name on the trail: the author's title, or its type when it has none. */
export function nodeName(node: Pick<NodeProgressView, 'title' | 'type'>): string {
  return node.title.trim() || TYPE_LABELS[node.type];
}

export function nodeIcon(type: NodeType): string {
  return TYPE_ICONS[type];
}

/** What the node's state means for its type, for the accessible name and the balloon. */
export function nodeStateLabel(node: Pick<NodeProgressView, 'type' | 'state'>): string {
  if (node.state === 'locked') return 'bloqueado';
  if (node.state === 'unlocked') return 'liberado';
  switch (node.type) {
    case 'battle':
    case 'boss':
      return 'vencido';
    case 'shop':
      return 'visitada';
    case 'campfire':
      return 'acesa';
    case 'narrative':
      return 'lida';
  }
}
