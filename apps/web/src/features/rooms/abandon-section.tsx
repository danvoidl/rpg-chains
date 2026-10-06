'use client';

import { useRouter } from 'next/navigation';
import { useAbandonRoom } from './api';
import { roomErrorMessage } from './room-error-messages';

/** Placeholder for the adventure plus the abandon-room action. */
export function AbandonSection({ roomId }: { roomId: string }) {
  const router = useRouter();
  const abandon = useAbandonRoom(roomId);

  const handleAbandon = async () => {
    if (!window.confirm('Abandonar a sala? Seu personagem será perdido permanentemente.')) return;
    const done = await abandon.mutateAsync().then(
      () => true,
      () => false,
    );
    if (done) router.push('/rooms');
  };

  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-600">A aventura começa na próxima fase.</p>
      {abandon.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(abandon.error, 'Erro ao abandonar a sala.')}
        </p>
      )}
      <button
        type="button"
        onClick={handleAbandon}
        disabled={abandon.isPending}
        className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        Abandonar sala
      </button>
    </section>
  );
}
