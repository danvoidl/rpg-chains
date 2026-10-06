import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Item, ItemInput } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

const itemsKey = (campaignId: string) => ['campaigns', campaignId, 'items'];

/** Fetches the items of a campaign. */
export function useItems(campaignId: string) {
  return useQuery({
    queryKey: itemsKey(campaignId),
    queryFn: () => apiFetch<Item[]>(`/api/campaigns/${campaignId}/items`),
    enabled: Boolean(campaignId),
  });
}

/** Creates an item and invalidates the items list. */
export function useCreateItem(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ItemInput) =>
      apiFetch<Item>(`/api/campaigns/${campaignId}/items`, { method: 'POST', json: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey(campaignId) }),
  });
}

/** Replaces an item and invalidates the items list. */
export function useUpdateItem(campaignId: string, itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ItemInput) =>
      apiFetch<Item>(`/api/campaigns/${campaignId}/items/${itemId}`, { method: 'PUT', json: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey(campaignId) }),
  });
}

/** Deletes an item and invalidates the items list. */
export function useDeleteItem(campaignId: string, itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/campaigns/${campaignId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey(campaignId) }),
  });
}
