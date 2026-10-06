import type { DraftIssue, DraftWarning } from '@rpg-chains/campaign-rules';
import { issueMessage } from '@/features/chapters/issue-messages';
import { warningMessage } from '@/features/publish/warning-messages';

/** Where in the class a path points, in author terms: the class itself or skill N. */
function location(path: string): string {
  const skill = /\.skills\[(\d+)\]/.exec(path);
  return skill ? `Habilidade ${Number(skill[1]) + 1}` : 'Classe';
}

interface ClassFeedbackProps {
  issues: DraftIssue[];
  warnings: DraftWarning[];
}

/** Live publish-gate feedback for the class being edited: blocking issues, then warnings. */
export function ClassFeedback({ issues, warnings }: ClassFeedbackProps) {
  if (issues.length === 0 && warnings.length === 0) return null;
  return (
    <div className="space-y-3" aria-live="polite">
      {issues.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Bloqueia a publicação</p>
          <ul className="list-disc pl-5">
            {issues.map((issue, i) => (
              <li key={`${issue.path}-${i}`}>
                {location(issue.path)}: {issueMessage(issue)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Fora das faixas recomendadas</p>
          <ul className="list-disc pl-5">
            {warnings.map((warning, i) => (
              <li key={`${warning.path}-${i}`}>
                {location(warning.path)}: {warningMessage(warning)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
