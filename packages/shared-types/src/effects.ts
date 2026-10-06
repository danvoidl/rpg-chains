import { z } from 'zod';
import { AttributeSchema, ModifiableStatSchema } from './common.js';

/** Possible skill targets (spec §5.3). */
export const TargetSchema = z.enum(['self', 'ally', 'all_allies', 'enemy', 'all_enemies']);
export type Target = z.infer<typeof TargetSchema>;

/**
 * Magnitude of an effect (spec §5.3): a fixed value, a percentage, or `base + attribute × scale`
 * (mirrors the weapon formula, so a scaling skill is not worth 0 at level 1). `percent` is a live
 * multiplier over base+flat, not frozen at cast; on a stat it feeds the percent channel (spec
 * §5.5). What `percent` is a percentage OF, per effect type, is fixed in
 * docs/phase-1b-kit-draft.md.
 */
export const MagnitudeSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), value: z.number() }),
  z.object({ mode: z.literal('percent'), percent: z.number() }),
  z.object({
    mode: z.literal('scaling'),
    base: z.number().default(0),
    attribute: AttributeSchema,
    scale: z.number(),
  }),
]);
export type Magnitude = z.infer<typeof MagnitudeSchema>;
export type MagnitudeMode = Magnitude['mode'];

/** Duration in rounds. `1` for provoke means "the next enemy attack" (spec §3.6). */
const DurationRounds = z.number().int().positive();

/**
 * Catalog of generic effect types (spec §5.4), discriminated by `type`. Authors combine
 * these into named skills. New types can be added without breaking existing campaigns,
 * since each skill references only the type it uses.
 */
export const EffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('damage'), target: TargetSchema, magnitude: MagnitudeSchema }),
  z.object({
    type: z.literal('damage_over_time'),
    target: TargetSchema,
    magnitudePerRound: MagnitudeSchema,
    duration: DurationRounds,
  }),
  z.object({ type: z.literal('heal'), target: TargetSchema, magnitude: MagnitudeSchema }),
  z.object({
    type: z.literal('heal_over_time'),
    target: TargetSchema,
    magnitudePerRound: MagnitudeSchema,
    duration: DurationRounds,
  }),
  z.object({
    type: z.literal('revive'),
    target: TargetSchema,
    healthPercent: z.number().positive(),
  }),
  z.object({ type: z.literal('restore_energy'), target: TargetSchema, magnitude: MagnitudeSchema }),
  z.object({ type: z.literal('provoke'), duration: DurationRounds }),
  z.object({
    type: z.literal('shield'),
    target: TargetSchema,
    magnitude: MagnitudeSchema,
    duration: DurationRounds,
  }),
  z.object({
    type: z.literal('buff_attribute'),
    target: TargetSchema,
    attribute: ModifiableStatSchema,
    magnitude: MagnitudeSchema,
    duration: DurationRounds,
  }),
  z.object({
    type: z.literal('debuff_attribute'),
    target: TargetSchema,
    attribute: ModifiableStatSchema,
    magnitude: MagnitudeSchema,
    duration: DurationRounds,
  }),
  z.object({
    type: z.literal('max_hp_reduction'),
    target: TargetSchema,
    magnitude: MagnitudeSchema,
    duration: DurationRounds,
  }),
  z.object({ type: z.literal('stun'), target: TargetSchema, duration: DurationRounds }),
  z.object({
    type: z.literal('dispel'),
    target: TargetSchema,
    amount: z.number().int().positive(),
    removes: z.enum(['buffs', 'debuffs']),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;
export type EffectType = Effect['type'];

/** Effect types that modify a stat — entries coexist and are summed by signed total, not deduped (decision 7, spec §5.5). */
export const ATTRIBUTE_EFFECT_TYPES = ['buff_attribute', 'debuff_attribute'] as const;
