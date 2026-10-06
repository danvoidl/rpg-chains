import { z } from 'zod';
import { IdSchema, ModifiableStatSchema } from './common.js';

/**
 * Deterministic PRNG state, threaded through the folded battle state (decision 3). The
 * engine advances `cursor`; replaying from the same seed reproduces every roll exactly.
 */
export const PrngStateSchema = z.object({
  seed: z.number().int(),
  cursor: z.number().int().nonnegative(),
});
export type PrngState = z.infer<typeof PrngStateSchema>;

/**
 * An effect currently active on a combatant. Stacking has two policies (decision 7, spec §5.5):
 * attribute modifiers coexist and are summed by signed total at read time; every other
 * persistent effect replaces and resets duration per (type).
 *
 * Fase 3 note: to support percent attribute modifiers (live multiplier over base+flat), this
 * schema still needs a flat/percent discriminator — the flat channel resolves to `value`, the
 * percent channel carries the fraction. Kept single-`value` until the engine consumes it.
 */
export const ActiveEffectSchema = z.object({
  type: z.string(),
  attribute: ModifiableStatSchema.optional(),
  /** Resolved flat magnitude; a fixed/scaling source is computed from attributes at cast. */
  value: z.number(),
  roundsRemaining: z.number().int().nonnegative(),
});
export type ActiveEffect = z.infer<typeof ActiveEffectSchema>;

/** A player character participating in a battle. */
export const CombatantSchema = z.object({
  profileId: IdSchema,
  currentHp: z.number(),
  maxHp: z.number().positive(),
  currentEnergy: z.number().nonnegative(),
  maxEnergy: z.number().nonnegative(),
  defense: z.number().nonnegative(),
  downed: z.boolean(),
  /** Blocked from the signal next round after acting (bell rotation, spec §3.3). */
  blockedFromSignal: z.boolean(),
  effects: z.array(ActiveEffectSchema),
  cooldowns: z.record(z.string(), z.number().int().nonnegative()),
});
export type Combatant = z.infer<typeof CombatantSchema>;

/** A villain instance in a battle (multiple copies of the same villain get distinct ids). */
export const EnemySchema = z.object({
  instanceId: IdSchema,
  villainId: IdSchema,
  currentHp: z.number(),
  maxHp: z.number().positive(),
  effects: z.array(ActiveEffectSchema),
  attackCooldowns: z.record(z.string(), z.number().int().nonnegative()),
});
export type Enemy = z.infer<typeof EnemySchema>;

export const ActiveSideSchema = z.discriminatedUnion('side', [
  z.object({ side: z.literal('group') }),
  z.object({ side: z.literal('enemy'), instanceId: IdSchema }),
]);
export type ActiveSide = z.infer<typeof ActiveSideSchema>;

/** Authoritative in-memory state of one battle (spec §2.1 "Batalha Ativa", decision 4). */
export const BattleStateSchema = z.object({
  battleId: IdSchema,
  prng: PrngStateSchema,
  round: z.number().int().nonnegative(),
  /** Whose turn it is; enemies alternate with the group (spec §3.1). */
  activeSide: ActiveSideSchema,
  /** Circular queue of enemy instance ids (spec §3.1). */
  enemyQueue: z.array(IdSchema),
  /** Rejects stale/duplicate commands from a past turn (decision 2). */
  turnToken: z.number().int().nonnegative(),
  combatants: z.array(CombatantSchema),
  enemies: z.array(EnemySchema),
  signal: z.object({ questionId: IdSchema, winnerId: IdSchema.nullable() }).nullable(),
  result: z.enum(['victory', 'defeat']).nullable(),
});
export type BattleState = z.infer<typeof BattleStateSchema>;
