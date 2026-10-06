/** Investable attributes (spec §4.1). Defense is derived, not investable. */
export const ATTRIBUTES = ['strength', 'dexterity', 'intelligence'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

/** Per-point gains for each investable attribute (spec §4.1). */
export const ATTRIBUTE_GAINS = {
  strength: { health: 4, defense: 2, heavyWeaponDamage: 1.5 },
  dexterity: { health: 2, defense: 1, lightWeaponDamage: 2 },
  intelligence: { energy: 3, skillPower: 2 },
} as const;
