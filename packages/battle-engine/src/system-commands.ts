import type { Rejection, TurnStage } from '@rpg-chains/shared-types';
import { emit, type DecideContext } from './decide-context.js';
import { endGroupTurn, resolveIfOver } from './turn-cycle.js';

/**
 * Commands the server issues (Fase 3 plan decisions 8, 10): a timer ran out, or a player dropped.
 */

const reject = (reason: string): Rejection => ({ ok: false, reason });

const TIMEOUTS = {
  SignalExpired: { stage: 'awaiting_signal', reason: 'signal_expired' },
  AnswerTimedOut: { stage: 'awaiting_answer', reason: 'answer_timeout' },
  ActionTimedOut: { stage: 'awaiting_action', reason: 'action_timeout' },
} as const satisfies Record<string, { stage: TurnStage; reason: string }>;

/** A step of the group's turn took too long: the turn is lost, nobody gets blocked. */
export function timeOut(ctx: DecideContext, type: keyof typeof TIMEOUTS): Rejection | null {
  const { stage, reason } = TIMEOUTS[type];
  if (ctx.state.turn.stage !== stage) return reject('wrong_stage');
  emit(ctx, { type: 'TurnLost', reason });
  endGroupTurn(ctx, null);
  return null;
}

/**
 * A player disconnected: out of the battle for good (spec §7). If the turn was waiting on them,
 * it is lost; if nobody active is left, the battle is lost.
 */
export function playerLeft(ctx: DecideContext, profileId: string): Rejection | null {
  const player = ctx.state.combatants.find((c) => c.profileId === profileId);
  if (!player) return reject('unknown_player');
  if (player.left) return reject('player_left');
  emit(ctx, { type: 'PlayerLeft', profileId });

  const { turn } = ctx.state;
  const waitingOnThem = 'profileId' in turn && turn.profileId === profileId;
  if (waitingOnThem) {
    emit(ctx, { type: 'TurnLost', reason: 'player_left' });
    endGroupTurn(ctx, null);
  } else {
    resolveIfOver(ctx);
  }
  return null;
}
