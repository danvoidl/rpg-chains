'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useJoinByCode } from './api';
import { roomErrorMessage } from './room-error-messages';

/** Resolves an access code and navigates to the room, carrying the code in the URL. */
export function JoinByCodeForm() {
  const router = useRouter();
  const joinByCode = useJoinByCode();
  const [code, setCode] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    const { roomId } = await joinByCode.mutateAsync(normalized).catch(() => ({ roomId: '' }));
    if (roomId) router.push(`/rooms/${roomId}?code=${encodeURIComponent(normalized)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="access-code" className="block text-sm font-medium text-gray-700">
          Código de acesso
        </label>
        <input
          id="access-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm uppercase shadow-sm"
        />
      </div>
      <button
        type="submit"
        disabled={joinByCode.isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Entrar
      </button>
      {joinByCode.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(joinByCode.error, 'Erro ao entrar na sala.')}
        </p>
      )}
    </form>
  );
}
