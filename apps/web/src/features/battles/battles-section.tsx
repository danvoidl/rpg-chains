'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { useRoomPresence } from '@/features/rooms/room-channel-context';
import { FormationCard } from './formation-card';

interface BattlesSectionProps {
  room: RoomDetail;
  userId: string;
}

/**
 * The room's battles forming or running (Fase 3 plan M4); they are opened from a node of the
 * trail. When a formation the viewer is in starts, they are taken to the battle — a fighter who
 * is not on the battle page only loses turns to the timers.
 */
export function BattlesSection({ room, userId }: BattlesSectionProps) {
  const router = useRouter();
  const statuses = useRef(new Map<string, string>());

  useEffect(() => {
    for (const battle of room.battles) {
      const before = statuses.current.get(battle.battleId);
      statuses.current.set(battle.battleId, battle.status);
      // Fighters go to their battle; the master goes to the ones he must judge.
      const mine =
        battle.participants.some((p) => p.userId === userId) ||
        (battle.needsMaster && room.viewer.isMaster);
      if (mine && before === 'forming' && battle.status === 'running') {
        router.push(`/rooms/${room.id}/battles/${battle.battleId}`);
      }
    }
  }, [room.battles, room.id, room.viewer.isMaster, userId, router]);

  const me = room.members.find((m) => m.userId === userId)?.profile ?? null;
  const inBattle = room.battles.some((b) => b.participants.some((p) => p.userId === userId));
  const canFight = me !== null && !me.downed && !inBattle;
  const masterOnline = useRoomPresence().includes(room.master.id);

  if (room.battles.length === 0 && !me?.downed) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Batalhas</h2>
      {me?.downed && (
        <p className="text-sm text-gray-600">
          Seu personagem está caído. Acenda uma fogueira para se reerguer.
        </p>
      )}
      {room.battles.length > 0 && (
        <ul className="grid gap-3">
          {room.battles.map((battle) => (
            <FormationCard
              key={battle.battleId}
              battle={battle}
              roomId={room.id}
              userId={userId}
              isMaster={room.viewer.isMaster}
              canFight={canFight && !(battle.needsMaster && room.viewer.isMaster)}
              masterOnline={masterOnline}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
