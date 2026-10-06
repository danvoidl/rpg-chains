import { z } from 'zod';
import type { Villain as VillainModel } from '@prisma/client';
import { VillainAttackSchema, type DraftVillain } from '@rpg-chains/shared-types';

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
  };
}
