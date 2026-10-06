import type {
  BattleEvent,
  BattleState,
  PublicBattleEvent,
  PublicBattleState,
  PublicQuestion,
  Question,
} from '@rpg-chains/shared-types';

/**
 * Projections to what clients may see (Fase 3 plan decision 13): never the PRNG (it predicts
 * draws), the question deck, or an answer key. Everything the server emits passes through here.
 */

export function toPublicState(state: BattleState): PublicBattleState {
  const { secret: _secret, ...visible } = state;
  return visible;
}

/** The public form of an event, or null for server-only bookkeeping. */
export function toPublicEvent(event: BattleEvent): PublicBattleEvent | null {
  switch (event.type) {
    case 'PrngAdvanced':
    case 'QuestionDeckShuffled':
      return null;
    case 'BattleStarted': {
      const { seed: _seed, questionDeck: _deck, ...visible } = event;
      return visible;
    }
    default:
      return event;
  }
}

/** A snapshot question as shown to players, without its answer key. */
export function toPublicQuestion(question: Question): PublicQuestion {
  return question.type === 'objective'
    ? {
        type: 'objective',
        questionId: question.id,
        prompt: question.prompt,
        options: question.options,
      }
    : { type: 'open', questionId: question.id, prompt: question.prompt };
}
