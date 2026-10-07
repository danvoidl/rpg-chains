'use client';

import { useState } from 'react';
import type { ProfileSheet, RoomMember, SheetItem } from '@rpg-chains/shared-types';
import { ATTRIBUTE_LABELS } from '@/features/effects/effect-labels';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';
import { useEquip, useUseItem } from './api';

interface InventoryListProps {
  roomId: string;
  sheet: ProfileSheet;
  /** Room members, for picking whom a revive lifts. */
  members: RoomMember[];
}

/** "Req. Força 2" for the requirements the character does not meet. */
function missingRequirements(item: SheetItem, sheet: ProfileSheet): string {
  return (Object.entries(item.requirements) as [keyof ProfileSheet['attributes'], number][])
    .filter(([attribute, minimum]) => sheet.attributes[attribute] < minimum)
    .map(([attribute, minimum]) => `${ATTRIBUTE_LABELS[attribute]} ${minimum}`)
    .join(', ');
}

/**
 * The character's own items (spec §6): equip what fits, use consumables that work out of battle
 * (decision 13) — a revive asks which downed member it lifts.
 */
export function InventoryList({ roomId, sheet, members }: InventoryListProps) {
  const equip = useEquip(roomId);
  const use = useUseItem(roomId);
  const [reviving, setReviving] = useState<string | null>(null);
  const downed = members.filter((m) => m.profile?.downed);
  const error = [equip, use].find((m) => m.isError)?.error;

  if (sheet.inventory.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Inventário</h3>
        <p className="mt-1 text-sm text-gray-500">Vazio.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">Inventário</h3>
      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(error, 'Não foi possível usar o item.')}
        </p>
      )}
      <ul className="mt-1 space-y-1 text-sm text-gray-900">
        {sheet.inventory.map((item) => (
          <li key={item.itemId} className="flex flex-wrap items-center gap-2">
            <span>
              {item.name}
              {item.quantity > 1 && ` ×${item.quantity}`}
            </span>
            {item.category === 'equipment' &&
              (item.meetsRequirements ? (
                <button
                  type="button"
                  disabled={equip.isPending}
                  onClick={() => equip.mutate({ itemId: item.itemId })}
                  className="text-xs text-indigo-700 hover:underline disabled:opacity-50"
                >
                  Equipar
                </button>
              ) : (
                <span className="text-xs text-gray-500">
                  Requer {missingRequirements(item, sheet)}
                </span>
              ))}
            {item.usableOutOfBattle && item.effectType !== 'revive' && (
              <button
                type="button"
                disabled={use.isPending}
                onClick={() => use.mutate({ itemId: item.itemId })}
                className="text-xs text-indigo-700 hover:underline disabled:opacity-50"
              >
                Usar
              </button>
            )}
            {item.effectType === 'revive' &&
              (reviving === item.itemId ? (
                <span className="flex flex-wrap gap-1 text-xs">
                  {downed.length === 0 && <span className="text-gray-500">Ninguém caído.</span>}
                  {downed.map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      disabled={use.isPending}
                      onClick={() =>
                        use.mutate(
                          { itemId: item.itemId, targetProfileId: m.profile!.profileId },
                          { onSuccess: () => setReviving(null) },
                        )
                      }
                      className="rounded border border-indigo-200 px-1.5 text-indigo-700 hover:bg-indigo-50"
                    >
                      Reerguer {m.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => setReviving(null)} className="text-gray-500">
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setReviving(item.itemId)}
                  className="text-xs text-indigo-700 hover:underline"
                >
                  Usar em…
                </button>
              ))}
            {item.category === 'consumable' && !item.usableOutOfBattle && (
              <span className="text-xs text-gray-500">Só em batalha</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
