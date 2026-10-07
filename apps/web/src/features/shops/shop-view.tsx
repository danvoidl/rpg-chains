'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ShopItem } from '@rpg-chains/shared-types';
import { ATTRIBUTE_LABELS, SLOT_LABELS } from '@/features/effects/effect-labels';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';
import { useBuy, useShop } from './api';

interface ShopViewProps {
  roomId: string;
  nodeId: string;
}

/** What the item is, in one line: slot, defense and requirements, or "consumível". */
function describe(item: ShopItem): string {
  if (item.category === 'consumable') return 'Consumível';
  const parts = [item.slot ? SLOT_LABELS[item.slot] : 'Equipamento'];
  if (item.defenseBonus > 0) parts.push(`+${item.defenseBonus} defesa`);
  for (const [attribute, minimum] of Object.entries(item.requirements)) {
    if (minimum)
      parts.push(
        `requer ${ATTRIBUTE_LABELS[attribute as keyof typeof ATTRIBUTE_LABELS]} ${minimum}`,
      );
  }
  return parts.join(' · ');
}

/** A shop (spec §6, Fase 4 plan decision 11): each player buys with their own gold, no vote. */
export function ShopView({ roomId, nodeId }: ShopViewProps) {
  const { data: shop, isLoading, error } = useShop(roomId, nodeId);
  const buy = useBuy(roomId, nodeId);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (isLoading) return <p className="text-sm text-gray-500">Carregando…</p>;
  if (error || !shop) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {roomErrorMessage(error, 'Loja não encontrada.')}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{shop.title || 'Loja'}</h1>
        <p className="text-sm font-medium text-amber-700">Seu ouro: {shop.gold}</p>
      </div>
      {buy.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(buy.error, 'Não foi possível comprar.')}
        </p>
      )}
      {buy.isSuccess && (
        <p role="status" className="text-sm text-green-700">
          Comprado! O item está no seu inventário.
        </p>
      )}
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {shop.items.map((item) => {
          const quantity = quantities[item.itemId] ?? 1;
          const total = item.price * quantity;
          return (
            <li key={item.itemId} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{describe(item)}</p>
              </div>
              <span className="text-sm text-amber-700">{item.price} de ouro</span>
              <input
                type="number"
                min={1}
                max={99}
                aria-label={`Quantidade de ${item.name}`}
                value={quantity}
                onChange={(e) =>
                  setQuantities((q) => ({
                    ...q,
                    [item.itemId]: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                  }))
                }
                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                disabled={buy.isPending || total > shop.gold}
                onClick={() => buy.mutate({ itemId: item.itemId, quantity })}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Comprar ({total})
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/rooms/${roomId}`}
        className="text-sm font-medium text-indigo-700 hover:underline"
      >
        Voltar à sala
      </Link>
    </div>
  );
}
