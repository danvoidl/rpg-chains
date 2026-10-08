import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NarrativeView, RoomDetail } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** A narrative of the room: reading it clears nothing. */
export function useNarrative(roomId: string, nodeId: string) {
  return useQuery({
    queryKey: ['rooms', roomId, 'narratives', nodeId],
    queryFn: () => apiFetch<NarrativeView>(`/api/rooms/${roomId}/narratives/${nodeId}`),
    retry: false,
  });
}

/** Continues past a narrative, clearing it for the room. */
export function useContinueNarrative(roomId: string, nodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<RoomDetail>(`/api/rooms/${roomId}/narratives/${nodeId}/continue`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}
