'use client';

import type { RoomDetail } from '@rpg-chains/shared-types';
import { useProfileSheet } from '@/features/profile/api';
import { useTrades } from './api';
import { TradeList } from './trade-list';
import { TradeOfferForm } from './trade-offer-form';

interface TradesSectionProps {
  room: RoomDetail;
  userId: string;
}

/** Trades between the room's players (spec §6): pending offers and a form for a new one. */
export function TradesSection({ room, userId }: TradesSectionProps) {
  const { data: sheet } = useProfileSheet(room.id, true);
  const { data: offers } = useTrades(room.id);
  const others = room.members.filter((m) => m.profile && m.userId !== userId);
  if (!sheet || others.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Trocas</h2>
      <TradeList roomId={room.id} offers={offers ?? []} myProfileId={sheet.profileId} />
      <TradeOfferForm roomId={room.id} sheet={sheet} others={others} />
    </section>
  );
}
