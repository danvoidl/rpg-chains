import type { DraftWarning } from '@rpg-chains/campaign-rules';
import { warningMessage } from './warning-messages';

/** Lists non-blocking balancing warnings (message and path). */
export function WarningsList({ title, warnings }: { title: string; warnings: DraftWarning[] }) {
  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">{title}</p>
      <ul className="list-disc pl-5">
        {warnings.map((warning, i) => (
          <li key={`${warning.path}-${i}`}>
            {warningMessage(warning)} <span className="text-amber-700">({warning.path})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
