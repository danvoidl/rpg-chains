'use client';

import { useState, type FormEvent } from 'react';
import type { ProfileSheet, RoomMember } from '@rpg-chains/shared-types';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';
import { useMemberInventory, useProposeTrade } from './api';
import { ItemPicker, toUnits } from './item-picker';

interface TradeOfferFormProps {
  roomId: string;
  sheet: ProfileSheet;
  /** Other members with a character: who an offer may go to. */
  others: RoomMember[];
}

const inputClass = 'mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1 text-sm';

/**
 * Builds an offer (spec §6, decision 9): what I give and what I ask, in gold and items. The other
 * player's items come from their inventory; their gold is private, so asking for more than they
 * have just fails on their side.
 */
export function TradeOfferForm({ roomId, sheet, others }: TradeOfferFormProps) {
  const propose = useProposeTrade(roomId);
  const [toProfileId, setToProfileId] = useState(others[0]?.profile?.profileId ?? '');
  const [giveGold, setGiveGold] = useState(0);
  const [askGold, setAskGold] = useState(0);
  const [giveItems, setGiveItems] = useState<Record<string, number>>({});
  const [askItems, setAskItems] = useState<Record<string, number>>({});
  const theirs = useMemberInventory(roomId, toProfileId || null);

  const give = { gold: giveGold, items: toUnits(giveItems) };
  const ask = { gold: askGold, items: toUnits(askItems) };
  const empty = give.gold + give.items.length + ask.gold + ask.items.length === 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    propose.mutate(
      { toProfileId, give, ask },
      {
        onSuccess: () => {
          setGiveGold(0);
          setAskGold(0);
          setGiveItems({});
          setAskItems({});
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-gray-900">Nova oferta</h3>
      {propose.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(propose.error, 'Não foi possível enviar a oferta.')}
        </p>
      )}
      {propose.isSuccess && (
        <p role="status" className="text-sm text-green-700">
          Oferta enviada. Ela vale até o outro jogador aceitar ou recusar.
        </p>
      )}
      <div>
        <label htmlFor="trade-to" className="block text-sm font-medium text-gray-700">
          Para
        </label>
        <select
          id="trade-to"
          value={toProfileId}
          onChange={(e) => {
            setToProfileId(e.target.value);
            setAskItems({});
          }}
          className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          {others.map((m) => (
            <option key={m.userId} value={m.profile!.profileId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">Você dá</p>
          <label className="block text-xs text-gray-700">
            Ouro (você tem {sheet.gold})
            <input
              type="number"
              min={0}
              max={sheet.gold}
              value={giveGold}
              onChange={(e) => setGiveGold(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </label>
          <ItemPicker
            label="Seus itens"
            items={sheet.inventory}
            picked={giveItems}
            onChange={setGiveItems}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">Você pede</p>
          <label className="block text-xs text-gray-700">
            Ouro
            <input
              type="number"
              min={0}
              value={askGold}
              onChange={(e) => setAskGold(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </label>
          <ItemPicker
            label="Itens dele(a)"
            items={theirs.data ?? []}
            picked={askItems}
            onChange={setAskItems}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={empty || !toProfileId || propose.isPending}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        Enviar oferta
      </button>
    </form>
  );
}
