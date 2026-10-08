'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChapterInputSchema, type ChapterInput } from '@rpg-chains/shared-types';
import {
  useChapters,
  useCreateChapter,
  useDeleteChapter,
  useUpdateChapter,
  type ChapterSummary,
} from '@/features/chapters/api';
import { ChapterOpeningForm } from '@/features/chapters/chapter-opening-form';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700';

/** Chapters page: ordered list with editor links, construction toggle, delete and create form. */
export default function ChaptersPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const { data: chapters, isLoading } = useChapters(campaignId);
  const createChapter = useCreateChapter(campaignId);
  const updateChapter = useUpdateChapter(campaignId);
  const deleteChapter = useDeleteChapter(campaignId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChapterInput>({
    resolver: zodResolver(ChapterInputSchema),
    defaultValues: { name: '', underConstruction: false },
  });

  const onCreate = async (values: ChapterInput) => {
    await createChapter.mutateAsync(values);
    reset({ name: '', underConstruction: false });
  };

  const handleDelete = async (chapter: ChapterSummary) => {
    if (
      window.confirm(
        `Tem certeza de que deseja excluir "${chapter.name}"? Excluir um capítulo já publicado será recusado ao republicar a campanha.`,
      )
    ) {
      await deleteChapter.mutateAsync(chapter.id);
    }
  };

  const sorted = [...(chapters ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Capítulos</h1>

      {updateChapter.isError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          Erro ao atualizar capítulo.
        </div>
      )}
      {deleteChapter.isError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          Erro ao excluir capítulo.
        </div>
      )}

      <div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : sorted.length > 0 ? (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {sorted.map((chapter) => (
              <li key={chapter.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{chapter.name}</p>
                  {chapter.underConstruction && (
                    <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      Em construção
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={chapter.underConstruction}
                    disabled={updateChapter.isPending}
                    onChange={(e) =>
                      updateChapter.mutate({
                        chapterId: chapter.id,
                        data: { underConstruction: e.target.checked },
                      })
                    }
                  />
                  Em construção
                </label>

                <Link
                  href={`/campaigns/${campaignId}/chapters/${chapter.id}`}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Abrir editor
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(chapter)}
                  disabled={deleteChapter.isPending}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Excluir
                </button>

                <details className="basis-full">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    Abertura
                  </summary>
                  <div className="mt-3">
                    <ChapterOpeningForm campaignId={campaignId} chapterId={chapter.id} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nenhum capítulo cadastrado ainda.</p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Novo capítulo</h2>

        {createChapter.isError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            Erro ao criar capítulo.
          </div>
        )}

        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label htmlFor="chapter-name" className={labelClass}>
              Nome do capítulo
            </label>
            <input id="chapter-name" type="text" {...register('name')} className={inputClass} />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <label
            htmlFor="chapter-under-construction"
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <input
              id="chapter-under-construction"
              type="checkbox"
              {...register('underConstruction')}
            />
            Em construção
          </label>

          <button
            type="submit"
            disabled={createChapter.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Criar capítulo
          </button>
        </form>
      </div>
    </div>
  );
}
