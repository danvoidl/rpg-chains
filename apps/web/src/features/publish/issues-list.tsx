import type { DraftIssue } from '@rpg-chains/campaign-rules';
import { issueMessage } from '@/features/chapters/issue-messages';

/** Lists draft issues (message and path) under a title. */
export function IssuesList({ issues }: { issues: DraftIssue[] }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p className="font-semibold">O rascunho tem problemas</p>
      <ul className="list-disc pl-5">
        {issues.map((issue, i) => (
          <li key={`${issue.path}-${i}`}>
            {issueMessage(issue)} <span className="text-red-600">({issue.path})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
