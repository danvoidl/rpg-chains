'use client';

import type { TradeOfferView } from '@rpg-chains/shared-types';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';
import { useAcceptTrade, useDropTrade } from './api';
import { describeSide } from './trade-side';

interface TradeListProps {
  roomId: string;
  offers: TradeOfferView[];
  myProfileId: string;
}

const linkButton = 'text-sm font-medium hover:underline disabled:opacity-50';

/** Pending offers: received ones to accept or decline, sent ones to cancel (decision 9). */
export function TradeList({ roomId, offers, myProfileId }: TradeListProps) {
  const accept = useAcceptTrade(roomId);
  const drop = useDropTrade(roomId);
  const error = [accept, drop].find((m) => m.isError)?.error;
  const pending = accept.isPending || drop.isPending;
  if (offers.length === 0) return <p className="text-sm text-gray-500">Nenhuma oferta pendente.</p>;

  return (
    <div className="space-y-2">
      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(error, 'Não foi possível concluir a troca.')}
        </p>
      )}
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {offers.map((offer) => {
          const received = offer.to.profileId === myProfileId;
          return (
            <li key={offer.id} className="space-y-1 p-3 text-sm">
              {received ? (
                <p className="text-gray-900">
                  <span className="font-medium">{offer.from.name}</span> oferece{' '}
                  <span className="font-medium">{describeSide(offer.give)}</span> e pede{' '}
                  <span className="font-medium">{describeSide(offer.ask)}</span>.
                </p>
              ) : (
                <p className="text-gray-900">
                  Você oferece a <span className="font-medium">{offer.to.name}</span>{' '}
                  <span className="font-medium">{describeSide(offer.give)}</span> e pede{' '}
                  <span className="font-medium">{describeSide(offer.ask)}</span>.
                </p>
              )}
              <div className="flex gap-3">
                {received && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => accept.mutate(offer.id)}
                    className={`${linkButton} text-green-700`}
                  >
                    Aceitar
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => drop.mutate(offer.id)}
                  className={`${linkButton} text-gray-600`}
                >
                  {received ? 'Recusar' : 'Cancelar'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
