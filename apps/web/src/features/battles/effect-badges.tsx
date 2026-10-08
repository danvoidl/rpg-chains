import type { ActiveEffect } from '@rpg-chains/shared-types';
import { effectLabel } from './effect-label';

/** The active effects on a unit, harmful ones in red. `r` = group rounds left. */
export function EffectBadges({ effects }: { effects: ActiveEffect[] }) {
  if (effects.length === 0) return null;
  return (
    <ul aria-label="Efeitos" className="flex flex-wrap gap-1">
      {effects.map((effect) => {
        const { text, harmful } = effectLabel(effect);
        return (
          <li
            key={effect.id}
            className={`rounded px-1.5 py-0.5 text-xs ${
              harmful ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {text}
          </li>
        );
      })}
    </ul>
  );
}
