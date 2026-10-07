import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma, Villain as VillainModel } from '@prisma/client';
import {
  VillainAttackSchema,
  VillainDropSchema,
  type DraftVillain,
  type VillainInput,
} from '@rpg-chains/shared-types';

/** Maps a database villain row to the client-facing DraftVillain representation. */
export function toDraftVillain(row: VillainModel): DraftVillain {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl ?? null,
    hp: row.hp,
    strength: row.strength,
    dexterity: row.dexterity,
    intelligence: row.intelligence,
    defense: row.defense,
    attacks: z.array(VillainAttackSchema).parse(row.attacks),
    xpReward: row.xpReward,
    goldReward: row.goldReward,
    drops: z.array(VillainDropSchema).parse(row.drops),
  };
}

/**
 * Row fields (without `campaignId`) for a villain write. Attacks keep their ids and new ones get
 * one, so the compatibility gate can compare versions by id.
 */
export function toVillainData(input: VillainInput) {
  const attacks = (input.attacks ?? []).map((attack) => ({
    ...attack,
    id: attack.id ?? randomUUID(),
  }));
  return {
    name: input.name,
    imageUrl: input.imageUrl ?? null,
    hp: input.hp,
    strength: input.strength,
    dexterity: input.dexterity,
    intelligence: input.intelligence,
    defense: input.defense,
    attacks: attacks as Prisma.InputJsonValue,
    xpReward: input.xpReward ?? 0,
    goldReward: input.goldReward ?? 0,
    drops: (input.drops ?? []) as Prisma.InputJsonValue,
  };
}
