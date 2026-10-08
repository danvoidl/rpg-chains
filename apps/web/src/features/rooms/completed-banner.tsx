'use client';

import type { RoomDetail } from '@rpg-chains/shared-types';
import { useCloseRoom } from './api';
import { confirmCloseRoom } from './confirm-close-room';
import { roomErrorMessage } from './room-error-messages';

/** Shown on a completed room (Fase 5 plan decision 10); the master gets the close action. */
export function CompletedBanner({ room }: { room: RoomDetail }) {
  const closeRoom = useCloseRoom(room.id);

  return (
    <section
      aria-label="Campanha concluída"
      className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4"
    >
      <h2 className="text-lg font-semibold text-amber-900">Campanha concluída!</h2>
      <p className="text-sm text-amber-900">
        A sala continua aberta para lojas, trocas e batalhas opcionais até o mestre encerrar.
      </p>
      {closeRoom.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(closeRoom.error, 'Erro ao encerrar a sala.')}
        </p>
      )}
      {room.viewer.isMaster && (
        <button
          type="button"
          disabled={closeRoom.isPending}
          onClick={() => {
            if (confirmCloseRoom()) closeRoom.mutate();
          }}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Encerrar a sala
        </button>
      )}
    </section>
  );
}
