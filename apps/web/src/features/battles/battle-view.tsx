'use client';

import { useState } from 'react';
import { useRoom } from '@/features/rooms/api';
import Link from 'next/link';
import { eligibleForSignal } from '@rpg-chains/battle-engine';
import type { ClientIntent } from '@rpg-chains/shared-types';
import { battleReasonMessage } from './battle-error-messages';
import { BattleResult } from './battle-result';
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
  const { view, feed, clock, closed, joinError, send } = useBattleChannel(battleId);
  const isMaster = useRoom(roomId).data?.viewer.isMaster ?? false;
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
          />
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
              pending={pending}
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
        // Fase 6 brings a reconnection grace; until then a dropped socket is a dropped fighter.
        <p className="text-xs text-gray-500">
          Sair desta página tira você da batalha até o fim dela.
        </p>
      )}

      <EventFeed feed={feed} view={view} />
    </div>
  );
}
