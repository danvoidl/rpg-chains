'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  validateDraft,
  type CompatibilityViolation,
  type DraftIssue,
} from '@rpg-chains/campaign-rules';
import { ApiError } from '@/lib/api';
import { useCampaignDraft } from '@/features/campaigns/draft-api';
import { usePublish, useVersions } from '@/features/publish/api';
import { issueMessage } from '@/features/chapters/issue-messages';
import { IssuesList } from '@/features/publish/issues-list';
import { ViolationsList } from '@/features/publish/violations-list';

interface PublishErrorBody {
  error?: string;
  issues?: DraftIssue[];
  violations?: CompatibilityViolation[];
}

/** Publish page: live pending issues, first-publish contract, publish action and version history. */
export default function PublishPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const { data: draft, isLoading: draftLoading } = useCampaignDraft(campaignId);
  const { data: versions, isLoading: versionsLoading } = useVersions(campaignId);
  const publish = usePublish(campaignId);

  const [accepted, setAccepted] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);

  const liveIssues = useMemo(() => (draft ? validateDraft(draft) : []), [draft]);

  if (draftLoading || versionsLoading) {
    return <p className="text-sm text-gray-500">Carregando…</p>;
  }

  const hasVersions = (versions?.length ?? 0) > 0;
  const nextVersion = (versions?.[0]?.version ?? 0) + 1;
  const needsAcceptance = !hasVersions && !accepted;

  const handlePublish = async () => {
    setPublishedVersion(null);
    const result = await publish.mutateAsync().catch(() => null);
    if (result) setPublishedVersion(result.version);
  };

  const errorBody =
    publish.error instanceof ApiError
      ? (publish.error.body as PublishErrorBody | undefined)
      : undefined;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Publicar</h1>

      <section aria-labelledby="pending-heading" className="space-y-2">
        <h2 id="pending-heading" className="text-lg font-semibold text-gray-900">
          Pendências
        </h2>
        {liveIssues.length === 0 ? (
          <p className="text-sm text-green-700">Nenhuma pendência.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {liveIssues.map((issue, i) => (
              <li key={`${issue.path}-${i}`}>
                {issueMessage(issue)} <span className="text-red-500">({issue.path})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {!hasVersions && (
          <>
            <p className="text-sm text-gray-700">
              Depois da primeira publicação, toda nova versão precisa ser retrocompatível: conteúdo
              já publicado não pode ser excluído, os atributos-base das classes não podem mudar e o
              grafo dos capítulos não pode perder alcançabilidade.
            </p>
            <label htmlFor="accept-rules" className="flex items-center gap-2 text-sm text-gray-700">
              <input
                id="accept-rules"
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              Entendi as regras de compatibilidade
            </label>
          </>
        )}

        <button
          type="button"
          onClick={handlePublish}
          disabled={publish.isPending || liveIssues.length > 0 || needsAcceptance}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Publicar versão {nextVersion}
        </button>

        {publishedVersion !== null && (
          <p role="status" className="text-sm text-green-700">
            Versão {publishedVersion} publicada.
          </p>
        )}

        {publish.isError && errorBody?.error === 'invalid_draft' && errorBody.issues && (
          <IssuesList issues={errorBody.issues} />
        )}
        {publish.isError && errorBody?.error === 'incompatible_changes' && errorBody.violations && (
          <ViolationsList violations={errorBody.violations} />
        )}
        {publish.isError && publish.error instanceof ApiError && publish.error.status === 409 && (
          <p role="alert" className="text-sm text-red-700">
            Outra publicação aconteceu ao mesmo tempo. Tente novamente.
          </p>
        )}
      </section>

      <section aria-labelledby="history-heading" className="space-y-2">
        <h2 id="history-heading" className="text-lg font-semibold text-gray-900">
          Histórico de versões
        </h2>
        {hasVersions ? (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Versão
                </th>
                <th scope="col" className="py-2 font-medium">
                  Publicada em
                </th>
              </tr>
            </thead>
            <tbody>
              {versions!.map((v) => (
                <tr key={v.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{v.version}</td>
                  <td className="py-2">{new Date(v.publishedAt).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Nenhuma versão publicada.</p>
        )}
      </section>
    </div>
  );
}
