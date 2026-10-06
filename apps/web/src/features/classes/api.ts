import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClassInput, DraftClass } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

const classesKey = (campaignId: string) => ['campaigns', campaignId, 'classes'];

/** Fetches the classes of a campaign, with their skills. */
export function useClasses(campaignId: string) {
  return useQuery({
    queryKey: classesKey(campaignId),
    queryFn: () => apiFetch<DraftClass[]>(`/api/campaigns/${campaignId}/classes`),
    enabled: Boolean(campaignId),
  });
}

/** Creates a class and invalidates the classes list. */
export function useCreateClass(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClassInput) =>
      apiFetch<DraftClass>(`/api/campaigns/${campaignId}/classes`, { method: 'POST', json: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classesKey(campaignId) }),
  });
}

/** Replaces a class (skills included, ids kept) and invalidates the classes list. */
export function useUpdateClass(campaignId: string, classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClassInput) =>
      apiFetch<DraftClass>(`/api/campaigns/${campaignId}/classes/${classId}`, {
        method: 'PUT',
        json: data,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classesKey(campaignId) }),
  });
}

/** Deletes a class and invalidates the classes list. */
export function useDeleteClass(campaignId: string, classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/campaigns/${campaignId}/classes/${classId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classesKey(campaignId) }),
  });
}

/** Copies the default kit (4 classes + their base weapons) into the campaign. */
export function useImportKit(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<DraftClass[]>(`/api/campaigns/${campaignId}/classes/import-kit`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesKey(campaignId) });
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'items'] });
    },
  });
}
