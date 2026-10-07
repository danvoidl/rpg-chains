'use client';

import type { ProfileSheet, RoomMember } from '@rpg-chains/shared-types';
import { ATTRIBUTES } from '@rpg-chains/game-config';
import { ATTRIBUTE_LABELS } from '@/features/effects/effect-labels';
import { ResourceBar } from '@/features/battles/resource-bar';
import { useProfileSheet } from './api';
import { EquipmentList } from './equipment-list';
import { InventoryList } from './inventory-list';
import { PointsForm } from './points-form';

interface CharacterSheetProps {
  roomId: string;
  members: RoomMember[];
}

/** The viewer's character in the room (Fase 4 plan M3–M4): level, XP, private gold, points, gear. */
export function CharacterSheet({ roomId, members }: CharacterSheetProps) {
  const { data: sheet, isLoading } = useProfileSheet(roomId, true);
  if (isLoading || !sheet) return <p className="text-sm text-gray-500">Carregando ficha…</p>;

  return (
    <section
      aria-label="Meu personagem"
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {sheet.className} · nível {sheet.level}
        </h2>
        <p className="text-sm font-medium text-amber-700">{sheet.gold} de ouro</p>
      </div>

      <XpBar sheet={sheet} />

      <div className="grid gap-2 sm:grid-cols-2">
        <ResourceBar
          label="Vida"
          current={sheet.currentHp}
          max={sheet.maxHp}
          color="bg-green-500"
        />
        <ResourceBar
          label="Energia"
          current={sheet.currentEnergy}
          max={sheet.maxEnergy}
          color="bg-sky-500"
        />
      </div>
      {sheet.downed && <p className="text-sm text-red-700">Caído: precisa descansar.</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {ATTRIBUTES.map((attribute) => (
          <div key={attribute}>
            <dt className="text-gray-500">{ATTRIBUTE_LABELS[attribute]}</dt>
            <dd className="font-medium text-gray-900">{sheet.attributes[attribute]}</dd>
          </div>
        ))}
        <div>
          <dt className="text-gray-500">Defesa</dt>
          <dd className="font-medium text-gray-900">{sheet.defense}</dd>
        </div>
      </dl>

      {sheet.availablePoints > 0 && (
        <PointsForm key={sheet.availablePoints} roomId={roomId} sheet={sheet} />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Habilidades</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {sheet.skills.map((skill) => (
              <li key={skill.id} className={skill.unlocked ? 'text-gray-900' : 'text-gray-400'}>
                {skill.name}
                {!skill.unlocked && ` (nível ${skill.unlockLevel})`}
              </li>
            ))}
          </ul>
        </div>
        <EquipmentList roomId={roomId} sheet={sheet} />
        <InventoryList roomId={roomId} sheet={sheet} members={members} />
      </div>
    </section>
  );
}

/** Progress to the next level; full at the max level. */
function XpBar({ sheet }: { sheet: ProfileSheet }) {
  if (sheet.xpToNextLevel === null) {
    return <p className="text-sm text-gray-700">Nível máximo.</p>;
  }
  const percent = Math.min(100, Math.round((sheet.xp / sheet.xpToNextLevel) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>Experiência</span>
        <span>
          {sheet.xp} / {sheet.xpToNextLevel}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Experiência"
        aria-valuenow={sheet.xp}
        aria-valuemax={sheet.xpToNextLevel}
        className="mt-1 h-2 rounded bg-gray-200"
      >
        <div className="h-2 rounded bg-indigo-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
