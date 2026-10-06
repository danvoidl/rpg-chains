import { Prisma, type Item as ItemModel } from '@prisma/client';
import { ItemSchema, type Item, type ItemInput } from '@rpg-chains/shared-types';

/** Maps a database item row to the snapshot-shaped Item (items are fully validated on write). */
export function toItem(row: ItemModel): Item {
  return ItemSchema.parse(
    row.category === 'consumable'
      ? { category: row.category, id: row.id, name: row.name, effect: row.effect }
      : {
          category: row.category,
          id: row.id,
          name: row.name,
          slot: row.slot,
          requirements: row.requirements,
          defenseBonus: row.defenseBonus,
          weapon: row.weapon ?? undefined,
        },
  );
}

/** Row fields (without `campaignId`) for an item write; unused jsonb columns are cleared. */
export function toItemData(input: ItemInput) {
  return input.category === 'consumable'
    ? {
        category: input.category,
        name: input.name,
        slot: null,
        requirements: {},
        defenseBonus: 0,
        weapon: Prisma.DbNull,
        effect: input.effect as Prisma.InputJsonValue,
      }
    : {
        category: input.category,
        name: input.name,
        slot: input.slot,
        requirements: input.requirements as Prisma.InputJsonValue,
        defenseBonus: input.defenseBonus,
        weapon: input.weapon ? (input.weapon as Prisma.InputJsonValue) : Prisma.DbNull,
        effect: Prisma.DbNull,
      };
}
