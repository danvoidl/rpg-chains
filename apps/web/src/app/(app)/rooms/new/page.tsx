'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCatalog, useCreateRoom } from '@/features/rooms/api';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';

/** Creates a room for one of the published campaigns. */
export default function NewRoomPage() {
  const router = useRouter();
  const { data: catalog, isLoading } = useCatalog();
  const createRoom = useCreateRoom();
  const [campaignId, setCampaignId] = useState('');
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const selectedCampaignId = campaignId || catalog?.[0]?.id || '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCampaignId || !name.trim()) return;
    const room = await createRoom
      .mutateAsync({ campaignId: selectedCampaignId, name: name.trim(), isPublic: !isPrivate })
      .catch(() => null);
    if (room) router.push(`/rooms/${room.id}`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Nova sala</h1>
      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : !catalog || catalog.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma campanha publicada ainda.</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="campaign" className="block text-sm font-medium text-gray-700">
              Campanha
            </label>
            <select
              id="campaign"
              value={selectedCampaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {catalog.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} (versão {campaign.latestVersion})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="room-name" className="block text-sm font-medium text-gray-700">
              Nome da sala
            </label>
            <input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
            Sala privada (com código de acesso)
          </label>
          {createRoom.isError && (
            <p role="alert" className="text-sm text-red-700">
              {roomErrorMessage(createRoom.error, 'Erro ao criar sala.')}
            </p>
          )}
          <button
            type="submit"
            disabled={createRoom.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Criar sala
          </button>
        </form>
      )}
    </div>
  );
}
