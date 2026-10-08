import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CatalogCampaign,
  RoomCreateInput,
  RoomDetail,
  RoomPatch,
  RoomSummary,
} from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

const roomsKey = ['rooms'];
const roomKey = (roomId: string, code?: string) => ['rooms', 'detail', roomId, code ?? null];

/** Fetches the published campaigns a room can be opened for. */
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiFetch<CatalogCampaign[]>('/api/catalog'),
  });
}

/** Fetches the open public rooms. */
export function usePublicRooms() {
  return useQuery({
    queryKey: ['rooms', 'public'],
    queryFn: () => apiFetch<RoomSummary[]>('/api/rooms'),
  });
}

/** Fetches the open rooms where the viewer is master or player. */
export function useMyRooms() {
  return useQuery({
    queryKey: ['rooms', 'mine'],
    queryFn: () => apiFetch<RoomSummary[]>('/api/rooms/mine'),
  });
}

/** Fetches a room; `code` unlocks a private room for a non-member. */
export function useRoom(roomId: string, code?: string) {
  return useQuery({
    queryKey: roomKey(roomId, code),
    queryFn: () =>
      apiFetch<RoomDetail>(
        `/api/rooms/${roomId}${code ? `?code=${encodeURIComponent(code)}` : ''}`,
      ),
    enabled: Boolean(roomId),
    retry: false,
  });
}

/** Creates a room and invalidates the room lists. */
export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoomCreateInput) =>
      apiFetch<RoomDetail>('/api/rooms', { method: 'POST', json: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomsKey }),
  });
}

/** Resolves an access code into a room id. */
export function useJoinByCode() {
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ roomId: string }>('/api/rooms/join', { method: 'POST', json: { code } }),
  });
}

/** Picks a class (creates the viewer's profile) and invalidates rooms. */
export function useChooseClass(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { classId: string; accessCode?: string }) =>
      apiFetch<RoomDetail>(`/api/rooms/${roomId}/profile`, { method: 'POST', json: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomsKey }),
  });
}

/** Abandons the room: the character is deleted for good. */
export function useAbandonRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/api/rooms/${roomId}/profile`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomsKey }),
  });
}

/** Master-only: renames the room or toggles its privacy. */
export function usePatchRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoomPatch) =>
      apiFetch<RoomDetail>(`/api/rooms/${roomId}`, { method: 'PATCH', json: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomsKey }),
  });
}

/** Master-only: issues a new access code for a private room. */
export function useRegenerateCode(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<RoomDetail>(`/api/rooms/${roomId}/access-code`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomsKey }),
  });
}

/** Master-only: hands the master role to another player. */
export function useTransferMaster(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<RoomDetail>(`/api/rooms/${roomId}/transfer`, { method: 'POST', json: { userId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomsKey }),
  });
}

/** Master-only: closes the room for good. */
export function useCloseRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<RoomDetail>(`/api/rooms/${roomId}/close`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomsKey }),
  });
}
