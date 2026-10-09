/** Combat economy config (spec §4.3, §3.6). */

/** Energy restored by a basic attack (spec §4.3). */
export const ENERGY_PER_BASIC_ATTACK = 10;

/** Recommended skill cost/cooldown bands, enforced by the editor (spec §4.3, §5.6). */
export const SKILL_ENERGY_COST_RANGE = { min: 15, max: 40 } as const;
export const SKILL_COOLDOWN_RANGE = { min: 2, max: 5 } as const;

/**
 * Default provoke duration in enemy attacks (spec §3.6). Tunable to 2 rounds if
 * provoke proves weak against long enemy queues.
 */
export const PROVOKE_DEFAULT_DURATION_ATTACKS = 1;

/** Floor of any hit whose raw damage is positive, after defense and shields (spec §4.2). */
export const MIN_DAMAGE = 1;

/**
 * How long each step of the group's turn may take before the turn is lost (spec §3.3, Fase 3 plan
 * decision 8): the platform default, which a room master may adjust within
 * `BATTLE_TIMER_RANGES`. The master's judgement has no limit. Playtest values.
 */
export const BATTLE_TIMERS = {
  /** Nobody taps the signal. */
  signalMs: 20_000,
  /** The signal winner does not answer a multiple-choice question. */
  answerMs: 30_000,
  /** The signal winner does not send an open answer; typing takes longer (spec §3.3). */
  openAnswerMs: 120_000,
  /** A correct answerer does not choose an action. */
  actionMs: 30_000,
} as const;

export type BattleTimerKey = keyof typeof BATTLE_TIMERS;

/**
 * How far a room master may move each turn timer (spec §3.3): short enough that an absent player
 * cannot stall the battle, long enough that the step stays playable.
 */
export const BATTLE_TIMER_RANGES: Record<BattleTimerKey, { minMs: number; maxMs: number }> = {
  signalMs: { minMs: 5_000, maxMs: 120_000 },
  answerMs: { minMs: 10_000, maxMs: 180_000 },
  openAnswerMs: { minMs: 30_000, maxMs: 600_000 },
  actionMs: { minMs: 10_000, maxMs: 120_000 },
};

/**
 * How long a player whose connection dropped mid-battle has to come back before they are out of
 * it for good (spec §7, Fase 6 plan decision 1). The master's presence gets the same grace before
 * the battle falls back to objective questions (spec §3.2). Playtest value.
 */
export const RECONNECT_GRACE_MS = 60_000;

/**
 * How long a request to cancel a running battle waits for every connected participant to join
 * it, when the master is away (spec §7, Fase 6 plan decision 8).
 */
export const CANCEL_REQUEST_TIMEOUT_MS = 30_000;
