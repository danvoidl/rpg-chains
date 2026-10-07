'use client';

import { useState } from 'react';
import { ATTRIBUTE_GAINS, ATTRIBUTES, type Attribute } from '@rpg-chains/game-config';
import type { ProfileSheet } from '@rpg-chains/shared-types';
import { ATTRIBUTE_LABELS } from '@/features/effects/effect-labels';
import { roomErrorMessage } from '@/features/rooms/room-error-messages';
import { useSpendPoints } from './api';

interface PointsFormProps {
  roomId: string;
  sheet: ProfileSheet;
}

const NONE: Record<Attribute, number> = { strength: 0, dexterity: 0, intelligence: 0 };

/** What one point of each attribute gives out of battle (spec §4.1), for the preview. */
const GAIN_TEXT: Record<Attribute, string> = {
  strength: `+${ATTRIBUTE_GAINS.strength.health} vida, +${ATTRIBUTE_GAINS.strength.defense} defesa`,
  dexterity: `+${ATTRIBUTE_GAINS.dexterity.health} vida, +${ATTRIBUTE_GAINS.dexterity.defense} defesa`,
  intelligence: `+${ATTRIBUTE_GAINS.intelligence.energy} energia`,
};

/**
 * Distributes the points a level-up gave (Fase 4 plan decision 7): steppers per attribute, a
 * preview of the resulting ceilings and defense, and a confirmation — a point is permanent.
 */
export function PointsForm({ roomId, sheet }: PointsFormProps) {
  const spendPoints = useSpendPoints(roomId);
  const [spend, setSpend] = useState(NONE);
  const used = ATTRIBUTES.reduce((sum, a) => sum + spend[a], 0);
  const left = sheet.availablePoints - used;

  const preview = {
    maxHp:
      sheet.maxHp +
      spend.strength * ATTRIBUTE_GAINS.strength.health +
      spend.dexterity * ATTRIBUTE_GAINS.dexterity.health,
    maxEnergy: sheet.maxEnergy + spend.intelligence * ATTRIBUTE_GAINS.intelligence.energy,
    defense:
      sheet.defense +
      spend.strength * ATTRIBUTE_GAINS.strength.defense +
      spend.dexterity * ATTRIBUTE_GAINS.dexterity.defense,
  };

  const change = (attribute: Attribute, delta: number) =>
    setSpend((s) => ({ ...s, [attribute]: Math.max(0, s[attribute] + delta) }));

  const confirm = () => {
    if (!window.confirm('Distribuir os pontos? A escolha é permanente.')) return;
    spendPoints.mutate(spend, { onSuccess: () => setSpend(NONE) });
  };

  return (
    <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-sm font-medium text-gray-900">
        {left} {left === 1 ? 'ponto' : 'pontos'} para distribuir
      </p>
      {spendPoints.isError && (
        <p role="alert" className="text-sm text-red-700">
          {roomErrorMessage(spendPoints.error, 'Não foi possível distribuir os pontos.')}
        </p>
      )}
      <ul className="space-y-2">
        {ATTRIBUTES.map((attribute) => (
          <li key={attribute} className="flex items-center gap-3 text-sm">
            <span className="w-28 text-gray-700">{ATTRIBUTE_LABELS[attribute]}</span>
            <button
              type="button"
              aria-label={`Tirar ponto de ${ATTRIBUTE_LABELS[attribute]}`}
              disabled={spend[attribute] === 0}
              onClick={() => change(attribute, -1)}
              className="h-7 w-7 rounded border border-gray-300 bg-white disabled:opacity-40"
            >
              −
            </button>
            <span className="w-16 text-center tabular-nums">
              {sheet.attributes[attribute] + spend[attribute]}
              {spend[attribute] > 0 && (
                <span className="text-indigo-700"> (+{spend[attribute]})</span>
              )}
            </span>
            <button
              type="button"
              aria-label={`Pôr ponto em ${ATTRIBUTE_LABELS[attribute]}`}
              disabled={left === 0}
              onClick={() => change(attribute, 1)}
              className="h-7 w-7 rounded border border-gray-300 bg-white disabled:opacity-40"
            >
              +
            </button>
            <span className="text-xs text-gray-500">{GAIN_TEXT[attribute]} por ponto</span>
          </li>
        ))}
      </ul>
      {used > 0 && (
        <p className="text-sm text-gray-700">
          Fica com vida máxima {preview.maxHp}, energia máxima {preview.maxEnergy} e defesa{' '}
          {preview.defense}.
        </p>
      )}
      <button
        type="button"
        disabled={used === 0 || spendPoints.isPending}
        onClick={confirm}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        Distribuir pontos
      </button>
    </div>
  );
}
