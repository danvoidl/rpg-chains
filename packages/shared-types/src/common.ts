import { z } from 'zod';
import { ATTRIBUTES } from '@rpg-chains/game-config';

/** Snapshot schema version — bumped when the published snapshot shape changes (decision 5). */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Opaque string id used across entities. */
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

/** Investable attributes (spec §4.1), sourced from game-config to stay single-sourced. */
export const AttributeSchema = z.enum(ATTRIBUTES);
export type Attribute = z.infer<typeof AttributeSchema>;

/** Values a buff/debuff can target: the three attributes plus derived damage/defense (spec §5.4). */
export const ModifiableStatSchema = z.enum([
  'strength',
  'dexterity',
  'intelligence',
  'damage',
  'defense',
]);
export type ModifiableStat = z.infer<typeof ModifiableStatSchema>;
