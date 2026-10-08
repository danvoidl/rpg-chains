import type { BattleClock, SystemCommand, Turn } from '@rpg-chains/shared-types';
import type { BattleListener, BattleRegistry, RunningBattle } from './battle-registry.js';

export interface BattleTimerConfig {
  signalMs: number;
  answerMs: number;
  openAnswerMs: number;
  actionMs: number;
}

type Timeout = Extract<SystemCommand, { turnToken: number }>['type'];

/** The clock of a stage that waits on a player; none for the master or a pause (decision 2). */
export function timeoutOf(turn: Turn): { command: Timeout; key: keyof BattleTimerConfig } | null {
  switch (turn.stage) {
    case 'awaiting_signal':
      return { command: 'SignalExpired', key: 'signalMs' };
    case 'awaiting_answer':
      // An open answer is typed, so it gets longer (spec §3.3).
      return {
        command: 'AnswerTimedOut',
        key: turn.question.type === 'open' ? 'openAnswerMs' : 'answerMs',
      };
    case 'awaiting_action':
      return { command: 'ActionTimedOut', key: 'actionMs' };
    default:
      return null;
  }
}

/**
 * Turn timers (Fase 3 plan decision 8): the server keeps the clock, the engine keeps the rule.
 * Each stage that waits on a player gets one timer carrying the stage's `turnToken`; when it
 * fires it goes through the registry like any command, so if the player acted first the timeout
 * is simply `stale_turn_token`. The master's judgement never expires (decision 2).
 */
export class BattleTimers implements BattleListener {
  private readonly pending = new Map<
    string,
    { token: number; handle: NodeJS.Timeout; startedAt: number; durationMs: number }
  >();

  constructor(
    private readonly registry: BattleRegistry,
    private readonly config: BattleTimerConfig,
  ) {
    registry.subscribe(this);
  }

  appended(battle: RunningBattle): void {
    const { battleId, state } = battle;
    const current = this.pending.get(battleId);
    // Events that keep the stage (a player leaving off-turn) keep its clock running.
    if (current?.token === state.turnToken) return;
    this.clear(battleId);

    const timeout = state.result === null ? timeoutOf(state.turn) : null;
    if (!timeout) return;
    const token = state.turnToken;
    // The room master's adjustment wins over the platform default (spec §3.3).
    const durationMs = battle.turnTimers[timeout.key] ?? this.config[timeout.key];
    const handle = setTimeout(() => {
      this.pending.delete(battleId);
      this.registry.apply(battleId, { type: timeout.command, turnToken: token });
    }, durationMs);
    this.pending.set(battleId, { token, handle, startedAt: Date.now(), durationMs });
  }

  /** What is left of the battle's current stage clock, for clients to show (spec §3.3). */
  clockOf(battleId: string): BattleClock | null {
    const current = this.pending.get(battleId);
    if (!current) return null;
    const elapsed = Date.now() - current.startedAt;
    return {
      turnToken: current.token,
      durationMs: current.durationMs,
      remainingMs: Math.max(0, current.durationMs - elapsed),
    };
  }

  removed(battle: { battleId: string }): void {
    this.clear(battle.battleId);
  }

  /** Stops every clock (server shutdown). */
  clearAll(): void {
    for (const battleId of [...this.pending.keys()]) this.clear(battleId);
  }

  private clear(battleId: string): void {
    const current = this.pending.get(battleId);
    if (current) clearTimeout(current.handle);
    this.pending.delete(battleId);
  }
}
