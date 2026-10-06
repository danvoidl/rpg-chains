import type { PublicBattleEvent, PublicBattleState } from '@rpg-chains/shared-types';
import { describeEvent } from './event-text';

interface EventFeedProps {
  feed: PublicBattleEvent[];
  view: PublicBattleState;
}

/** What just happened, newest first. */
export function EventFeed({ feed, view }: EventFeedProps) {
  const lines = feed
    .map((event, index) => ({ index, text: describeEvent(event, view) }))
    .filter((line): line is { index: number; text: string } => line.text !== null)
    .reverse();
  return (
    <section aria-label="Acontecimentos" className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-900">Acontecimentos</h2>
      {lines.length === 0 ? (
        <p className="text-sm text-gray-500">Nada ainda.</p>
      ) : (
        <ol className="max-h-72 space-y-1 overflow-y-auto text-sm text-gray-700">
          {lines.map((line) => (
            <li key={line.index}>{line.text}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
