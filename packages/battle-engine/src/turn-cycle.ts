import { emit, nextToken, type DecideContext } from './decide-context.js';
import { tickOverTime } from './effects/over-time.js';
import { runEnemyTurn } from './enemy-turn.js';
import { objectiveIds, openSignalFromDeck } from './questions.js';
import { grantRewards } from './rewards.js';
import { canAct, isActive } from './signal.js';

/**
 * The strict alternation of spec §3.1 — enemy, group, enemy, group — and the end of the battle.
 * Every path that finishes a step ends here, so a battle can never stall between turns.
 */

/**
 * Ends the battle if one side is out (all enemies at 0 HP, or no active player). A victory grants
 * its rewards first (spec §6).
 */
export function resolveIfOver(ctx: DecideContext): boolean {
  if (ctx.state.result !== null) return true;
  if (ctx.state.enemies.every((e) => e.currentHp <= 0)) {
    grantRewards(ctx);
    emit(ctx, { type: 'BattleResolved', result: 'victory' });
    return true;
  }
  if (!ctx.state.combatants.some(isActive)) {
    emit(ctx, { type: 'BattleResolved', result: 'defeat' });
    return true;
  }
  return false;
}

/** The group's turn opens: a new round, and the signal with a question (spec §3.1–3.2). */
export function startGroupTurn(ctx: DecideContext): void {
  if (resolveIfOver(ctx)) return;
  emit(ctx, { type: 'TurnAdvanced', turnToken: nextToken(ctx), to: { side: 'group' } });
  openGroupQuestion(ctx);
}

/**
 * Where the group's question comes from (spec §3.2): a battle with open questions waits for the
 * master to pick one while he is present; without him it falls back to the node's objective
 * questions, or pauses — enemies included — if there are none. With no player who could act
 * connected, it pauses before any of that (spec §3.7).
 */
export function openGroupQuestion(ctx: DecideContext): void {
  if (!ctx.state.combatants.some(canAct)) {
    emit(ctx, { type: 'BattlePaused', turnToken: nextToken(ctx), reason: 'all_disconnected' });
    return;
  }
  if (!ctx.state.needsMaster) return openSignalFromDeck(ctx);
  if (ctx.state.masterOnline) {
    emit(ctx, { type: 'QuestionRequested', turnToken: nextToken(ctx) });
  } else if (objectiveIds(ctx.content).length > 0) {
    openSignalFromDeck(ctx);
  } else {
    emit(ctx, { type: 'BattlePaused', turnToken: nextToken(ctx), reason: 'master_absent' });
  }
}

/** The next enemy acts, then the group's turn opens. */
export function runEnemyPhase(ctx: DecideContext): void {
  runEnemyTurn(ctx);
  if (!resolveIfOver(ctx)) startGroupTurn(ctx);
}

/**
 * The group's turn is over — an action, a wrong answer or a timeout. `actorId` acted and sits out
 * the next signal (spec §3.3); null when the turn was lost.
 */
export function endGroupTurn(ctx: DecideContext, actorId: string | null): void {
  if (resolveIfOver(ctx)) return;
  // Over-time effects tick before durations count down (spec §5.5).
  tickOverTime(ctx);
  if (resolveIfOver(ctx)) return;
  emit(ctx, { type: 'RoundEnded', round: ctx.state.round, blocked: actorId });
  if (resolveIfOver(ctx)) return;
  runEnemyPhase(ctx);
}

/**
 * The last player who could act went away while the group's turn waited on nobody in particular —
 * the signal, or the master's question: pause now rather than let the clock run (spec §3.7). A
 * turn waiting on one player keeps its own clock; the pause comes when the next group turn opens.
 */
export function pauseIfNobodyCanAct(ctx: DecideContext): void {
  const { stage } = ctx.state.turn;
  if (ctx.state.result !== null || ctx.state.combatants.some(canAct)) return;
  if (stage === 'awaiting_signal' || stage === 'awaiting_question') {
    emit(ctx, { type: 'BattlePaused', turnToken: nextToken(ctx), reason: 'all_disconnected' });
  }
}
