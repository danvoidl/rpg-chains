'use client';

import { useState } from 'react';
import type { Action, Effect } from '@rpg-chains/shared-types';
import { targetChoices, type TargetChoice } from './action-targets';
import { unitName } from './event-text';
import { optionButton, type TurnProps } from './turn-props';

/** An action waiting for its target. */
interface Aiming {
  label: string;
  choices: TargetChoice[];
  build: (targetId: string) => Action;
}

const sectionTitle = 'text-xs font-semibold uppercase tracking-wide text-gray-500';

/**
 * After a right answer, the answerer picks the group's action (spec §3.4): attack an enemy, use a
 * skill (energy and cooldown permitting) or a consumable. Effects with a single target ask for it
 * in a second step.
 */
export function ActionPanel(props: TurnProps & { profileId: string }) {
  const { view, me, act, pending, profileId } = props;
  const [aiming, setAiming] = useState<Aiming | null>(null);
  if (me?.profileId !== profileId) {
    return (
      <p className="text-sm text-gray-600">{unitName(view, profileId)} está escolhendo a ação…</p>
    );
  }

  const send = (action: Action) => {
    setAiming(null);
    act({ type: 'ChooseAction', turnToken: view.turnToken, action });
  };
  /** Acts at once, or asks for the target first. */
  const choose = (label: string, effect: Effect, build: (targetId?: string) => Action) => {
    const choices = targetChoices(effect, view, me);
    if (choices === null) send(build());
    else setAiming({ label, choices, build });
  };

  if (aiming) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-900">{aiming.label}: escolha o alvo</p>
        {aiming.choices.length === 0 && (
          <p className="text-sm text-gray-600">Nenhum alvo possível.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {aiming.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={optionButton}
              disabled={pending}
              onClick={() => send(aiming.build(choice.id))}
            >
              {choice.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-sm text-indigo-700 hover:underline"
          onClick={() => setAiming(null)}
        >
          Voltar
        </button>
      </div>
    );
  }

  const enemies = view.enemies.filter((e) => e.currentHp > 0);
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-900">Você acertou! Escolha a ação do grupo:</p>

      <div className="space-y-2">
        <p className={sectionTitle}>Atacar</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {enemies.map((enemy) => (
            <button
              key={enemy.instanceId}
              type="button"
              className={optionButton}
              disabled={pending}
              onClick={() => send({ type: 'attack', targetInstanceId: enemy.instanceId })}
            >
              Atacar {enemy.name}
            </button>
          ))}
        </div>
      </div>

      {me.skills.length > 0 && (
        <div className="space-y-2">
          <p className={sectionTitle}>Habilidades</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {me.skills.map((skill) => {
              const readyRound = me.cooldowns[skill.id];
              const cooling = readyRound !== undefined && view.round < readyRound;
              const broke = me.currentEnergy < skill.energyCost;
              const status = cooling
                ? `volta na rodada ${readyRound}`
                : broke
                  ? 'sem energia'
                  : `${skill.energyCost} de energia`;
              return (
                <button
                  key={skill.id}
                  type="button"
                  title={skill.text || undefined}
                  className={optionButton}
                  disabled={pending || cooling || broke}
                  onClick={() =>
                    choose(skill.name, skill.effect, (targetId) => ({
                      type: 'skill',
                      skillId: skill.id,
                      ...(targetId ? { targetId } : {}),
                    }))
                  }
                >
                  <span className="font-medium">{skill.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{status}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {me.consumables.length > 0 && (
        <div className="space-y-2">
          <p className={sectionTitle}>Itens</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {me.consumables.map((item) => (
              <button
                key={item.itemId}
                type="button"
                className={optionButton}
                disabled={pending}
                onClick={() =>
                  choose(item.name, item.effect, (targetId) => ({
                    type: 'consumable',
                    itemId: item.itemId,
                    ...(targetId ? { targetId } : {}),
                  }))
                }
              >
                {item.name} <span className="text-xs text-gray-500">×{item.quantity}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
