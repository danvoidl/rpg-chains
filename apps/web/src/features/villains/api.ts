import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VillainInput, DraftVillain } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Fetches the list of draft villains for a campaign. */
export function useVillains(campaignId: string) {
  return useQuery({
    queryKey: ['campaigns', campaignId, 'villains'],
    queryFn: () => apiFetch<DraftVillain[]>(`/api/campaigns/${campaignId}/villains`),
    enabled: Boolean(campaignId),
  });
}

/** Creates a new villain in a campaign and invalidates the villains list. */
export function useCreateVillain(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VillainInput) =>
      apiFetch<DraftVillain>(`/api/campaigns/${campaignId}/villains`, {
        method: 'POST',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'villains'] });
    },
  });
}

/** Updates an existing villain and invalidates the villains list. */
export function useUpdateVillain(campaignId: string, villainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VillainInput) =>
      apiFetch<DraftVillain>(`/api/campaigns/${campaignId}/villains/${villainId}`, {
        method: 'PUT',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'villains'] });
    },
  });
}

/** Deletes a villain from a campaign and invalidates the villains list. */
export function useDeleteVillain(campaignId: string, villainId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/campaigns/${campaignId}/villains/${villainId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'villains'] });
    },
  });
}
