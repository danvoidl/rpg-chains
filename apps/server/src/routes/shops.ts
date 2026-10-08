import type { FastifyInstance } from 'fastify';
import { checkNodeEntry, recordNodeCleared } from '@rpg-chains/campaign-rules';
import { BuyInputSchema, type CampaignSnapshot, type ShopView } from '@rpg-chains/shared-types';
import { toProfileSheet } from '../mappers/profile-sheet.js';
import { gearOf } from '../mappers/profile-state.js';
import { lockOwnedProfile } from '../services/owned-profile.js';
import { changeProgress, loadProgress } from '../services/room-progress.js';
import { lockRoom } from '../services/room-lock.js';
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

/** The refusal a shop entry check turns into, or null when the shop is open to the room. */
function refusal(
  code: ReturnType<typeof checkNodeEntry>,
): { error: 404 | 409; code: string } | null {
  if (code === null) return null;
  if (code === 'node_locked') return { error: 409, code: 'node_locked' };
  return { error: 404, code: 'shop_not_found' };
}

/**
 * Shops (spec §6, Fase 4 plan decision 11, Fase 5 plan decisions 1 and 3): a shop node opens once
 * the room has unlocked it, and the first visit clears it for the room (a cleared shop stays
 * open). Each player buys with their own gold — no vote, no stock — at the price of the version
 * current when they buy.
 */
export default async function shopsRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  app.get<{ Params: { roomId: string; nodeId: string } }>(
    '/shops/:nodeId',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId, nodeId } = request.params;

      const outcome = await app.prisma.$transaction(async (tx) => {
        if (!(await lockRoom(tx, roomId))) return { error: 404 as const, code: 'not_a_player' };
        const room = await findRoom(tx, roomId);
        const profile = room?.profiles.find((p) => p.userId === userId);
        if (!room || !profile) return { error: 404 as const, code: 'not_a_player' };
        const { snapshot } = await syncRoomVersion(tx, room, app.battles);
        const progress = await loadProgress(tx, roomId);
        const refused = refusal(checkNodeEntry(snapshot, progress, nodeId, ['shop']));
        if (refused) return refused;
        const view = toShopView(snapshot, nodeId, profile.gold);
        if (!view) return { error: 404 as const, code: 'shop_not_found' };
        // The first visit clears the shop for the room; the first visitor keeps the credit.
        const firstVisit = !progress.clears.some((c) => c.nodeId === nodeId);
        if (firstVisit) {
          await changeProgress(tx, room, snapshot, (p) =>
            recordNodeCleared(snapshot, p, nodeId, [profile.id]),
          );
        }
        return { error: null, view, firstVisit };
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      if (outcome.firstVisit) app.roomEvents.changed(roomId);
      return outcome.view;
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
        const refused = refusal(
          checkNodeEntry(snapshot, await loadProgress(tx, roomId), nodeId, ['shop']),
        );
        if (refused) return refused;
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
