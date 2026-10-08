import type {
  CampaignProfile,
  InvestedAttributes,
  Item,
  Rejection,
  Slot,
} from '@rpg-chains/shared-types';

/** What equipping changes on a profile (spec §6). */
export interface Gear {
  equipment: CampaignProfile['equipment'];
  /** Item ids, one per unit. */
  inventory: string[];
}

/** Whether the attributes meet every requirement of the item (spec §4.1). */
export function meetsRequirements(item: Item, attributes: InvestedAttributes): boolean {
  if (item.category !== 'equipment') return false;
  return (
    Object.entries(item.requirements) as [keyof InvestedAttributes, number | undefined][]
  ).every(([attribute, minimum]) => minimum === undefined || attributes[attribute] >= minimum);
}

/**
 * Equips one unit of an inventory item in its slot (Fase 4 plan decision 12); whatever was in the
 * slot goes back to the inventory, so a swap is one step. Only equipment whose requirements the
 * attributes meet.
 */
export function equipItem(
  gear: Gear,
  item: Item,
  attributes: InvestedAttributes,
): Gear | Rejection {
  const index = gear.inventory.indexOf(item.id);
  if (index === -1) return { ok: false, reason: 'not_in_inventory' };
  if (item.category !== 'equipment') return { ok: false, reason: 'not_equipment' };
  if (!meetsRequirements(item, attributes)) return { ok: false, reason: 'requirements_not_met' };

  const inventory = [...gear.inventory];
  inventory.splice(index, 1);
  const previous = gear.equipment[item.slot];
  if (previous) inventory.push(previous);
  return { equipment: { ...gear.equipment, [item.slot]: item.id }, inventory };
}

/**
 * Takes the item in `slot` back to the inventory. The weapon slot only swaps, never empties: the
 * basic attack needs a weapon (Fase 4 plan decision 12).
 */
export function unequipSlot(gear: Gear, slot: Slot): Gear | Rejection {
  if (slot === 'weapon') return { ok: false, reason: 'weapon_required' };
  const current = gear.equipment[slot];
  if (!current) return { ok: false, reason: 'slot_empty' };
  const { [slot]: _removed, ...equipment } = gear.equipment;
  return { equipment, inventory: [...gear.inventory, current] };
}
