import { forwardRef } from 'react';
import { TRAIL_WIDTH, type ChapterProgressView, type RoomDetail } from '@rpg-chains/shared-types';
import { NodeBalloon } from './node-balloon';
import { TrailNode } from './trail-node';
import { cellBox, chapterHeight } from './trail-geometry';

interface ChapterTrailProps {
  room: RoomDetail;
  chapter: ChapterProgressView;
  index: number;
  userId: string;
  selectedNodeId: string | null;
  onSelect: (nodeId: string | null) => void;
  onShowOpening: () => void;
}

const STATE_BADGES: Record<ChapterProgressView['state'], string | null> = {
  current: null,
  cleared: 'concluído',
  locked: 'bloqueado',
};

/**
 * One chapter on the trail (Fase 5 plan decisions 13 and 17): its header and its world, scaled
 * to the column's width, with every node at the author's position. A locked chapter is drawn in
 * grey and cannot be opened.
 */
export const ChapterTrail = forwardRef<HTMLElement, ChapterTrailProps>(function ChapterTrail(
  { room, chapter, index, userId, selectedNodeId, onSelect, onShowOpening },
  ref,
) {
  const height = chapterHeight(chapter);
  const locked = chapter.state === 'locked';
  const badge = STATE_BADGES[chapter.state];
  const selected = chapter.nodes.find((n) => n.nodeId === selectedNodeId) ?? null;

  return (
    <section ref={ref} aria-label={`Capítulo ${index + 1}: ${chapter.name}`} className="space-y-3">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className={`font-semibold ${locked ? 'text-gray-400' : 'text-gray-900'}`}>
          <span className="text-sm font-normal text-gray-500">Capítulo {index + 1} · </span>
          {chapter.name}
        </h3>
        <div className="flex items-baseline gap-2">
          {chapter.opening && !locked && (
            <button
              type="button"
              className="text-xs font-medium text-indigo-700 hover:underline"
              onClick={onShowOpening}
            >
              Ver abertura
            </button>
          )}
          {badge && <span className="text-xs text-gray-500">{badge}</span>}
        </div>
      </header>
      <div
        className={`relative w-full overflow-visible rounded-lg ${locked ? 'opacity-60 grayscale' : ''}`}
        style={{
          aspectRatio: `${TRAIL_WIDTH} / ${height}`,
          backgroundImage: chapter.background ? `url(${chapter.background.imageUrl})` : undefined,
          backgroundSize: '100% auto',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {chapter.nodes.map((node) => (
          <TrailNode
            key={node.nodeId}
            node={node}
            box={cellBox(node.position, height)}
            lit={chapter.campfireNodeId === node.nodeId}
            selected={node.nodeId === selectedNodeId}
            disabled={locked}
            onSelect={() => onSelect(node.nodeId === selectedNodeId ? null : node.nodeId)}
          />
        ))}
        {selected && (
          <NodeBalloon
            key={selected.nodeId}
            room={room}
            chapter={chapter}
            node={selected}
            userId={userId}
            top={(() => {
              const box = cellBox(selected.position, height);
              return box.top + box.height;
            })()}
            onClose={() => onSelect(null)}
          />
        )}
      </div>
    </section>
  );
});
