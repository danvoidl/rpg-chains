'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { battleErrorMessage } from '@/features/battles/battle-error-messages';
import { useRoom } from '@/features/rooms/api';
import { useContinueNarrative, useNarrative } from './api';

interface NarrativeViewProps {
  roomId: string;
  nodeId: string;
}

/**
 * A narrative page (Fase 5 plan decisions 11 and 12): title, video and text. Opening it is only
 * reading; the node is cleared when a player taps "Continuar".
 */
export function NarrativeView({ roomId, nodeId }: NarrativeViewProps) {
  const router = useRouter();
  const { data: room } = useRoom(roomId);
  const { data: narrative, isLoading, error } = useNarrative(roomId, nodeId);
  const advance = useContinueNarrative(roomId, nodeId);

  if (isLoading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (error || !narrative) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700">
          {battleErrorMessage(error, 'Narrativa não encontrada.')}
        </p>
        <Link href={`/rooms/${roomId}`} className="text-sm text-indigo-700 hover:underline">
          Voltar à sala
        </Link>
      </div>
    );
  }

  const canContinue = room?.viewer.hasProfile === true && room.status !== 'closed';

  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        {narrative.title.trim() || 'Narrativa'}
      </h1>
      {narrative.videoUrl && (
        <video controls src={narrative.videoUrl} className="w-full rounded-lg bg-black" />
      )}
      <p className="whitespace-pre-wrap text-gray-800">{narrative.text}</p>

      {advance.isError && (
        <p role="alert" className="text-sm text-red-700">
          {battleErrorMessage(advance.error, 'Não foi possível continuar.')}
        </p>
      )}

      <div className="flex items-center gap-3">
        {narrative.cleared ? (
          <>
            <span className="text-sm text-gray-600">Já lida</span>
            <Link
              href={`/rooms/${roomId}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Voltar à sala
            </Link>
          </>
        ) : (
          <>
            {canContinue && (
              <button
                type="button"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={advance.isPending}
                onClick={() =>
                  advance.mutate(undefined, {
                    onSuccess: () => router.push(`/rooms/${roomId}`),
                  })
                }
              >
                Continuar
              </button>
            )}
            <Link
              href={`/rooms/${roomId}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Voltar à sala
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
