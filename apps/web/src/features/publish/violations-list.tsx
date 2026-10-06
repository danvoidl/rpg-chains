import type { CompatibilityViolation } from '@rpg-chains/campaign-rules';
import { violationMessage } from './violation-messages';
import { VIOLATION_LABELS } from './violation-labels';

/** Groups compatibility violations by rule under a "publish refused" alert. */
export function ViolationsList({ violations }: { violations: CompatibilityViolation[] }) {
  const groups = new Map<CompatibilityViolation['rule'], CompatibilityViolation[]>();
  for (const violation of violations) {
    groups.set(violation.rule, [...(groups.get(violation.rule) ?? []), violation]);
  }

  return (
    <div
      role="alert"
      className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p className="font-semibold">Publicação recusada: mudanças incompatíveis</p>
      {[...groups.entries()].map(([rule, items]) => (
        <div key={rule}>
          <h3 className="font-medium">{VIOLATION_LABELS[rule]}</h3>
          <ul className="list-disc pl-5">
            {items.map((v, i) => (
              <li key={`${v.entityId}-${i}`}>
                {violationMessage(v)} <span className="text-red-600">({v.entityId})</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
