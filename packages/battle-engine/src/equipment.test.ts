import { describe, expect, it } from 'vitest';
import type { Item } from '@rpg-chains/shared-types';
import { equipItem, unequipSlot, type Gear } from './equipment.js';

const sword: Item = {
  category: 'equipment',
  id: 'it-sword',
  name: 'Sword',
  slot: 'weapon',
  price: 0,
  requirements: {},
  defenseBonus: 0,
  weapon: { weaponType: 'light', baseDamage: 10, scalingAttribute: 'dexterity', scale: 2 },
};
const hammer: Item = { ...sword, id: 'it-hammer', name: 'Hammer', requirements: { strength: 3 } };
const helmet: Item = {
  category: 'equipment',
  id: 'it-helmet',
  name: 'Helmet',
  slot: 'helmet',
  price: 30,
  requirements: {},
  defenseBonus: 4,
};
const potion: Item = {
  category: 'consumable',
  id: 'it-potion',
  name: 'Potion',
  price: 15,
  effect: { type: 'heal', target: 'self', magnitude: { mode: 'fixed', value: 30 } },
};

const weak = { strength: 0, dexterity: 0, intelligence: 0 };
const strong = { strength: 3, dexterity: 0, intelligence: 0 };
const gear: Gear = {
  equipment: { weapon: 'it-sword' },
  inventory: ['it-helmet', 'it-hammer', 'it-potion', 'it-helmet'],
};

describe('equipItem (Fase 4 plan decision 12)', () => {
  it('moves one unit from the inventory into its slot', () => {
    expect(equipItem(gear, helmet, weak)).toEqual({
      equipment: { weapon: 'it-sword', helmet: 'it-helmet' },
      inventory: ['it-hammer', 'it-potion', 'it-helmet'],
    });
  });

  it('swaps: the item in the slot goes back to the inventory', () => {
    expect(equipItem(gear, hammer, strong)).toEqual({
      equipment: { weapon: 'it-hammer' },
      inventory: ['it-helmet', 'it-potion', 'it-helmet', 'it-sword'],
    });
  });

  it('refuses unmet requirements, consumables and items not held', () => {
    expect(equipItem(gear, hammer, weak)).toEqual({ ok: false, reason: 'requirements_not_met' });
    expect(equipItem(gear, potion, weak)).toEqual({ ok: false, reason: 'not_equipment' });
    expect(equipItem({ ...gear, inventory: [] }, helmet, weak)).toEqual({
      ok: false,
      reason: 'not_in_inventory',
    });
  });
});

describe('unequipSlot', () => {
  it('takes the item back to the inventory', () => {
    const worn = { equipment: { weapon: 'it-sword', helmet: 'it-helmet' }, inventory: [] };
    expect(unequipSlot(worn, 'helmet')).toEqual({
      equipment: { weapon: 'it-sword' },
      inventory: ['it-helmet'],
    });
  });

  it('never empties the weapon slot, and refuses an empty slot', () => {
    expect(unequipSlot(gear, 'weapon')).toEqual({ ok: false, reason: 'weapon_required' });
    expect(unequipSlot(gear, 'boots')).toEqual({ ok: false, reason: 'slot_empty' });
  });
});
