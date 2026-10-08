import { effectiveAttribute, rawDamage, weaponRawDamage } from '@rpg-chains/battle-engine';
import type { Combatant, ProfileSheet } from '@rpg-chains/shared-types';
import type { EffectUser } from './describe-effect';

/** A combatant as the user of a skill or item: buffed attributes, live basic attack. */
export function combatantUser(combatant: Combatant): EffectUser {
  return {
    attribute: (name) => effectiveAttribute(combatant, name),
    basicAttack: weaponRawDamage(combatant),
  };
}

/** A character out of battle: invested attributes, the equipped weapon's attack. */
export function sheetUser(sheet: ProfileSheet): EffectUser {
  return {
    attribute: (name) => sheet.attributes[name],
    basicAttack: sheet.attack
      ? rawDamage(
          sheet.attack.baseDamage,
          sheet.attributes[sheet.attack.scalingAttribute],
          sheet.attack.scale,
        )
      : 0,
  };
}
