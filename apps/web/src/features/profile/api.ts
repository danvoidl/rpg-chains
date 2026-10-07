import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileSheet, SpendPointsInput } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Under `rooms`, so the room's change signal refreshes it (e.g. after a battle's write-back). */
const sheetKey = (roomId: string) => ['rooms', 'profile', roomId];

/** The viewer's own character sheet in a room; only for someone with a profile. */
export function useProfileSheet(roomId: string, enabled: boolean) {
  return useQuery({
    queryKey: sheetKey(roomId),
    queryFn: () => apiFetch<ProfileSheet>(`/api/rooms/${roomId}/profile`),
    enabled: enabled && Boolean(roomId),
  });
}

/** Invests available points; the answer is the updated sheet. */
export function useSpendPoints(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (spend: SpendPointsInput) =>
      apiFetch<ProfileSheet>(`/api/rooms/${roomId}/profile/points`, {
        method: 'POST',
        json: spend,
      }),
    onSuccess: (sheet) => {
      queryClient.setQueryData(sheetKey(roomId), sheet);
      // The member list shows the new ceilings.
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] });
    },
  });
}
