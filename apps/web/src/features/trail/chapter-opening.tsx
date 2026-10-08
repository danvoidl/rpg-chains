'use client';

import { useEffect } from 'react';
import type { ChapterProgressView } from '@rpg-chains/shared-types';

interface ChapterOpeningProps {
  chapter: Pick<ChapterProgressView, 'name' | 'opening'>;
  onClose: () => void;
}

/** A chapter's opening (Fase 5 plan decision 11): name, video and text, closed with "Começar". */
export function ChapterOpening({ chapter, onClose }: ChapterOpeningProps) {
  const { opening } = chapter;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!opening) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Abertura: ${chapter.name}`}
        className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 className="text-xl font-bold text-gray-900">{chapter.name}</h2>
        {opening.videoUrl && (
          <video controls src={opening.videoUrl} className="w-full rounded-lg bg-black" />
        )}
        {opening.text && <p className="whitespace-pre-wrap text-gray-800">{opening.text}</p>}
        <button
          type="button"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          onClick={onClose}
        >
          Começar
        </button>
      </div>
    </div>
  );
}
