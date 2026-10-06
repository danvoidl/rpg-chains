import type { Prisma } from '@prisma/client';
import { defaultKitInputs } from '@rpg-chains/campaign-rules';
import { toItemData } from '../mappers/item.js';
import { createClass } from './character-classes.js';

/**
 * Copies the default kit into a campaign (spec §5.1, Fase 1b decision 7): four base weapons, four
 * classes and their skills, all with fresh ids and no link back to the kit.
 */
export async function importDefaultKit(tx: Prisma.TransactionClient, campaignId: string) {
  const created = [];
  for (const entry of defaultKitInputs()) {
    const weapon = await tx.item.create({ data: { campaignId, ...toItemData(entry.weapon) } });
    created.push(await createClass(tx, campaignId, { ...entry.class, baseWeaponId: weapon.id }));
  }
  return created;
}
