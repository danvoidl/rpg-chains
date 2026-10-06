import { useQuery } from '@tanstack/react-query';
import type { CampaignDraft } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Fetches the whole editable campaign draft (chapters, villains, questions). */
export function useCampaignDraft(campaignId: string) {
  return useQuery({
    queryKey: ['campaigns', campaignId, 'draft'],
    queryFn: () => apiFetch<CampaignDraft>(`/api/campaigns/${campaignId}/draft`),
    enabled: Boolean(campaignId),
  });
}
