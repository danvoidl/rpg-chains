'use client';

import type { RoomClassSlot } from '@rpg-chains/shared-types';
import { useChooseClass } from './api';
import { roomErrorMessage } from './room-error-messages';

interface ClassPickerProps {
  roomId: string;
  classes: RoomClassSlot[];
  accessCode?: string;
}

/** Waiting-room class picker: one card per class with its free slots. */
export function ClassPicker({ roomId, classes, accessCode }: ClassPickerProps) {
  const chooseClass = useChooseClass(roomId);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Escolha sua classe</h2>
      {chooseClass.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(chooseClass.error, 'Erro ao escolher a classe.')}
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {classes.map((cls) => {
          const full = cls.slotsTaken >= cls.maxSlots;
          return (
            <li
              key={cls.id}
              className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                {cls.artUrl && (
                  <img
                    src={cls.artUrl}
                    alt={cls.name}
                    className="h-12 w-12 rounded-md border border-gray-200 object-cover"
                  />
                )}
                <p className="font-medium text-gray-900">{cls.name}</p>
              </div>
              <p className="text-sm text-gray-600">{cls.description}</p>
              <p className="text-sm text-gray-500">
                Vida {cls.baseHp} · Energia {cls.baseEnergy}
              </p>
              <p className="text-sm text-gray-500">
                Vagas: {cls.slotsTaken}/{cls.maxSlots}
              </p>
              <button
                type="button"
                disabled={full || chooseClass.isPending}
                onClick={() => chooseClass.mutate({ classId: cls.id, accessCode })}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {full ? 'Lotada' : `Escolher ${cls.name}`}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
