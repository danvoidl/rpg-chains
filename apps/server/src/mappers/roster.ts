import type { CampaignProfile as ProfileRow } from '@prisma/client';
import type { RosterEntry } from '@rpg-chains/battle-engine';
import { CampaignProfileSchema } from '@rpg-chains/shared-types';

const { equipment: EquipmentJson, inventory: InventoryJson } = CampaignProfileSchema.shape;

/** A Campaign Profile as the engine's roster entry; the inventory's item ids become stacks. */
export function toRosterEntry(profile: ProfileRow & { user: { name: string } }): RosterEntry {
  const stacks = new Map<string, number>();
  for (const itemId of InventoryJson.parse(profile.inventory)) {
    stacks.set(itemId, (stacks.get(itemId) ?? 0) + 1);
  }
  return {
    profileId: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    classId: profile.classId,
    level: profile.level,
    attributes: {
      strength: profile.strength,
      dexterity: profile.dexterity,
      intelligence: profile.intelligence,
    },
    currentHp: profile.currentHp,
    currentEnergy: profile.currentEnergy,
    downed: profile.downed,
    equipment: EquipmentJson.parse(profile.equipment),
    inventory: [...stacks].map(([itemId, quantity]) => ({ itemId, quantity })),
  };
}
