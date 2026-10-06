'use client';

import type { DraftIssue } from '@rpg-chains/campaign-rules';
import { issueMessage } from './issue-messages';

interface IssuesPanelProps {
  issues: DraftIssue[];
  labels: Map<string, string>;
  underConstruction: boolean;
  onSelectNode: (nodeId: string) => void;
}

/** Lists the live validation issues of the chapter being edited. */
export function IssuesPanel({ issues, labels, underConstruction, onSelectNode }: IssuesPanelProps) {
  return (
    <section
      aria-labelledby="issues-heading"
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 id="issues-heading" className="mb-3 text-lg font-semibold text-gray-900">
        Problemas
      </h2>

      {underConstruction && (
        <p className="mb-3 text-sm text-yellow-800">
          Capítulo em construção: não entra na publicação.
        </p>
      )}

      {issues.length === 0 ? (
        <p className="text-sm text-green-700">Nenhum problema — capítulo pronto para publicar.</p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue, i) => (
            <li key={`${issue.path}-${i}`} className="flex items-start gap-3 text-sm text-red-700">
              <span className="flex-1">
                {issue.nodeId && labels.has(issue.nodeId) && (
                  <strong>{labels.get(issue.nodeId)}: </strong>
                )}
                {issueMessage(issue)}
              </span>
              {issue.nodeId && (
                <button
                  type="button"
                  onClick={() => onSelectNode(issue.nodeId!)}
                  className="shrink-0 text-blue-600 hover:underline"
                >
                  Selecionar nó
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
