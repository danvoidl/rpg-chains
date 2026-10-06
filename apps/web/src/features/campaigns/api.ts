import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CampaignInput, CampaignPatch } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** Fetches the list of campaigns for the current user. */
export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch<Campaign[]>('/api/campaigns'),
  });
}

/** Fetches a single campaign by id. */
export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => apiFetch<Campaign>(`/api/campaigns/${id}`),
    enabled: Boolean(id),
  });
}

/** Creates a new campaign and invalidates the campaigns list. */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CampaignInput) =>
      apiFetch<Campaign>('/api/campaigns', {
        method: 'POST',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

/** Updates a campaign and invalidates its cache entries. */
export function useUpdateCampaign(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CampaignPatch) =>
      apiFetch<Campaign>(`/api/campaigns/${id}`, {
        method: 'PATCH',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

/** Deletes a campaign and invalidates cache entries. */
export function useDeleteCampaign(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/campaigns/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.removeQueries({ queryKey: ['campaigns', id] });
    },
  });
}
