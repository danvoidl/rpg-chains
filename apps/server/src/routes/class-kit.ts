import type { FastifyInstance } from 'fastify';
import { defaultKitInputs } from '@rpg-chains/campaign-rules';
import { toItemData } from '../mappers/item.js';
import { createClass } from '../services/character-classes.js';

/**
 * Imports the default kit by COPY (spec §5.1, Fase 1b decision 7): four base weapons, four
 * classes and their skills, all with fresh ids and no link back to the kit. Importing twice
 * creates two copies.
 */
export default async function classKitRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  app.post<{ Params: { campaignId: string } }>(
    '/import-kit',
    { preHandler },
    async (request, reply) => {
      const { campaignId } = request.params;
      const kit = defaultKitInputs();
      const classes = await app.prisma.$transaction(async (tx) => {
        const created = [];
        for (const entry of kit) {
          const weapon = await tx.item.create({
            data: { campaignId, ...toItemData(entry.weapon) },
          });
          created.push(
            await createClass(tx, campaignId, { ...entry.class, baseWeaponId: weapon.id }),
          );
        }
        return created;
      });
      return reply.code(201).send(classes);
    },
  );
}
