import type { BattleState, Command, BattleEvent, Rejection } from '@rpg-chains/shared-types';

export type DecideResult = { ok: true; events: BattleEvent[] } | Rejection;

/** Alive players eligible for the signal, honoring bell rotation (spec §3.3). */
function eligibleForSignal(state: BattleState): Set<string> {
  const alive = state.combatants.filter((c) => !c.downed);
  const notBlocked = alive.filter((c) => !c.blockedFromSignal);
  // If rotation would leave nobody, the block is ignored (spec §3.3).
  const pool = notBlocked.length > 0 ? notBlocked : alive;
  return new Set(pool.map((c) => c.profileId));
}

function decideTapSignal(state: BattleState, profileId: string): DecideResult {
  if (!state.signal) return { ok: false, reason: 'signal_not_open' };
  if (state.signal.winnerId) return { ok: false, reason: 'signal_already_won' };
  const player = state.combatants.find((c) => c.profileId === profileId);
  if (!player) return { ok: false, reason: 'unknown_player' };
  if (player.downed) return { ok: false, reason: 'player_downed' };
  if (!eligibleForSignal(state).has(profileId)) return { ok: false, reason: 'blocked_this_round' };
  return { ok: true, events: [{ type: 'SignalWonBy', profileId }] };
}

/**
 * Pure command → events | rejection (decision 1). All combat rules live here; the server
 * only transports. Phase 3 fills in answering, actions and enemy turns.
 */
export function decide(state: BattleState, command: Command): DecideResult {
  // Reject stale/duplicate commands from a past turn (decision 2).
  if (command.turnToken !== state.turnToken) return { ok: false, reason: 'stale_turn_token' };

  switch (command.type) {
    case 'TapSignal':
      return decideTapSignal(state, command.profileId);
    case 'SubmitObjectiveAnswer':
    case 'SubmitOpenAnswer':
    case 'JudgeOpenAnswer':
    case 'ChooseAction':
      // TODO(Phase 3): answering, judging and action resolution.
      return { ok: false, reason: 'not_implemented' };
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
