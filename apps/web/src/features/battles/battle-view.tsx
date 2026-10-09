'use client';

import { useState } from 'react';
import { useRoom } from '@/features/rooms/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RECONNECT_GRACE_MS } from '@rpg-chains/game-config';
import { eligibleForSignal } from '@rpg-chains/battle-engine';
import type { ClientIntent } from '@rpg-chains/shared-types';
import { useLeaveFormation } from './api';
import { battleErrorMessage, battleReasonMessage } from './battle-error-messages';
import { BattleResult } from './battle-result';
import { clearedNodeIds } from './result-summary';
import { CombatantCard } from './combatant-card';
import { EnemyCard } from './enemy-card';
import { EventFeed } from './event-feed';
import { TurnClock } from './turn-clock';
import { TurnPanel } from './turn-panel';
import { useBattleChannel } from './use-battle-channel';

interface BattleViewProps {
  battleId: string;
  roomId: string;
  userId: string;
}

/** The battle page body: enemies, the group, the turn and the feed (Fase 3 plan M4). */
export function BattleView({ battleId, roomId, userId }: BattleViewProps) {
  const { view, feed, clock, closed, joinError, send, connected } = useBattleChannel(battleId);
  const router = useRouter();
  const leaveBattle = useLeaveFormation();
  const room = useRoom(roomId).data;
  const isMaster = room?.viewer.isMaster ?? false;
  /** The cleared nodes when the battle page first saw the room, before any defeat rolled them back. */
  const [clearedBefore, setClearedBefore] = useState<Set<string> | null>(null);
  if (room && clearedBefore === null) setClearedBefore(clearedNodeIds(room.progress));
  const [pending, setPending] = useState(false);
  /** The last refusal, tied to the turn it happened in so it fades when the turn moves on. */
  const [refusal, setRefusal] = useState<{ token: number; text: string } | null>(null);
  const backToRoom = (
    <Link href={`/rooms/${roomId}`} className="text-sm font-medium text-indigo-700 hover:underline">
      Voltar à sala
    </Link>
  );

  if (joinError) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-red-700">
          {battleReasonMessage(joinError)}
        </p>
        {backToRoom}
      </div>
    );
  }
  if (!view) return <p className="text-sm text-gray-500">Entrando na batalha…</p>;

  const act = (intent: ClientIntent) => {
    setPending(true);
    setRefusal(null);
    void send(intent).then((ack) => {
      setPending(false);
      if (!ack.ok) setRefusal({ token: view.turnToken, text: battleReasonMessage(ack.reason) });
    });
  };
  const me = view.combatants.find((c) => c.userId === userId) ?? null;
  const { turn } = view;
  const actingId = 'profileId' in turn ? turn.profileId : null;
  const eligible = eligibleForSignal(view);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Batalha</h1>
        <span className="text-sm text-gray-500">Rodada {view.round}</span>
      </div>

      <section aria-label="Inimigos">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {view.enemies.map((enemy) => (
            <EnemyCard
              key={enemy.instanceId}
              enemy={enemy}
              isActing={turn.stage === 'enemy' && turn.instanceId === enemy.instanceId}
            />
          ))}
        </ul>
      </section>

      <section aria-label="Turno" className="rounded-lg border border-gray-200 bg-white p-4">
        {view.result ? (
          <BattleResult
            result={view.result}
            roomId={roomId}
            rewards={view.rewards}
            combatants={view.combatants}
            myProfileId={me?.profileId ?? null}
            nodeId={view.nodeId}
            progress={room?.progress ?? null}
            clearedBefore={clearedBefore}
          />
        ) : closed === 'restarted' ? (
          <div className="space-y-2">
            <p role="status" className="text-sm text-gray-700">
              O mestre reiniciou a batalha. A nova formação está na sala.
            </p>
            {backToRoom}
          </div>
        ) : closed === 'cancelled' ? (
          <div className="space-y-2">
            <p role="status" className="text-sm text-gray-700">
              A batalha foi cancelada.
            </p>
            {backToRoom}
          </div>
        ) : (
          <>
            <TurnClock clock={clock} turnToken={view.turnToken} />
            <TurnPanel
              view={view}
              me={me}
              act={act}
              pending={pending || !connected}
              isMaster={isMaster}
              battleId={battleId}
            />
          </>
        )}
        {refusal?.token === view.turnToken && !view.result && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {refusal.text}
          </p>
        )}
      </section>

      <section aria-label="Grupo">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {view.combatants.map((combatant) => (
            <CombatantCard
              key={combatant.profileId}
              combatant={combatant}
              isViewer={combatant.userId === userId}
              isActing={combatant.profileId === actingId}
              isEligible={eligible.has(combatant.profileId)}
            />
          ))}
        </ul>
      </section>

      {me && !me.left && !view.result && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Se a conexão cair ou você sair desta página, tem {Math.round(RECONNECT_GRACE_MS / 1000)}{' '}
            segundos para voltar sem sair da batalha.
          </p>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={leaveBattle.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Sair da batalha? Você não poderá voltar a ela, não recebe recompensa e, se o grupo perder, perde ouro como os outros.',
                )
              ) {
                leaveBattle.mutate(battleId, { onSuccess: () => router.push(`/rooms/${roomId}`) });
              }
            }}
          >
            Sair da batalha
          </button>
          {leaveBattle.error != null && (
            <p role="alert" className="w-full text-sm text-red-700">
              {battleErrorMessage(leaveBattle.error, 'Não foi possível sair da batalha.')}
            </p>
          )}
        </div>
      )}

      <EventFeed feed={feed} view={view} />
    </div>
  );
}
