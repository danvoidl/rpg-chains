import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BattleSummary, CancelRequestResult, PublicQuestion } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Every battle mutation changes the room page; the lobby signal refreshes the others. */
function useRoomMutation<TVariables, TResult>(mutationFn: (vars: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

/** Opens a formation on a node of the room; the caller joins it. */
export function useOpenBattle(roomId: string) {
  return useRoomMutation((nodeId: string) =>
    apiFetch<BattleSummary>(`/api/rooms/${roomId}/battles`, { method: 'POST', json: { nodeId } }),
  );
}

export function useJoinFormation() {
  return useRoomMutation((battleId: string) =>
    apiFetch<BattleSummary>(`/api/battles/${battleId}/participants`, { method: 'POST' }),
  );
}

/** Leaves a formation — or, on purpose and for good, a running battle (spec §7). */
export function useLeaveFormation() {
  return useRoomMutation((battleId: string) =>
    apiFetch<void>(`/api/battles/${battleId}/participants`, { method: 'DELETE' }),
  );
}

export function useStartBattle() {
  return useRoomMutation((battleId: string) =>
    apiFetch<BattleSummary>(`/api/battles/${battleId}/start`, { method: 'POST' }),
  );
}

export function useCancelBattle() {
  return useRoomMutation((battleId: string) =>
    apiFetch<void>(`/api/battles/${battleId}/cancel`, { method: 'POST' }),
  );
}

/** Master-only: discards a running battle and reopens it as a formation of the same group. */
export function useRestartBattle() {
  return useRoomMutation((battleId: string) =>
    apiFetch<BattleSummary>(`/api/battles/${battleId}/restart`, { method: 'POST' }),
  );
}

/** Asks to cancel a running battle while the master is away; all connected fighters must ask. */
export function useRequestCancel() {
  return useRoomMutation((battleId: string) =>
    apiFetch<CancelRequestResult>(`/api/battles/${battleId}/cancel-requests`, { method: 'POST' }),
  );
}

/** Master-only: the node's questions to choose from, without answer keys (spec §3.2). */
export function useQuestionBank(battleId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['battles', battleId, 'questions'],
    queryFn: () => apiFetch<PublicQuestion[]>(`/api/battles/${battleId}/questions`),
    enabled,
    staleTime: Infinity,
  });
}
