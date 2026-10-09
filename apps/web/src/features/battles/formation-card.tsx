'use client';

import Link from 'next/link';
import type { BattleSummary } from '@rpg-chains/shared-types';
import {
  useCancelBattle,
  useJoinFormation,
  useLeaveFormation,
  useRequestCancel,
  useRestartBattle,
  useStartBattle,
} from './api';
import { battleErrorMessage } from './battle-error-messages';

interface FormationCardProps {
  battle: BattleSummary;
  roomId: string;
  userId: string;
  isMaster: boolean;
  /** The viewer has a profile that could join. */
  canFight: boolean;
  /** The room master is in the lobby; a battle with open questions needs him to start. */
  masterOnline: boolean;
}

const buttonClass =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

/** A battle of the room: who is in, and what the viewer can do with it. */
export function FormationCard({
  battle,
  roomId,
  userId,
  isMaster,
  canFight,
  masterOnline,
}: FormationCardProps) {
  const join = useJoinFormation();
  const leave = useLeaveFormation();
  const start = useStartBattle();
  const cancel = useCancelBattle();
  const restart = useRestartBattle();
  const requestCancel = useRequestCancel();
  const mutations = [join, leave, start, cancel, restart, requestCancel];
  const error = mutations.find((m) => m.isError)?.error;
  const busy = mutations.some((m) => m.isPending);

  const inIt = battle.participants.some((p) => p.userId === userId);
  const full =
    battle.participantLimit !== null && battle.participants.length >= battle.participantLimit;
  const forming = battle.status === 'forming';
  const soleParticipant = inIt && battle.participants.length === 1;
  const title = battle.nodeTitle || (battle.nodeType === 'boss' ? 'Chefe' : 'Batalha');

  return (
    <li
      id={`battle-${battle.battleId}`}
      aria-label={title}
      className="scroll-mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{title}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {forming ? 'em formação' : 'em andamento'}
        </span>
      </div>
      <p className="text-sm text-gray-600">
        {battle.participants.map((p) => p.name).join(', ')}
        {battle.participantLimit !== null &&
          ` (${battle.participants.length}/${battle.participantLimit})`}
      </p>
      {battle.needsMaster && forming && !masterOnline && (
        <p className="text-xs text-amber-800">
          Com pergunta aberta: o mestre precisa estar na sala para começar.
        </p>
      )}
      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {battleErrorMessage(error, 'Erro ao atualizar a batalha.')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {forming && !inIt && canFight && !full && (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => join.mutate(battle.battleId)}
          >
            Entrar
          </button>
        )}
        {forming && inIt && (
          <>
            <button
              type="button"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => start.mutate(battle.battleId)}
            >
              Iniciar batalha
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => leave.mutate(battle.battleId)}
            >
              Sair da formação
            </button>
          </>
        )}
        {!forming && (
          <Link
            href={`/rooms/${roomId}/battles/${battle.battleId}`}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {inIt ? 'Voltar à batalha' : battle.needsMaster && isMaster ? 'Conduzir' : 'Assistir'}
          </Link>
        )}
        {!forming && isMaster && (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Reiniciar a batalha? Ela recomeça do zero com quem ainda está nela; nada desta será guardado.',
                )
              ) {
                restart.mutate(battle.battleId);
              }
            }}
          >
            Reiniciar
          </button>
        )}
        {(isMaster || (forming && soleParticipant)) && (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => {
              if (window.confirm('Cancelar a batalha? Nada dela será guardado.')) {
                cancel.mutate(battle.battleId);
              }
            }}
          >
            Cancelar
          </button>
        )}
        {!forming && inIt && !isMaster && !masterOnline && (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => requestCancel.mutate(battle.battleId)}
          >
            Pedir para cancelar
          </button>
        )}
      </div>
      {requestCancel.data?.status === 'requested' && (
        <p role="status" className="text-xs text-gray-600">
          Pedido registrado. Falta{requestCancel.data.waitingFor > 1 ? 'm' : ''}{' '}
          {requestCancel.data.waitingFor} participante
          {requestCancel.data.waitingFor > 1 ? 's' : ''} pedir também (30 segundos).
        </p>
      )}
    </li>
  );
}
