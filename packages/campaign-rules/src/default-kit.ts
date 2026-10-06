import { DEFAULT_CLASS_KIT } from '@rpg-chains/game-config';
import {
  ClassInputSchema,
  ItemInputSchema,
  type ClassInput,
  type ItemInput,
} from '@rpg-chains/shared-types';

/** One default-kit class as write payloads: its base weapon, and the class pointing to it. */
export interface DefaultKitEntry {
  key: string;
  weapon: ItemInput;
  class: Omit<ClassInput, 'baseWeaponId'>;
}

/**
 * The default kit (spec §4.3, §5.1) parsed into authoring write payloads, ready to be COPIED into
 * a campaign with fresh ids. Throws if a kit literal in `game-config` drifts from the schemas.
 */
export function defaultKitInputs(): DefaultKitEntry[] {
  return DEFAULT_CLASS_KIT.map(({ key, baseWeapon, skills, ...cls }) => ({
    key,
    weapon: ItemInputSchema.parse({
      category: 'equipment',
      name: baseWeapon.name,
      slot: 'weapon',
      weapon: {
        weaponType: baseWeapon.weaponType,
        baseDamage: baseWeapon.baseDamage,
        scalingAttribute: baseWeapon.scalingAttribute,
        scale: baseWeapon.scale,
      },
    }),
    class: ClassInputSchema.omit({ baseWeaponId: true }).parse({ ...cls, skills }),
  }));
}
