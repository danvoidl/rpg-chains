import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuestionInput, Question } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** Fetches questions for a campaign, optionally filtered by type. */
export function useQuestions(campaignId: string, type?: 'objective' | 'open') {
  const params = type ? `?type=${type}` : '';

  return useQuery({
    queryKey: ['campaigns', campaignId, 'questions', type ?? 'all'],
    queryFn: () => apiFetch<Question[]>(`/api/campaigns/${campaignId}/questions${params}`),
    enabled: Boolean(campaignId),
  });
}

/** Creates a new question in a campaign and invalidates the questions list. */
export function useCreateQuestion(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: QuestionInput) =>
      apiFetch<Question>(`/api/campaigns/${campaignId}/questions`, {
        method: 'POST',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'questions'] });
    },
  });
}

/** Updates an existing question and invalidates the questions list. */
export function useUpdateQuestion(campaignId: string, questionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: QuestionInput) =>
      apiFetch<Question>(`/api/campaigns/${campaignId}/questions/${questionId}`, {
        method: 'PUT',
        json: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'questions'] });
    },
  });
}

/** Deletes a question from a campaign and invalidates the questions list. */
export function useDeleteQuestion(campaignId: string, questionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/campaigns/${campaignId}/questions/${questionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'questions'] });
    },
  });
}
