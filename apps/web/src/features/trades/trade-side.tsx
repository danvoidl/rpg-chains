import type { TradeSideView } from '@rpg-chains/shared-types';

/** "15 de ouro, Elmo ×1" — or "nada" for an empty side. */
export function describeSide(side: TradeSideView): string {
  const parts = [
    ...(side.gold > 0 ? [`${side.gold} de ouro`] : []),
    ...side.items.map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)),
  ];
  return parts.length > 0 ? parts.join(', ') : 'nada';
}
