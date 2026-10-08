'use client';

import { useState } from 'react';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { useCloseRoom, usePatchRoom, useRegenerateCode, useTransferMaster } from './api';
import { confirmCloseRoom } from './confirm-close-room';
import { roomErrorMessage } from './room-error-messages';
import { TurnTimersForm } from './turn-timers-form';

interface MasterPanelProps {
  room: RoomDetail;
  userId: string;
}

const buttonClass =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

/** Master-only controls: access code, rename/privacy, turn timers, transfer and close. */
export function MasterPanel({ room, userId }: MasterPanelProps) {
  const patchRoom = usePatchRoom(room.id);
  const regenerate = useRegenerateCode(room.id);
  const transfer = useTransferMaster(room.id);
  const closeRoom = useCloseRoom(room.id);

  const [name, setName] = useState(room.name);
  const [isPrivate, setIsPrivate] = useState(!room.isPublic);
  const [newMasterId, setNewMasterId] = useState('');

  const candidates = room.members.filter((m) => m.profile && m.userId !== userId);
  const selectedMasterId = newMasterId || candidates[0]?.userId || '';
  const error = [patchRoom, regenerate, transfer, closeRoom].find((m) => m.isError)?.error;

  const handleClose = () => {
    if (confirmCloseRoom()) closeRoom.mutate();
  };

  return (
    <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-lg font-semibold text-gray-900">Mestre</h2>
      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(error, 'Erro ao atualizar a sala.')}
        </p>
      )}

      {room.accessCode && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-800">
            Código de acesso: <span className="font-mono font-semibold">{room.accessCode}</span>
          </p>
          <button
            type="button"
            className={buttonClass}
            disabled={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            Gerar novo código
          </button>
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          patchRoom.mutate({ name: name.trim(), isPublic: !isPrivate });
        }}
      >
        <div>
          <label htmlFor="edit-room-name" className="block text-sm font-medium text-gray-700">
            Nome da sala
          </label>
          <input
            id="edit-room-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          Sala privada (com código de acesso)
        </label>
        <button type="submit" className={buttonClass} disabled={patchRoom.isPending}>
          Salvar sala
        </button>
      </form>

      <TurnTimersForm room={room} />

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="new-master" className="block text-sm font-medium text-gray-700">
              Transferir mestre para
            </label>
            <select
              id="new-master"
              value={selectedMasterId}
              onChange={(e) => setNewMasterId(e.target.value)}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {candidates.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.profile?.className})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={transfer.isPending || !selectedMasterId}
            onClick={() => transfer.mutate(selectedMasterId)}
          >
            Transferir
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleClose}
        disabled={closeRoom.isPending}
        className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        Encerrar sala
      </button>
    </section>
  );
}
