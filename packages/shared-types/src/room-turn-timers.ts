import { z } from 'zod';
import { BATTLE_TIMER_RANGES, type BattleTimerKey } from '@rpg-chains/game-config';

function timer(key: BattleTimerKey) {
  const { minMs, maxMs } = BATTLE_TIMER_RANGES[key];
  return z.number().int().min(minMs).max(maxMs).optional();
}

/**
 * A room's adjustments to the turn timers (spec §3.3), in milliseconds. A missing key uses the
 * platform default; `{}` is "all defaults". A battle reads them when it starts, so a change only
 * reaches the next battle.
 */
export const RoomTurnTimersSchema = z.object({
  signalMs: timer('signalMs'),
  answerMs: timer('answerMs'),
  openAnswerMs: timer('openAnswerMs'),
  actionMs: timer('actionMs'),
});
export type RoomTurnTimers = z.infer<typeof RoomTurnTimersSchema>;
