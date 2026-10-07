import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberInventory, ProposeTradeInput, TradeOfferView } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Under `rooms`, so the room's change signal refreshes them (a new offer, an expiry). */
const tradesKey = (roomId: string) => ['rooms', 'trades', roomId];

/** The viewer's pending offers, sent and received. */
export function useTrades(roomId: string) {
  return useQuery({
    queryKey: tradesKey(roomId),
    queryFn: () => apiFetch<TradeOfferView[]>(`/api/rooms/${roomId}/trades`),
  });
}

/** Another member's inventory, to ask for their items; only once someone is picked. */
export function useMemberInventory(roomId: string, profileId: string | null) {
  return useQuery({
    queryKey: ['rooms', 'member-inventory', roomId, profileId],
    queryFn: () => apiFetch<MemberInventory>(`/api/rooms/${roomId}/members/${profileId}/inventory`),
    enabled: profileId !== null,
  });
}

/** Refetches what a trade changes: the offers, the sheet (gold, items), the other's inventory. */
function useTradeMutation<T>(roomId: string, request: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export const useProposeTrade = (roomId: string) =>
  useTradeMutation(roomId, (input: ProposeTradeInput) =>
    apiFetch(`/api/rooms/${roomId}/trades`, { method: 'POST', json: input }),
  );

export const useAcceptTrade = (roomId: string) =>
  useTradeMutation(roomId, (tradeId: string) =>
    apiFetch(`/api/rooms/${roomId}/trades/${tradeId}/accept`, { method: 'POST' }),
  );

/** Declines a received offer or cancels a sent one. */
export const useDropTrade = (roomId: string) =>
  useTradeMutation(roomId, (tradeId: string) =>
    apiFetch(`/api/rooms/${roomId}/trades/${tradeId}`, { method: 'DELETE' }),
  );
