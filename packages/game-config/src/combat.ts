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
 * decision 8). The master's judgement has no limit. Playtest values.
 */
export const BATTLE_TIMERS = {
  /** Nobody taps the signal. */
  signalMs: 20_000,
  /** The signal winner does not answer. */
  answerMs: 30_000,
  /** A correct answerer does not choose an action. */
  actionMs: 30_000,
} as const;
