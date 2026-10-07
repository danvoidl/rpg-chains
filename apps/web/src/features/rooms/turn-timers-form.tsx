'use client';

import { useState, type FormEvent } from 'react';
import { BATTLE_TIMER_RANGES, BATTLE_TIMERS, type BattleTimerKey } from '@rpg-chains/game-config';
import type { RoomDetail, RoomTurnTimers } from '@rpg-chains/shared-types';
import { usePatchRoom } from './api';
import { roomErrorMessage } from './room-error-messages';

interface TurnTimersFormProps {
  room: RoomDetail;
}

const FIELDS: { key: BattleTimerKey; label: string }[] = [
  { key: 'signalMs', label: 'Tocar o sinal' },
  { key: 'answerMs', label: 'Responder (objetiva)' },
  { key: 'openAnswerMs', label: 'Responder (aberta)' },
  { key: 'actionMs', label: 'Escolher a ação' },
];

const seconds = (ms: number) => Math.round(ms / 1000);

/** Master-only: the room's turn timers in seconds; an empty field uses the platform default. */
export function TurnTimersForm({ room }: TurnTimersFormProps) {
  const patchRoom = usePatchRoom(room.id);
  const [values, setValues] = useState<Record<BattleTimerKey, string>>(() => {
    const initial = {} as Record<BattleTimerKey, string>;
    for (const { key } of FIELDS) {
      const ms = room.turnTimers[key];
      initial[key] = ms === undefined ? '' : String(seconds(ms));
    }
    return initial;
  });

  const submit = (turnTimers: RoomTurnTimers) => patchRoom.mutate({ turnTimers });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const turnTimers: RoomTurnTimers = {};
    for (const { key } of FIELDS) {
      if (values[key].trim() !== '') turnTimers[key] = Number(values[key]) * 1000;
    }
    submit(turnTimers);
  };

  const handleReset = () => {
    setValues({ signalMs: '', answerMs: '', openAnswerMs: '', actionMs: '' });
    submit({});
  };

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold text-gray-900">Tempo de cada etapa do turno</h3>
      <p className="text-xs text-gray-600">
        Em segundos. Vazio usa o padrão. Vale a partir da próxima batalha.
      </p>
      {patchRoom.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(patchRoom.error, 'Tempo fora do intervalo permitido.')}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {FIELDS.map(({ key, label }) => {
          const { minMs, maxMs } = BATTLE_TIMER_RANGES[key];
          return (
            <div key={key}>
              <label htmlFor={`timer-${key}`} className="block text-sm font-medium text-gray-700">
                {label}
              </label>
              <input
                id={`timer-${key}`}
                type="number"
                min={seconds(minMs)}
                max={seconds(maxMs)}
                placeholder={String(seconds(BATTLE_TIMERS[key]))}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="mt-1 block w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-500">
                {seconds(minMs)}–{seconds(maxMs)}s
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={patchRoom.isPending}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Salvar tempos
        </button>
        <button
          type="button"
          disabled={patchRoom.isPending}
          onClick={handleReset}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:underline disabled:opacity-50"
        >
          Restaurar padrão
        </button>
      </div>
    </form>
  );
}
