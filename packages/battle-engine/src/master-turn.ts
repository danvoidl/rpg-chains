import type { MasterCommand, Rejection } from '@rpg-chains/shared-types';
import { emit, nextToken, type DecideContext } from './decide-context.js';
import { objectiveIds, openSignalFromDeck } from './questions.js';
import { toPublicQuestion } from './public-view.js';
import { endGroupTurn, openGroupQuestion } from './turn-cycle.js';

/**
 * The master's part of a battle with open questions (spec §3.2): choosing each turn's question,
 * judging open answers, and what his presence changes. The server has already checked that the
 * sender is the room master.
 */

const reject = (reason: string): Rejection => ({ ok: false, reason });

type Presented = Extract<MasterCommand, { type: 'PresentQuestion' }>['question'];

/** Shows a node question, one written on the spot (kept only in this battle), or a drawn one. */
export function presentQuestion(ctx: DecideContext, question: Presented): Rejection | null {
  if (ctx.state.turn.stage !== 'awaiting_question') return reject('no_question_requested');
  if ('draw' in question) {
    if (objectiveIds(ctx.content).length === 0) return reject('no_objective_questions');
    openSignalFromDeck(ctx);
    return null;
  }
  if ('prompt' in question) {
    emit(ctx, {
      type: 'SignalOpened',
      turnToken: nextToken(ctx),
      question: { type: 'open', questionId: null, prompt: question.prompt },
    });
    return null;
  }
  const found = ctx.content.questions.find((q) => q.id === question.questionId);
  if (!found) return reject('unknown_question');
  emit(ctx, { type: 'SignalOpened', turnToken: nextToken(ctx), question: toPublicQuestion(found) });
  return null;
}

/** Approves or fails the pending open answer; a failed one passes the turn like a wrong answer. */
export function judgeOpenAnswer(ctx: DecideContext, approved: boolean): Rejection | null {
  const { turn } = ctx.state;
  if (turn.stage !== 'awaiting_judgement') return reject('nothing_to_judge');
  emit(ctx, {
    type: 'AnswerJudged',
    turnToken: nextToken(ctx),
    profileId: turn.profileId,
    correct: approved,
  });
  if (!approved) {
    emit(ctx, { type: 'TurnLost', reason: 'wrong_answer' });
    endGroupTurn(ctx, null);
  }
  return null;
}

/**
 * The master came or went (Fase 3 plan decision 2). Leaving while a question is awaited falls back
 * to the objective deck or pauses; returning resumes a paused battle with a fresh question request.
 * An answer already sent keeps waiting for him either way.
 */
export function masterPresence(ctx: DecideContext, online: boolean): Rejection | null {
  if (!ctx.state.needsMaster) return reject('master_not_needed');
  if (ctx.state.masterOnline === online) return reject('unchanged');
  emit(ctx, { type: 'MasterPresenceChanged', online });
  const { turn } = ctx.state;
  const pausedForHim = turn.stage === 'paused' && turn.reason === 'master_absent';
  if ((online && pausedForHim) || (!online && turn.stage === 'awaiting_question')) {
    openGroupQuestion(ctx);
  }
  return null;
}
