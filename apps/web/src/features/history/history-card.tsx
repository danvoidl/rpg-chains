import type { HistoryEntry } from '@rpg-chains/shared-types';
import { ATTRIBUTES } from '@rpg-chains/game-config';
import { ATTRIBUTE_LABELS } from '@/features/effects/effect-labels';

/** One closed campaign: how the player's character ended it. */
export function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const { character } = entry;
  const equipped = Object.values(character.equipment).filter(Boolean).length;
  const closedAt = new Date(entry.closedAt).toLocaleDateString('pt-BR');
  const outcome = character.completed
    ? 'Campanha concluída'
    : `${character.chaptersCleared} ${character.chaptersCleared === 1 ? 'capítulo concluído' : 'capítulos concluídos'}`;

  return (
    <li
      aria-label={entry.campaignName}
      className="space-y-2 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{entry.campaignName}</h2>
        <p className="text-sm font-medium text-amber-700">{outcome}</p>
      </div>
      <p className="text-sm text-gray-500">
        {entry.roomName} · encerrada em {closedAt}
      </p>
      <p className="text-sm text-gray-800">
        {character.className ?? 'Classe removida'} · nível {character.level} · {character.xp} XP ·{' '}
        {character.gold} de ouro
      </p>
      <dl className="grid grid-cols-3 gap-x-4 text-sm">
        {ATTRIBUTES.map((attribute) => (
          <div key={attribute}>
            <dt className="text-gray-500">{ATTRIBUTE_LABELS[attribute]}</dt>
            <dd className="font-medium text-gray-900">{character.attributes[attribute]}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-gray-600">
        {equipped} {equipped === 1 ? 'item equipado' : 'itens equipados'} ·{' '}
        {character.inventory.length}{' '}
        {character.inventory.length === 1 ? 'item no inventário' : 'itens no inventário'}
      </p>
    </li>
  );
}
