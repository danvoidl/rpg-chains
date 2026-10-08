/** Investable attributes (spec §4.1). Defense is derived, not investable. */
export const ATTRIBUTES = ['strength', 'dexterity', 'intelligence'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

/**
 * Per-point gains for each investable attribute (spec §4.1). Damage is not a per-point gain: it
 * comes from the scale declared on each weapon and scaling skill (spec §4.1, §4.2).
 */
export const ATTRIBUTE_GAINS = {
  strength: { health: 4, defense: 2 },
  dexterity: { health: 2, defense: 1 },
  intelligence: { energy: 3 },
} as const;
