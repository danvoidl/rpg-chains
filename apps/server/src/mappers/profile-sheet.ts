import type { CampaignProfile } from '@prisma/client';
import { baseDefense, deriveStats } from '@rpg-chains/battle-engine';
import { MAX_LEVEL, xpForNextLevel } from '@rpg-chains/game-config';
import {
  CampaignProfileSchema,
  type CampaignSnapshot,
  type ProfileSheet,
  type SheetItem,
} from '@rpg-chains/shared-types';

const { equipment: EquipmentJson, inventory: InventoryJson } = CampaignProfileSchema.shape;

/** Item ids (repeats = units) as sheet entries, stacked in first-seen order. */
function sheetItems(snapshot: CampaignSnapshot, itemIds: readonly string[]): SheetItem[] {
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
      },
    ];
  });
}

/** A profile row as its owner's sheet, read against the room's current snapshot. */
export function toProfileSheet(row: CampaignProfile, snapshot: CampaignSnapshot): ProfileSheet {
  const cls = snapshot.classes.find((c) => c.id === row.classId);
  if (!cls) throw new Error(`profile ${row.id}: class ${row.classId} is not in the snapshot`);
  const attributes = {
    strength: row.strength,
    dexterity: row.dexterity,
    intelligence: row.intelligence,
  };
  const equipped = Object.values(EquipmentJson.parse(row.equipment)).filter(
    (id): id is string => id !== undefined,
  );
  const equipmentDefense = equipped.reduce((sum, id) => {
    const item = snapshot.items.find((i) => i.id === id);
    return sum + (item?.category === 'equipment' ? item.defenseBonus : 0);
  }, 0);
  const { maxHp, maxEnergy } = deriveStats(cls, row.level, attributes);

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
    downed: row.downed,
    equipment: sheetItems(snapshot, equipped),
    inventory: sheetItems(snapshot, InventoryJson.parse(row.inventory)),
    skills: cls.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      unlockLevel: skill.unlockLevel,
      unlocked: skill.unlockLevel <= row.level,
    })),
  };
}
