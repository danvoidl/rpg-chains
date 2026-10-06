import type { BattleState, BattleEvent } from '@rpg-chains/shared-types';

/**
 * Pure fold: state + event → next state (decision 1). Deterministic and side-effect free.
 * The battle log is a sequence of events; the current state is their reduction. Phase 3
 * completes damage/heal/effect/turn resolution; the slice below is enough to drive the
 * signal loop and prove replay.
 */
export function evolve(state: BattleState, event: BattleEvent): BattleState {
  switch (event.type) {
    case 'BattleStarted':
      // Seed the folded PRNG from the genesis event (decision 3).
      return {
        ...state,
        prng: { seed: event.seed, cursor: 0 },
        turnToken: event.turnToken,
        activeSide: event.initiative === 'group' ? { side: 'group' } : state.activeSide,
      };

    case 'SignalOpened':
      return {
        ...state,
        turnToken: event.turnToken,
        signal: { questionId: event.questionId, winnerId: null },
      };

    case 'SignalWonBy':
      return state.signal
        ? { ...state, signal: { ...state.signal, winnerId: event.profileId } }
        : state;

    case 'TurnAdvanced':
      return {
        ...state,
        turnToken: event.turnToken,
        signal: null,
        activeSide:
          event.activeSide === 'group'
            ? { side: 'group' }
            : { side: 'enemy', instanceId: event.instanceId! },
      };

    case 'BattleResolved':
      return { ...state, result: event.result };

    // TODO(Phase 3): DamageDealt, Healed, EffectApplied, EffectExpired, EnemyActed,
    // AnswerJudged, ActionTaken, PlayerDowned, PlayerRevived.
    default:
      return state;
  }
}

/** Fold an entire event log into final state (replay / reconnection). */
export function replay(initial: BattleState, events: readonly BattleEvent[]): BattleState {
  return events.reduce(evolve, initial);
}
