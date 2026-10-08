import type { BattleContent, PrngState, Question } from '@rpg-chains/shared-types';
import { draw, emit, nextToken, type DecideContext } from './decide-context.js';
import { nextInt } from './prng.js';
import { toPublicQuestion } from './public-view.js';

/** Objective question ids of the node: the deck the engine draws from by itself (spec §3.2). */
export function objectiveIds(content: BattleContent): string[] {
  return content.questions.filter((q) => q.type === 'objective').map((q) => q.id);
}

/** Fisher–Yates with the battle PRNG. */
export function shuffle(
  prng: PrngState,
  ids: readonly string[],
): { value: string[]; state: PrngState } {
  const deck = [...ids];
  let state = prng;
  for (let i = deck.length - 1; i > 0; i--) {
    const roll = nextInt(state, 0, i + 1);
    state = roll.state;
    [deck[i], deck[roll.value]] = [deck[roll.value]!, deck[i]!];
  }
  return { value: deck, state };
}

/**
 * Opens the signal with the next objective question (Fase 3 plan decision 7): the deck runs
 * without repeats until empty, then is reshuffled.
 */
export function openSignalFromDeck(ctx: DecideContext): void {
  if (ctx.state.secret.questionDeck.length === 0) {
    const deck = draw(ctx, (prng) => shuffle(prng, objectiveIds(ctx.content)));
    emit(ctx, { type: 'QuestionDeckShuffled', deck });
  }
  const question = findQuestion(ctx.content, ctx.state.secret.questionDeck[0]!);
  emit(ctx, {
    type: 'SignalOpened',
    turnToken: nextToken(ctx),
    question: toPublicQuestion(question),
  });
}

export function findQuestion(content: BattleContent, questionId: string): Question {
  const question = content.questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`question ${questionId} is not in the battle content`);
  return question;
}
