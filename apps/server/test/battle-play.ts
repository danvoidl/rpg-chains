import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';
import { eligibleForSignal } from '@rpg-chains/battle-engine';
import type { BattleState, Command } from '@rpg-chains/shared-types';
import { correctIndex } from './battle-fixtures.js';

/** The state of a running battle of the registry; throws if it is not running. */
export function runningState(app: FastifyInstance, battleId: string): BattleState {
  const battle = app.battles.get(battleId);
  if (battle?.status !== 'running') throw new Error('not running');
  return battle.state;
}

/** The command a perfect player sends next, with the actor bound as the server would. */
export function nextCommand(state: BattleState): Command {
  const { turn, turnToken } = state;
  switch (turn.stage) {
    case 'awaiting_signal':
      return { type: 'TapSignal', turnToken, profileId: [...eligibleForSignal(state)][0]! };
    case 'awaiting_answer':
      if (turn.question.type !== 'objective') throw new Error('open question');
      return {
        type: 'SubmitObjectiveAnswer',
        turnToken,
        profileId: turn.profileId,
        index: correctIndex(turn.question.questionId),
      };
    case 'awaiting_action':
      return {
        type: 'ChooseAction',
        turnToken,
        profileId: turn.profileId,
        action: {
          type: 'attack',
          targetInstanceId: state.enemies.find((e) => e.currentHp > 0)!.instanceId,
        },
      };
    default:
      throw new Error(`no move in stage ${turn.stage}`);
  }
}

/** Plays the battle to its end through the registry; returns the final state. */
export function playBattleToEnd(app: FastifyInstance, battleId: string): BattleState {
  for (let step = 0; step < 100; step++) {
    const state = runningState(app, battleId);
    if (state.result !== null) return state;
    expect(app.battles.apply(battleId, nextCommand(state))).toEqual({ ok: true });
  }
  throw new Error('battle did not end');
}
