import type { FastifyInstance } from 'fastify';
import { BuyInputSchema, type CampaignSnapshot, type ShopView } from '@rpg-chains/shared-types';
import { toProfileSheet } from '../mappers/profile-sheet.js';
import { gearOf } from '../mappers/profile-state.js';
import { lockOwnedProfile } from '../services/owned-profile.js';
import { findRoom } from '../services/room-query.js';
import { syncRoomVersion } from '../services/room-version.js';

/** The shop node of the snapshot, or null. */
function shopNode(snapshot: CampaignSnapshot, nodeId: string) {
  const node = snapshot.chapters.flatMap((c) => c.nodes).find((n) => n.id === nodeId);
  return node?.type === 'shop' ? node : null;
}

/** A shop's wares at the version's prices, with the viewer's own gold. */
function toShopView(snapshot: CampaignSnapshot, nodeId: string, gold: number): ShopView | null {
  const node = shopNode(snapshot, nodeId);
  if (!node) return null;
  return {
    nodeId,
    title: node.title,
    gold,
    items: node.itemIds.flatMap((id) => {
      const item = snapshot.items.find((i) => i.id === id);
      if (!item) return [];
      const equipment = item.category === 'equipment';
      return [
        {
          itemId: item.id,
          name: item.name,
          category: item.category,
          slot: equipment ? item.slot : null,
          price: item.price,
          requirements: equipment ? item.requirements : {},
          defenseBonus: equipment ? item.defenseBonus : 0,
        },
      ];
    }),
  };
}

/**
 * Shops (spec §6, Fase 4 plan decision 11): any shop node of the room's version (provisional until
 * Fase 5 says where the group is). Each player buys with their own gold — no vote, no stock — at
 * the price of the version current when they buy.
 */
export default async function shopsRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  app.get<{ Params: { roomId: string; nodeId: string } }>(
    '/shops/:nodeId',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const room = await findRoom(app.prisma, request.params.roomId);
      const profile = room?.profiles.find((p) => p.userId === userId);
      if (!room || !profile) return reply.code(404).send({ error: 'not_a_player' });
      const { snapshot } = await syncRoomVersion(app.prisma, room, app.battles);
      const view = toShopView(snapshot, request.params.nodeId, profile.gold);
      return view ?? reply.code(404).send({ error: 'shop_not_found' });
    },
  );

  app.post<{ Params: { roomId: string; nodeId: string } }>(
    '/shops/:nodeId/buy',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId, nodeId } = request.params;
      const { itemId, quantity } = BuyInputSchema.parse(request.body);

      const outcome = await app.prisma.$transaction(async (tx) => {
        const owned = await lockOwnedProfile(tx, app.battles, roomId, userId);
        if ('error' in owned) return owned;
        const { profile, snapshot } = owned;
        const node = shopNode(snapshot, nodeId);
        if (!node) return { error: 404, code: 'shop_not_found' };
        const item = snapshot.items.find((i) => i.id === itemId);
        if (!item || !node.itemIds.includes(itemId)) return { error: 422, code: 'not_sold_here' };
        // The gold is read under the lock, so two purchases can never spend it twice.
        const cost = item.price * quantity;
        if (cost > profile.gold) return { error: 409, code: 'insufficient_gold' };

        const { inventory } = gearOf(profile);
        const updated = await tx.campaignProfile.update({
          where: { id: profile.id },
          data: {
            gold: profile.gold - cost,
            inventory: [...inventory, ...Array.from({ length: quantity }, () => itemId)],
          },
        });
        return { error: null, sheet: toProfileSheet(updated, snapshot) };
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      return outcome.sheet;
    },
  );
}
