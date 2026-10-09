import type { Rejection, TurnStage } from '@rpg-chains/shared-types';
import { emit, type DecideContext } from './decide-context.js';
import {
  endGroupTurn,
  openGroupQuestion,
  pauseIfNobodyCanAct,
  resolveIfOver,
} from './turn-cycle.js';

/**
 * Commands the server issues (Fase 3 plan decisions 8, 10; Fase 6 plan decision 1): a timer ran
 * out, a player's connection dropped or came back, or a player is out for good.
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
 * A player is out of the battle for good (spec §7): left on purpose, or past the reconnection
 * grace. If the turn was waiting on them, it is lost; if nobody active is left, the battle is
 * lost; if nobody left could act is connected, it pauses.
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
  } else if (!resolveIfOver(ctx)) {
    pauseIfNobodyCanAct(ctx);
  }
  return null;
}

/**
 * A player's connection dropped (spec §7): they stay in the battle and stay a target, but cannot
 * tap the signal. A turn waiting on them keeps its clock; if nobody who could act is connected
 * any more, the battle pauses.
 */
export function playerDisconnected(ctx: DecideContext, profileId: string): Rejection | null {
  const player = ctx.state.combatants.find((c) => c.profileId === profileId);
  if (!player) return reject('unknown_player');
  if (player.left) return reject('player_left');
  if (!player.connected) return reject('unchanged');
  emit(ctx, { type: 'PlayerDisconnected', profileId });
  pauseIfNobodyCanAct(ctx);
  return null;
}

/** A player came back within the grace period; a battle paused for the group resumes. */
export function playerReconnected(ctx: DecideContext, profileId: string): Rejection | null {
  const player = ctx.state.combatants.find((c) => c.profileId === profileId);
  if (!player) return reject('unknown_player');
  if (player.left) return reject('player_left');
  if (player.connected) return reject('unchanged');
  emit(ctx, { type: 'PlayerReconnected', profileId });
  const { turn } = ctx.state;
  if (turn.stage === 'paused' && turn.reason === 'all_disconnected') openGroupQuestion(ctx);
  return null;
}
