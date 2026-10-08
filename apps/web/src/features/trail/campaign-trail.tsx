'use client';

import { useEffect, useRef, useState } from 'react';
import { TRAIL_WIDTH, type RoomDetail } from '@rpg-chains/shared-types';
import { ChapterOpening } from './chapter-opening';
import { ChapterTrail } from './chapter-trail';
import { hasSeenOpening, markOpeningSeen } from './opening-seen';

/** `localStorage`, or nothing when the browser blocks even reading the property. */
function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

interface CampaignTrailProps {
  room: RoomDetail;
  userId: string;
}

/**
 * The campaign trail (Fase 5 plan decision 13): every chapter in one vertical scroll, a fixed
 * column the same on phone and desktop — the cleared ones above, the current one scrolled into
 * view when the room opens, the locked ones in grey below and the ones under construction last.
 * No lines are drawn between nodes; each node's state guides the player.
 */
export function CampaignTrail({ room, userId }: CampaignTrailProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = useRef<HTMLElement>(null);
  const { chapters, upcomingChapters } = room.progress;
  const currentIndex = chapters.findIndex((c) => c.state === 'current');

  // The opening on screen: the current chapter's the first time a player sees it in this
  // browser, or any unlocked chapter's when "Ver abertura" is tapped.
  const [openingId, setOpeningId] = useState<string | null>(null);
  const currentId = chapters[currentIndex]?.chapterId;
  const currentHasOpening = chapters[currentIndex]?.opening != null;
  useEffect(() => {
    if (!currentId || !currentHasOpening || !room.viewer.hasProfile) return;
    if (!hasSeenOpening(safeStorage(), room.id, currentId)) setOpeningId(currentId);
  }, [room.id, room.viewer.hasProfile, currentId, currentHasOpening]);
  const opening = chapters.find((c) => c.chapterId === openingId && c.opening) ?? null;
  const closeOpening = () => {
    if (openingId) markOpeningSeen(safeStorage(), room.id, openingId);
    setOpeningId(null);
  };

  // Only on the first render with a later chapter current: never yank the page afterwards.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || currentIndex <= 0) return;
    scrolled.current = true;
    current.current?.scrollIntoView({ block: 'start' });
  }, [currentIndex]);

  return (
    <div
      aria-label="Trilha da campanha"
      role="region"
      className="mx-auto w-full"
      style={{ maxWidth: TRAIL_WIDTH }}
    >
      <div className="divide-y divide-gray-200 [&>*]:py-6 [&>*:first-child]:pt-0">
        {chapters.map((chapter, index) => (
          <ChapterTrail
            key={chapter.chapterId}
            ref={index === currentIndex ? current : undefined}
            room={room}
            chapter={chapter}
            index={index}
            userId={userId}
            selectedNodeId={selected}
            onSelect={setSelected}
            onShowOpening={() => setOpeningId(chapter.chapterId)}
          />
        ))}
        {upcomingChapters.map((chapter, offset) => (
          <section
            key={chapter.id}
            aria-label={`Capítulo ${chapters.length + offset + 1}: ${chapter.name}`}
            className="space-y-2"
          >
            <h3 className="font-semibold text-gray-400">
              <span className="text-sm font-normal">
                Capítulo {chapters.length + offset + 1} ·{' '}
              </span>
              {chapter.name}
            </h3>
            <p className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
              Em construção
            </p>
          </section>
        ))}
      </div>
      {opening && <ChapterOpening chapter={opening} onClose={closeOpening} />}
      {room.progress.completed && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-center text-sm font-medium text-amber-900">
          Campanha concluída!
        </p>
      )}
    </div>
  );
}
