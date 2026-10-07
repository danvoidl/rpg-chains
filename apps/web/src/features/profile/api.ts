import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EquipInput,
  ProfileSheet,
  SpendPointsInput,
  UnequipInput,
  UseItemInput,
} from '@rpg-chains/shared-types';
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

/**
 * A change to the viewer's own profile that answers the updated sheet: the sheet is replaced at
 * once and the room refetched (the member list shows ceilings, HP and who is downed).
 */
export function useSheetMutation<T>(roomId: string, path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) =>
      apiFetch<ProfileSheet>(`/api/rooms/${roomId}/${path}`, { method: 'POST', json: input }),
    onSuccess: (sheet) => {
      queryClient.setQueryData(sheetKey(roomId), sheet);
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] });
    },
  });
}

/** Invests available points. */
export const useSpendPoints = (roomId: string) =>
  useSheetMutation<SpendPointsInput>(roomId, 'profile/points');

/** Equips an inventory item in its slot. */
export const useEquip = (roomId: string) => useSheetMutation<EquipInput>(roomId, 'profile/equip');

/** Takes a slot's item back to the inventory. */
export const useUnequip = (roomId: string) =>
  useSheetMutation<UnequipInput>(roomId, 'profile/unequip');

/** Uses a consumable out of battle. */
export const useUseItem = (roomId: string) => useSheetMutation<UseItemInput>(roomId, 'profile/use');
