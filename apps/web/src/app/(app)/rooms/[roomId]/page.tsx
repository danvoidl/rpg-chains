'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { useRoom } from '@/features/rooms/api';
import { BattlesSection } from '@/features/battles/battles-section';
import { CharacterSheet } from '@/features/profile/character-sheet';
import { TradesSection } from '@/features/trades/trades-section';
import { CampaignTrail } from '@/features/trail/campaign-trail';
import Link from 'next/link';
import { CompletedBanner } from '@/features/rooms/completed-banner';
import { AbandonSection } from '@/features/rooms/abandon-section';
import { ClassPicker } from '@/features/rooms/class-picker';
import { MasterPanel } from '@/features/rooms/master-panel';
import { MemberList } from '@/features/rooms/member-list';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';
import { useRoomPresence } from '@/features/rooms/room-channel-context';

/**
 * Room page (Fase 5 plan decision 13): the campaign trail column, with the battles and the class
 * picker for newcomers; beside it (below it on a phone) the viewer's character, members, trades,
 * abandon and master controls.
 */
export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const code = useSearchParams().get('code') ?? undefined;
  const { data: session } = authClient.useSession();

  const { data: room, isLoading, error } = useRoom(roomId, code);
  const onlineUserIds = useRoomPresence();

  if (isLoading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (error || !room) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {roomErrorMessage(error, 'Sala não encontrada.')}
      </p>
    );
  }

  const isOpen = room.status !== 'closed';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{room.name}</h1>
          {!isOpen && (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
              Sala encerrada
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {room.campaign.name} · versão {room.version}
        </p>
      </div>

      {room.status === 'completed' && <CompletedBanner room={room} />}
      {!isOpen && room.viewer.hasProfile && (
        <Link href="/history" className="text-sm font-medium text-blue-600 hover:underline">
          Ver no histórico
        </Link>
      )}

      <div className="grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          {isOpen && !room.viewer.hasProfile && (
            <ClassPicker roomId={room.id} classes={room.classes} accessCode={code} />
          )}
          {isOpen && session && <BattlesSection room={room} userId={session.user.id} />}
          {session && <CampaignTrail room={room} userId={session.user.id} />}
        </div>

        <aside className="space-y-6">
          {room.viewer.hasProfile && <CharacterSheet roomId={room.id} members={room.members} />}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Membros</h2>
            <MemberList members={room.members} onlineUserIds={onlineUserIds} />
          </section>
          {isOpen && room.viewer.hasProfile && session && (
            <TradesSection room={room} userId={session.user.id} />
          )}
          {isOpen && room.viewer.hasProfile && <AbandonSection roomId={room.id} />}
          {isOpen && room.viewer.isMaster && session && (
            <MasterPanel key={room.id} room={room} userId={session.user.id} />
          )}
        </aside>
      </div>
    </div>
  );
}
