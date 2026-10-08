'use client';

import { useHistory } from '@/features/history/api';
import { HistoryCard } from '@/features/history/history-card';

/** The player's closed campaigns (spec §7). */
export default function HistoryPage() {
  const { data, isLoading, error } = useHistory();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Histórico</h1>
      {isLoading && <p className="text-sm text-gray-500">Carregando…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Erro ao carregar o histórico.
        </p>
      )}
      {data && data.length === 0 && (
        <p className="text-sm text-gray-500">Nenhuma campanha encerrada ainda.</p>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-4">
          {data.map((entry) => (
            <HistoryCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
