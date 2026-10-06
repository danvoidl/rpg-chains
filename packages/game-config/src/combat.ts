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
