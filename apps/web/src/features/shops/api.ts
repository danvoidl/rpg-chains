import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BuyInput, ProfileSheet, ShopView } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Under `rooms`, so the room's change signal refreshes it (a new version may change prices). */
const shopKey = (roomId: string, nodeId: string) => ['rooms', 'shop', roomId, nodeId];

/** A shop's wares with the viewer's own gold. */
export function useShop(roomId: string, nodeId: string) {
  return useQuery({
    queryKey: shopKey(roomId, nodeId),
    queryFn: () => apiFetch<ShopView>(`/api/rooms/${roomId}/shops/${nodeId}`),
    retry: false,
  });
}

/** Buys with the viewer's own gold; refreshes the shop (gold) and the character sheet. */
export function useBuy(roomId: string, nodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BuyInput) =>
      apiFetch<ProfileSheet>(`/api/rooms/${roomId}/shops/${nodeId}/buy`, {
        method: 'POST',
        json: input,
      }),
    onSuccess: (sheet) => {
      queryClient.setQueryData(['rooms', 'profile', roomId], sheet);
      void queryClient.invalidateQueries({ queryKey: shopKey(roomId, nodeId) });
    },
  });
}
