import type { CampaignProfile } from '@prisma/client';
import type { Gear, Holder, Progress } from '@rpg-chains/battle-engine';
import {
  CampaignProfileSchema,
  type CharacterClass,
  type InvestedAttributes,
} from '@rpg-chains/shared-types';

const { equipment: EquipmentJson, inventory: InventoryJson } = CampaignProfileSchema.shape;

/** A profile row as the engine's pure progression and gear functions read it. */

export function attributesOf(row: CampaignProfile): InvestedAttributes {
  return { strength: row.strength, dexterity: row.dexterity, intelligence: row.intelligence };
}

export function progressOf(row: CampaignProfile): Progress {
  return {
    level: row.level,
    xp: row.xp,
    availablePoints: row.availablePoints,
    attributes: attributesOf(row),
    currentHp: row.currentHp,
    currentEnergy: row.currentEnergy,
    downed: row.downed,
  };
}

export function gearOf(row: CampaignProfile): Gear {
  return {
    equipment: EquipmentJson.parse(row.equipment),
    inventory: InventoryJson.parse(row.inventory),
  };
}

export function holderOf(row: CampaignProfile, cls: Holder['cls']): Holder {
  return {
    cls,
    level: row.level,
    attributes: attributesOf(row),
    currentHp: row.currentHp,
    currentEnergy: row.currentEnergy,
    downed: row.downed,
  };
}

/** The class of a profile in the snapshot; the compatibility gate keeps it there. */
export function classOf(snapshot: { classes: CharacterClass[] }, row: CampaignProfile) {
  const cls = snapshot.classes.find((c) => c.id === row.classId);
  if (!cls) throw new Error(`profile ${row.id}: class ${row.classId} is not in the snapshot`);
  return cls;
}
