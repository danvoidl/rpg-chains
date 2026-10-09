import type {
  BattleContent,
  BattleEvent,
  BattleState,
  Command,
  Rejection,
} from '@rpg-chains/shared-types';
import { createContext, finish } from './decide-context.js';
import { judgeOpenAnswer, masterPresence, presentQuestion } from './master-turn.js';
import { chooseAction, submitObjectiveAnswer, submitOpenAnswer, tapSignal } from './player-turn.js';
import { playerDisconnected, playerLeft, playerReconnected, timeOut } from './system-commands.js';

export type DecideResult = { ok: true; events: BattleEvent[] } | Rejection;

/**
 * Pure command → events | rejection: all combat rules live here (CLAUDE.md "battle engine").
 * `content` is the immutable campaign slice the battle started on (Fase 3 plan decision 3); only
 * `decide` reads it. One accepted command may run several turns — an action, the enemy's reply,
 * the next signal — so the result always stops where a person must act again.
 */
export function decide(state: BattleState, command: Command, content: BattleContent): DecideResult {
  if (state.result !== null) return { ok: false, reason: 'battle_ended' };
  // Turn-bound commands answer one stage; a different token is stale or a duplicate.
  if ('turnToken' in command && command.turnToken !== state.turnToken) {
    return { ok: false, reason: 'stale_turn_token' };
  }

  const ctx = createContext(state, content);
  const rejected = run(ctx, command);
  return rejected ?? { ok: true, events: finish(ctx) };
}

function run(ctx: ReturnType<typeof createContext>, command: Command): Rejection | null {
  switch (command.type) {
    case 'TapSignal':
      return tapSignal(ctx, command.profileId);
    case 'SubmitObjectiveAnswer':
      return submitObjectiveAnswer(ctx, command.profileId, command.index);
    case 'ChooseAction':
      return chooseAction(ctx, command.profileId, command.action);
    case 'SignalExpired':
    case 'AnswerTimedOut':
    case 'ActionTimedOut':
      return timeOut(ctx, command.type);
    case 'PlayerLeft':
      return playerLeft(ctx, command.profileId);
    case 'PlayerDisconnected':
      return playerDisconnected(ctx, command.profileId);
    case 'PlayerReconnected':
      return playerReconnected(ctx, command.profileId);
    case 'SubmitOpenAnswer':
      return submitOpenAnswer(ctx, command.profileId, command.text);
    case 'PresentQuestion':
      return presentQuestion(ctx, command.question);
    case 'JudgeOpenAnswer':
      return judgeOpenAnswer(ctx, command.approved);
    case 'MasterPresenceChanged':
      return masterPresence(ctx, command.online);
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
