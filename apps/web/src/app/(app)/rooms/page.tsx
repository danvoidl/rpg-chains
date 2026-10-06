'use client';

import Link from 'next/link';
import { useMyRooms, usePublicRooms } from '@/features/rooms/api';
import { JoinByCodeForm } from '@/features/rooms/join-by-code-form';
import { RoomList } from '@/features/rooms/room-list';

/** Rooms hub: join by code, my rooms and open public rooms. */
export default function RoomsPage() {
  const mine = useMyRooms();
  const publicRooms = usePublicRooms();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Salas</h1>
        <Link
          href="/rooms/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Criar sala
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Entrar com código</h2>
        <JoinByCodeForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Minhas salas</h2>
        <RoomList
          rooms={mine.data}
          isLoading={mine.isLoading}
          emptyText="Você ainda não está em nenhuma sala."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Salas públicas</h2>
        <RoomList
          rooms={publicRooms.data}
          isLoading={publicRooms.isLoading}
          emptyText="Nenhuma sala pública aberta."
        />
      </section>
    </div>
  );
}
