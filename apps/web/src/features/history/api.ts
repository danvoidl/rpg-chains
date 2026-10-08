import { useQuery } from '@tanstack/react-query';
import type { HistoryEntry } from '@rpg-chains/shared-types';
import { apiFetch } from '@/lib/api';

/** The viewer's own closed campaigns, newest first. */
export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: () => apiFetch<HistoryEntry[]>('/api/history'),
  });
}
