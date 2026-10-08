'use client';

import { useState } from 'react';
import type { DraftChapter } from '@rpg-chains/shared-types';
import { VideoUpload } from '@/components/video-upload';
import { useChapter, useUpdateChapter } from './api';

interface ChapterOpeningFormProps {
  campaignId: string;
  chapterId: string;
}

interface OpeningFieldsProps {
  campaignId: string;
  chapter: DraftChapter;
}

function OpeningFields({ campaignId, chapter }: OpeningFieldsProps) {
  const updateChapter = useUpdateChapter(campaignId);
  const [text, setText] = useState(chapter.opening.text);
  const [videoUrl, setVideoUrl] = useState<string | null>(chapter.opening.videoUrl);
  const [saved, setSaved] = useState(false);
  const textId = `opening-text-${chapter.id}`;

  const handleSave = async () => {
    setSaved(false);
    await updateChapter.mutateAsync({
      chapterId: chapter.id,
      data: { opening: { text, videoUrl } },
    });
    setSaved(true);
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={textId} className="block text-sm font-medium text-gray-700">
          Texto de abertura
        </label>
        <textarea
          id={textId}
          rows={4}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <VideoUpload
        id={`opening-video-${chapter.id}`}
        label="Vídeo de abertura"
        value={videoUrl}
        onChange={(url) => {
          setVideoUrl(url);
          setSaved(false);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateChapter.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Salvar abertura
        </button>
        {saved && (
          <p role="status" className="text-sm text-green-700">
            Abertura salva
          </p>
        )}
        {updateChapter.isError && (
          <p role="alert" className="text-sm text-red-600">
            Erro ao salvar a abertura.
          </p>
        )}
      </div>
    </div>
  );
}

/** Edits a chapter's opening (text + video); loads the chapter to get its current opening. */
export function ChapterOpeningForm({ campaignId, chapterId }: ChapterOpeningFormProps) {
  const { data: chapter, isLoading, isError } = useChapter(campaignId, chapterId);

  if (isLoading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (isError || !chapter) {
    return (
      <p role="alert" className="text-sm text-red-600">
        Erro ao carregar a abertura.
      </p>
    );
  }
  return <OpeningFields campaignId={campaignId} chapter={chapter} />;
}
