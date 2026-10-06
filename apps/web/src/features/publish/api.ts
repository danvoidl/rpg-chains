import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface CampaignVersionSummary {
  id: string;
  version: number;
  publishedAt: string;
}

/** Fetches the published versions of a campaign, newest first. */
export function useVersions(campaignId: string) {
  return useQuery({
    queryKey: ['campaigns', campaignId, 'versions'],
    queryFn: () => apiFetch<CampaignVersionSummary[]>(`/api/campaigns/${campaignId}/versions`),
    enabled: Boolean(campaignId),
  });
}

/** Publishes the draft as a new version and invalidates the versions list. */
export function usePublish(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<CampaignVersionSummary>(`/api/campaigns/${campaignId}/publish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'versions'] });
    },
  });
}
