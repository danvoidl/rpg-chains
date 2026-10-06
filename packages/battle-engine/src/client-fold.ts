import type {
  BattleEvent,
  BattleSecret,
  PublicBattleEvent,
  PublicBattleState,
} from '@rpg-chains/shared-types';
import { evolve } from './evolve.js';
import { toPublicState } from './public-view.js';

/** Placeholder secrets: no public event reads them in a way that shows (the deck pop is a no-op). */
const NO_SECRET: BattleSecret = { prng: { seed: 0, cursor: 0 }, questionDeck: [] };

/**
 * The client's fold (Fase 3 plan M4): the same `evolve` the server runs, over the public state and
 * the public events. Starting from a `battle:sync`, it reaches exactly the public projection of
 * the server's state — `replay.test.ts` checks it on every seed.
 */
export function evolvePublic(
  state: PublicBattleState,
  event: PublicBattleEvent,
): PublicBattleState {
  // The public `BattleStarted` lacks the seed and deck; a client starts from a sync anyway.
  const full: BattleEvent =
    event.type === 'BattleStarted'
      ? { ...event, seed: NO_SECRET.prng.seed, questionDeck: NO_SECRET.questionDeck }
      : event;
  return toPublicState(evolve({ ...state, secret: NO_SECRET }, full));
}
