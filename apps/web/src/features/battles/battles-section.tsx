'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { useOpenBattle, useRest } from './api';
import { battleErrorMessage } from './battle-error-messages';
import { FormationCard } from './formation-card';

interface BattlesSectionProps {
  room: RoomDetail;
  userId: string;
}

const buttonClass =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

/**
 * The room's battles (Fase 3 plan M4): formations and running battles, the nodes a formation can
 * open on (a plain list until the chapter map), and the master's provisional rest. When a
 * formation the viewer is in starts, they are taken to the battle — a fighter who is not on the
 * battle page only loses turns to the timers.
 */
export function BattlesSection({ room, userId }: BattlesSectionProps) {
  const router = useRouter();
  const open = useOpenBattle(room.id);
  const rest = useRest(room.id);
  const statuses = useRef(new Map<string, string>());

  useEffect(() => {
    for (const battle of room.battles) {
      const before = statuses.current.get(battle.battleId);
      statuses.current.set(battle.battleId, battle.status);
      const mine = battle.participants.some((p) => p.userId === userId);
      if (mine && before === 'forming' && battle.status === 'running') {
        router.push(`/rooms/${room.id}/battles/${battle.battleId}`);
      }
    }
  }, [room.battles, room.id, userId, router]);

  const me = room.members.find((m) => m.userId === userId)?.profile ?? null;
  const busyNodes = new Set(room.battles.map((b) => b.nodeId));
  const inBattle = room.battles.some((b) => b.participants.some((p) => p.userId === userId));
  const canFight = me !== null && !me.downed && !inBattle;
  const error = [open, rest].find((m) => m.isError)?.error;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Batalhas</h2>
      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {battleErrorMessage(error, 'Erro ao abrir a batalha.')}
        </p>
      )}
      {me?.downed && (
        <p className="text-sm text-gray-600">
          Seu personagem está caído. Peça ao mestre um descanso.
        </p>
      )}

      {room.battles.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {room.battles.map((battle) => (
            <FormationCard
              key={battle.battleId}
              battle={battle}
              roomId={room.id}
              userId={userId}
              isMaster={room.viewer.isMaster}
              canFight={canFight}
            />
          ))}
        </ul>
      )}

      {room.battleNodes.length === 0 ? (
        <p className="text-sm text-gray-500">Esta versão da campanha não tem batalhas.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {room.battleNodes.map((node) => {
            const title = node.title || (node.type === 'boss' ? 'Chefe' : 'Batalha');
            return (
              <li key={node.nodeId} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <span className="font-medium text-gray-900">{title}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {node.chapterName}
                    {node.type === 'boss' && ' · chefe'}
                    {node.participantLimit !== null && ` · até ${node.participantLimit}`}
                  </span>
                </div>
                {node.needsMaster ? (
                  <span className="text-xs text-gray-500">pergunta aberta: em breve</span>
                ) : (
                  <button
                    type="button"
                    className={buttonClass}
                    aria-label={`Abrir formação: ${title}`}
                    disabled={!canFight || busyNodes.has(node.nodeId) || open.isPending}
                    onClick={() => open.mutate(node.nodeId)}
                  >
                    Abrir formação
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {room.viewer.isMaster && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={buttonClass}
            disabled={rest.isPending || room.battles.length > 0}
            onClick={() => rest.mutate()}
          >
            Descansar o grupo
          </button>
          <span className="text-xs text-gray-500">
            Reergue os caídos e recupera vida e energia (provisório, até as fogueiras).
          </span>
        </div>
      )}
    </section>
  );
}
