'use client';

import type { MemberInventory } from '@rpg-chains/shared-types';

interface ItemPickerProps {
  label: string;
  items: MemberInventory;
  /** Units picked per item id. */
  picked: Record<string, number>;
  onChange: (picked: Record<string, number>) => void;
}

/** Picks how many units of each item go into one side of an offer. */
export function ItemPicker({ label, items, picked, onChange }: ItemPickerProps) {
  if (items.length === 0) return <p className="text-xs text-gray-500">{label}: nenhum item.</p>;
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-medium text-gray-700">{label}</legend>
      {items.map((item) => (
        <label key={item.itemId} className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={0}
            max={item.quantity}
            value={picked[item.itemId] ?? 0}
            onChange={(e) =>
              onChange({
                ...picked,
                [item.itemId]: Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)),
              })
            }
            className="w-14 rounded-md border border-gray-300 px-2 py-0.5"
          />
          {item.name} <span className="text-gray-500">(de {item.quantity})</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Picked counts as item ids, one per unit — the offer's wire form. */
export function toUnits(picked: Record<string, number>): string[] {
  return Object.entries(picked).flatMap(([itemId, count]) =>
    Array.from({ length: count }, () => itemId),
  );
}
