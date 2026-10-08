import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RoomDetail } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Trail actions change the room; the lobby signal refreshes the other members. */
function useTrailMutation(roomId: string, path: (nodeId: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      apiFetch<RoomDetail>(`/api/rooms/${roomId}/${path(nodeId)}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

/** Lights a campfire: everyone not fighting is restored, and it becomes the return point. */
export function useLightCampfire(roomId: string) {
  return useTrailMutation(roomId, (nodeId) => `campfires/${nodeId}`);
}
