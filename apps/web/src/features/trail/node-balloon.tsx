'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { ChapterProgressView, NodeProgressView, RoomDetail } from '@rpg-chains/shared-types';
import { useOpenBattle } from '@/features/battles/api';
import { battleErrorMessage } from '@/features/battles/battle-error-messages';
import { useLightCampfire } from './api';
import { nodeName, nodeStateLabel } from './node-label';

interface NodeBalloonProps {
  room: RoomDetail;
  chapter: ChapterProgressView;
  node: NodeProgressView;
  userId: string;
  /** Percent of the chapter height where the balloon hangs (under the node's cell). */
  top: number;
  onClose: () => void;
}

const primaryClass =
  'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';

/**
 * What a node offers when tapped (Fase 5 plan decision 13): its name, what its state means, and
 * the action of its type — form a battle, open the shop, light the campfire, continue the
 * narrative. A locked node only says it is locked.
 */
export function NodeBalloon({ room, chapter, node, userId, top, onClose }: NodeBalloonProps) {
  const open = useOpenBattle(room.id);
  const light = useLightCampfire(room.id);
  const box = useRef<HTMLDivElement>(null);

  // A tap anywhere else closes it (a tap on another node selects that one instead).
  useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Element;
      if (box.current?.contains(target) || target.closest('[data-trail-node]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);
  const error = [open, light].find((m) => m.isError)?.error;
  const busy = [open, light].some((m) => m.isPending);

  const name = nodeName(node);
  const me = room.members.find((m) => m.userId === userId)?.profile ?? null;
  const inBattle = room.battles.some((b) => b.participants.some((p) => p.userId === userId));
  const canAct = me !== null && room.status !== 'closed';

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={name}
      className="absolute inset-x-2 z-20 space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
      style={{ top: `${top}%` }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">
            {nodeStateLabel(node)}
            {node.mandatory && ' · obrigatório'}
            {node.recommendedLevel !== null && ` · nível ${node.recommendedLevel}`}
            {node.participantLimit !== null && ` · até ${node.participantLimit}`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Fechar"
          className="text-sm text-gray-400 hover:text-gray-700"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {node.state === 'locked' ? (
        <p className="text-sm text-gray-600">Conclua os nós anteriores para liberar.</p>
      ) : (
        <NodeAction
          room={room}
          chapter={chapter}
          node={node}
          name={name}
          canAct={canAct}
          canFight={canAct && !me!.downed && !inBattle}
          inBattle={inBattle}
          busy={busy}
          onForm={() => open.mutate(node.nodeId, { onSuccess: onClose })}
          onLight={() => light.mutate(node.nodeId, { onSuccess: onClose })}
        />
      )}

      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {battleErrorMessage(error, 'Não foi possível concluir a ação.')}
        </p>
      )}
    </div>
  );
}

interface NodeActionProps {
  room: RoomDetail;
  chapter: ChapterProgressView;
  node: NodeProgressView;
  name: string;
  canAct: boolean;
  canFight: boolean;
  inBattle: boolean;
  busy: boolean;
  onForm: () => void;
  onLight: () => void;
}

/** The action of an unlocked or cleared node, by type. */
function NodeAction({
  room,
  chapter,
  node,
  name,
  canAct,
  canFight,
  inBattle,
  busy,
  onForm,
  onLight,
}: NodeActionProps) {
  switch (node.type) {
    case 'battle':
    case 'boss': {
      const battle = room.battles.find((b) => b.battleId === node.battleId);
      if (battle) {
        const seats =
          battle.participantLimit !== null
            ? ` · ${battle.participants.length}/${battle.participantLimit}`
            : '';
        return (
          <p className="text-sm text-gray-700">
            {battle.status === 'forming' ? 'Em formação' : 'Em andamento'}
            {seats} ·{' '}
            <a
              href={`#battle-${battle.battleId}`}
              className="font-medium text-indigo-700 hover:underline"
            >
              ver a batalha
            </a>
          </p>
        );
      }
      if (node.state === 'cleared') return <p className="text-sm text-gray-600">Já vencido.</p>;
      const masterJudges = node.needsMaster && room.viewer.isMaster;
      return (
        <div className="space-y-1">
          {node.needsMaster && (
            <p className="text-xs text-gray-500">Pergunta aberta: o mestre julga.</p>
          )}
          <button
            type="button"
            className={primaryClass}
            aria-label={`Formar batalha: ${name}`}
            disabled={!canFight || masterJudges || busy}
            onClick={onForm}
          >
            Formar batalha
          </button>
        </div>
      );
    }
    case 'shop':
      return canAct ? (
        <Link
          href={`/rooms/${room.id}/shops/${node.nodeId}`}
          className={`${primaryClass} inline-block`}
        >
          Abrir loja
        </Link>
      ) : null;
    case 'campfire': {
      const lit = chapter.campfireNodeId === node.nodeId;
      return (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            Restaura vida e energia de quem não está em batalha; uma derrota neste capítulo volta
            para a última fogueira acesa.
          </p>
          <button
            type="button"
            className={primaryClass}
            disabled={!canAct || inBattle || busy}
            onClick={onLight}
          >
            {lit ? 'Reacender a fogueira' : 'Acender a fogueira'}
          </button>
        </div>
      );
    }
    case 'narrative':
      return (
        <Link
          href={`/rooms/${room.id}/narratives/${node.nodeId}`}
          className={`${primaryClass} inline-block`}
        >
          {node.state === 'cleared' ? 'Reler' : 'Ler'}
        </Link>
      );
  }
}
