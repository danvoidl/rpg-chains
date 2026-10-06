import { z } from 'zod';
import { IdSchema, ModifiableStatSchema } from './common.js';

/**
 * An effect currently active on a combatant or enemy, discriminated by `kind` (spec §5.4–5.5).
 * Numbers are resolved when the effect is applied, so folding an event log never needs campaign
 * content — except stat modifiers in the percent channel, which stay live multipliers read at use
 * time (spec §5.3). Every entry has an `id` so a single application can expire or be dispelled.
 *
 * Duration units (spec §5.5 "Relógio dos efeitos"): `rounds` = group rounds; `turns` = the
 * stunned enemy's own turns; `attacks` = enemy attacks redirected by provoke.
 */
const base = {
  /** Unique within the battle; assigned by `decide`. */
  id: IdSchema,
  /** Who applied it: a profile id or an enemy instance id. */
  sourceId: IdSchema,
};

/**
 * Buff/debuff entry. Entries coexist and are summed by signed total at read time (spec §5.5).
 * `value` is positive; `polarity` gives the sign. Percent channel values are percentage points
 * (`20` = 20%), like `MagnitudeSchema`.
 */
export const StatModifierEffectSchema = z.object({
  ...base,
  kind: z.literal('stat_modifier'),
  polarity: z.enum(['buff', 'debuff']),
  stat: ModifiableStatSchema,
  channel: z.enum(['flat', 'percent']),
  value: z.number().nonnegative(),
  rounds: z.number().int().positive(),
});

export const ActiveEffectSchema = z.discriminatedUnion('kind', [
  StatModifierEffectSchema,
  z.object({
    ...base,
    kind: z.literal('damage_over_time'),
    perRound: z.number().nonnegative(),
    rounds: z.number().int().positive(),
  }),
  z.object({
    ...base,
    kind: z.literal('heal_over_time'),
    perRound: z.number().nonnegative(),
    rounds: z.number().int().positive(),
  }),
  z.object({
    ...base,
    kind: z.literal('shield'),
    remaining: z.number().nonnegative(),
    rounds: z.number().int().positive(),
  }),
  z.object({ ...base, kind: z.literal('provoke'), attacks: z.number().int().positive() }),
  z.object({ ...base, kind: z.literal('stun'), turns: z.number().int().positive() }),
  z.object({
    ...base,
    kind: z.literal('max_hp_reduction'),
    amount: z.number().nonnegative(),
    rounds: z.number().int().positive(),
  }),
]);
export type ActiveEffect = z.infer<typeof ActiveEffectSchema>;
export type ActiveEffectKind = ActiveEffect['kind'];
export type StatModifierEffect = z.infer<typeof StatModifierEffectSchema>;
