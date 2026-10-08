import type { CampaignProfile } from '@prisma/client';
import {
  baseDefense,
  deriveStats,
  rawDamage,
  meetsRequirements,
  usableOutOfBattle,
} from '@rpg-chains/battle-engine';
import { MAX_LEVEL, xpForNextLevel } from '@rpg-chains/game-config';
import type {
  CampaignSnapshot,
  InvestedAttributes,
  ProfileSheet,
  SheetItem,
} from '@rpg-chains/shared-types';
import { attributesOf, classOf, gearOf } from './profile-state.js';

/** Item ids (repeats = units) as sheet entries, stacked in first-seen order. */
function sheetItems(
  snapshot: CampaignSnapshot,
  itemIds: readonly string[],
  attributes: InvestedAttributes,
): SheetItem[] {
  const stacks = new Map<string, number>();
  for (const id of itemIds) stacks.set(id, (stacks.get(id) ?? 0) + 1);
  return [...stacks].flatMap(([itemId, quantity]) => {
    const item = snapshot.items.find((i) => i.id === itemId);
    if (!item) return [];
    return [
      {
        itemId,
        name: item.name,
        category: item.category,
        slot: item.category === 'equipment' ? item.slot : null,
        quantity,
        requirements: item.category === 'equipment' ? item.requirements : {},
        meetsRequirements: meetsRequirements(item, attributes),
        effectType: item.category === 'consumable' ? item.effect.type : null,
        usableOutOfBattle: item.category === 'consumable' && usableOutOfBattle(item.effect),
      },
    ];
  });
}

/** A profile row as its owner's sheet, read against the room's current snapshot. */
export function toProfileSheet(row: CampaignProfile, snapshot: CampaignSnapshot): ProfileSheet {
  const cls = classOf(snapshot, row);
  const attributes = attributesOf(row);
  const { equipment, inventory } = gearOf(row);
  const equipped = Object.values(equipment).filter((id): id is string => id !== undefined);
  const equipmentDefense = equipped.reduce((sum, id) => {
    const item = snapshot.items.find((i) => i.id === id);
    return sum + (item?.category === 'equipment' ? item.defenseBonus : 0);
  }, 0);
  const { maxHp, maxEnergy } = deriveStats(cls, row.level, attributes);
  const weapon = snapshot.items.find((i) => i.id === equipment.weapon);
  const attack =
    weapon?.category === 'equipment' && weapon.weapon
      ? {
          weaponName: weapon.name,
          damage: rawDamage(
            weapon.weapon.baseDamage,
            attributes[weapon.weapon.scalingAttribute],
            weapon.weapon.scale,
          ),
          baseDamage: weapon.weapon.baseDamage,
          scalingAttribute: weapon.weapon.scalingAttribute,
          scale: weapon.weapon.scale,
        }
      : null;

  return {
    profileId: row.id,
    classId: cls.id,
    className: cls.name,
    level: row.level,
    xp: row.xp,
    xpToNextLevel: row.level >= MAX_LEVEL ? null : xpForNextLevel(row.level),
    availablePoints: row.availablePoints,
    gold: row.gold,
    attributes,
    currentHp: row.currentHp,
    maxHp,
    currentEnergy: row.currentEnergy,
    maxEnergy,
    defense: baseDefense(equipmentDefense, attributes),
    attack,
    downed: row.downed,
    equipment: sheetItems(snapshot, equipped, attributes),
    inventory: sheetItems(snapshot, inventory, attributes),
    skills: cls.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      text: skill.text,
      energyCost: skill.energyCost,
      cooldownRounds: skill.cooldownRounds,
      unlockLevel: skill.unlockLevel,
      effect: skill.effect,
      unlocked: skill.unlockLevel <= row.level,
    })),
  };
}
