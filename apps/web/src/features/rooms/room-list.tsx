import Link from 'next/link';
import type { RoomSummary } from '@rpg-chains/shared-types';

interface RoomListProps {
  rooms: RoomSummary[] | undefined;
  isLoading: boolean;
  emptyText: string;
}

/** List of room summaries with a link to each room. */
export function RoomList({ rooms, isLoading, emptyText }: RoomListProps) {
  if (isLoading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (!rooms || rooms.length === 0) return <p className="text-sm text-gray-500">{emptyText}</p>;
  return (
    <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {rooms.map((room) => (
        <li key={room.id} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{room.name}</p>
            <p className="text-sm text-gray-500">
              {room.campaign.name} · Mestre: {room.master.name} · {room.playerCount}{' '}
              {room.playerCount === 1 ? 'jogador' : 'jogadores'}
            </p>
          </div>
          <Link
            href={`/rooms/${room.id}`}
            className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Abrir
          </Link>
        </li>
      ))}
    </ul>
  );
}
