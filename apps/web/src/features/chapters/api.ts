import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChapterInput,
  ChapterPatch,
  DraftChapter,
  DraftGraph,
} from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

export interface ChapterSummary {
  id: string;
  name: string;
  order: number;
  underConstruction: boolean;
}

/** Fetches the chapter summaries of a campaign. */
export function useChapters(campaignId: string) {
  return useQuery({
    queryKey: ['campaigns', campaignId, 'chapters'],
    queryFn: () => apiFetch<ChapterSummary[]>(`/api/campaigns/${campaignId}/chapters`),
    enabled: Boolean(campaignId),
  });
}

/** Fetches one chapter with its whole graph. */
export function useChapter(campaignId: string, chapterId: string) {
  return useQuery({
    queryKey: ['campaigns', campaignId, 'chapters', chapterId],
    queryFn: () => apiFetch<DraftChapter>(`/api/campaigns/${campaignId}/chapters/${chapterId}`),
    enabled: Boolean(campaignId && chapterId),
  });
}

/** Creates a chapter and invalidates the chapters list and the draft. */
export function useCreateChapter(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ChapterInput) =>
      apiFetch<ChapterSummary>(`/api/campaigns/${campaignId}/chapters`, {
        method: 'POST',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'chapters'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'draft'] });
    },
  });
}

/** Patches a chapter (name, order, under-construction flag) and invalidates its caches. */
export function useUpdateChapter(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chapterId, data }: { chapterId: string; data: ChapterPatch }) =>
      apiFetch<ChapterSummary>(`/api/campaigns/${campaignId}/chapters/${chapterId}`, {
        method: 'PATCH',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'chapters'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'draft'] });
    },
  });
}

/** Deletes a chapter and invalidates the chapters list and the draft. */
export function useDeleteChapter(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chapterId: string) =>
      apiFetch<void>(`/api/campaigns/${campaignId}/chapters/${chapterId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'chapters'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'draft'] });
    },
  });
}

/** Saves a chapter's whole graph; invalidates the chapter and draft queries. */
export function useSaveGraph(campaignId: string, chapterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (graph: DraftGraph) =>
      apiFetch<DraftChapter>(`/api/campaigns/${campaignId}/chapters/${chapterId}/graph`, {
        method: 'PUT',
        json: graph,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'chapters'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'draft'] });
    },
  });
}
