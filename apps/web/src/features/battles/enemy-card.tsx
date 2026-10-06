import type { Enemy } from '@rpg-chains/shared-types';
import { ResourceBar } from './resource-bar';

interface EnemyCardProps {
  enemy: Enemy;
  /** It is this enemy's turn. */
  isActing: boolean;
}

/** A villain on the field: portrait, HP and whether it is still standing. */
export function EnemyCard({ enemy, isActing }: EnemyCardProps) {
  const defeated = enemy.currentHp === 0;
  const stunned = enemy.effects.some((e) => e.kind === 'stun');
  return (
    <li
      aria-label={enemy.name}
      className={`space-y-2 rounded-lg border bg-white p-3 ${
        isActing ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200'
      } ${defeated ? 'opacity-40' : ''}`}
    >
      {enemy.imageUrl && (
        <img src={enemy.imageUrl} alt="" className="h-24 w-full rounded object-contain" />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{enemy.name}</span>
        {defeated && <span className="text-xs text-gray-600">derrotado</span>}
        {!defeated && stunned && <span className="text-xs text-amber-700">atordoado</span>}
      </div>
      <ResourceBar label="Vida" current={enemy.currentHp} max={enemy.maxHp} color="bg-red-500" />
    </li>
  );
}
