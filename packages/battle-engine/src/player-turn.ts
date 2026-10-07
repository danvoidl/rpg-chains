import type { Action, Combatant, Rejection } from '@rpg-chains/shared-types';
import { attack } from './actions/attack.js';
import { useConsumable } from './actions/consumable.js';
import { useSkill } from './actions/skill.js';
import { emit, nextToken, type DecideContext } from './decide-context.js';
import { findQuestion } from './questions.js';
import { eligibleForSignal } from './signal.js';
import { endGroupTurn } from './turn-cycle.js';

/**
 * The group's turn as players drive it (spec §3.1–3.4): tap the signal, answer, act. Each returns a
 * rejection without emitting, or null after emitting the resulting events.
 */

const reject = (reason: string): Rejection => ({ ok: false, reason });

function findCombatant(ctx: DecideContext, profileId: string): Combatant | undefined {
  return ctx.state.combatants.find((c) => c.profileId === profileId);
}

export function tapSignal(ctx: DecideContext, profileId: string): Rejection | null {
  if (ctx.state.turn.stage !== 'awaiting_signal') return reject('signal_not_open');
  const player = findCombatant(ctx, profileId);
  if (!player) return reject('unknown_player');
  if (player.downed) return reject('player_downed');
  if (player.left) return reject('player_left');
  if (!eligibleForSignal(ctx.state).has(profileId)) return reject('blocked_this_round');
  emit(ctx, { type: 'SignalWonBy', turnToken: nextToken(ctx), profileId });
  return null;
}

/** The signal winner answers a multiple-choice question; the engine judges it (spec §3.2). */
export function submitObjectiveAnswer(
  ctx: DecideContext,
  profileId: string,
  index: number,
): Rejection | null {
  const { turn } = ctx.state;
  if (turn.stage !== 'awaiting_answer') return reject('not_answering');
  if (turn.profileId !== profileId) return reject('not_your_turn');
  if (turn.question.type !== 'objective') return reject('wrong_answer_type');
  const question = findQuestion(ctx.content, turn.question.questionId);
  if (question.type !== 'objective' || index >= question.options.length) {
    return reject('invalid_option');
  }

  const correct = index === question.correctIndex;
  emit(ctx, { type: 'AnswerJudged', turnToken: nextToken(ctx), profileId, correct });
  if (!correct) {
    // A wrong answer passes the turn straight to the next enemy (spec §3.1).
    emit(ctx, { type: 'TurnLost', reason: 'wrong_answer' });
    endGroupTurn(ctx, null);
  }
  return null;
}

/** The signal winner writes an answer to an open question; the master judges it (spec §3.2). */
export function submitOpenAnswer(
  ctx: DecideContext,
  profileId: string,
  text: string,
): Rejection | null {
  const { turn } = ctx.state;
  if (turn.stage !== 'awaiting_answer') return reject('not_answering');
  if (turn.profileId !== profileId) return reject('not_your_turn');
  if (turn.question.type !== 'open') return reject('wrong_answer_type');
  emit(ctx, { type: 'OpenAnswerSubmitted', turnToken: nextToken(ctx), profileId, text });
  return null;
}

/** The player who answered correctly acts (spec §3.4); acting blocks the next signal (§3.3). */
export function chooseAction(
  ctx: DecideContext,
  profileId: string,
  action: Action,
): Rejection | null {
  const { turn } = ctx.state;
  if (turn.stage !== 'awaiting_action') return reject('not_acting');
  if (turn.profileId !== profileId) return reject('not_your_turn');
  const actor = findCombatant(ctx, profileId)!;

  const rejected =
    action.type === 'attack'
      ? attack(ctx, actor, action.targetInstanceId)
      : action.type === 'skill'
        ? useSkill(ctx, actor, action.skillId, action.targetId)
        : useConsumable(ctx, actor, action.itemId, action.targetId);
  if (rejected) return rejected;
  endGroupTurn(ctx, profileId);
  return null;
}
