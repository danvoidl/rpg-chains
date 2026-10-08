'use client';

import { SlotSchema, type ProfileSheet } from '@rpg-chains/shared-types';
import { SLOT_LABELS } from '@/features/effects/effect-labels';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';
import { useUnequip } from './api';

interface EquipmentListProps {
  roomId: string;
  sheet: ProfileSheet;
}

/** What the character wears, slot by slot; any slot but the weapon can be emptied (decision 12). */
export function EquipmentList({ roomId, sheet }: EquipmentListProps) {
  const unequip = useUnequip(roomId);
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">Equipamento</h3>
      {unequip.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(unequip.error, 'Não foi possível desequipar.')}
        </p>
      )}
      <ul className="mt-1 space-y-0.5 text-sm">
        {SlotSchema.options.map((slot) => {
          const item = sheet.equipment.find((i) => i.slot === slot);
          return (
            <li key={slot} className="flex items-center gap-2">
              <span className="w-24 text-gray-500">{SLOT_LABELS[slot]}</span>
              <span className={item ? 'text-gray-900' : 'text-gray-400'}>{item?.name ?? '—'}</span>
              {item && slot !== 'weapon' && (
                <button
                  type="button"
                  disabled={unequip.isPending}
                  onClick={() => unequip.mutate({ slot })}
                  className="text-xs text-indigo-700 hover:underline disabled:opacity-50"
                >
                  Desequipar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
