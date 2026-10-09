import { combatantDefense, outgoingDamage, weaponRawDamage } from '@rpg-chains/battle-engine';
import type { Combatant } from '@rpg-chains/shared-types';
import { EffectBadges } from './effect-badges';
import { ResourceBar } from './resource-bar';

interface CombatantCardProps {
  combatant: Combatant;
  isViewer: boolean;
  /** Holds the turn right now (answering or choosing the action). */
  isActing: boolean;
  /** May tap the next signal (bell rotation, spec §3.3). */
  isEligible: boolean;
}

/**
 * A group member: HP, energy, attack and defense as they stand (buffs included), and what keeps
 * them out of the signal.
 */
export function CombatantCard({ combatant, isViewer, isActing, isEligible }: CombatantCardProps) {
  const status = combatant.left
    ? 'saiu'
    : !combatant.connected
      ? 'sem conexão'
      : combatant.downed
        ? 'caído'
        : !isEligible
          ? 'descansando'
          : null;
  return (
    <li
      aria-label={combatant.name}
      className={`space-y-2 rounded-lg border bg-white p-3 ${
        isActing ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'
      } ${combatant.left || combatant.downed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900">
          {combatant.name}
          {isViewer && <span className="ml-1 text-xs text-gray-500">(você)</span>}
        </span>
        {status && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{status}</span>
        )}
      </div>
      <ResourceBar
        label="Vida"
        current={combatant.currentHp}
        max={combatant.maxHp}
        color="bg-green-500"
      />
      <ResourceBar
        label="Energia"
        current={combatant.currentEnergy}
        max={combatant.maxEnergy}
        color="bg-sky-500"
      />
      <p className="text-xs text-gray-600">
        Ataque {Math.floor(outgoingDamage(weaponRawDamage(combatant), combatant))} · Defesa{' '}
        {Math.floor(combatantDefense(combatant))}
      </p>
      <EffectBadges effects={combatant.effects} />
    </li>
  );
}
