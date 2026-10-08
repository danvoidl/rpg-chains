import type { FastifyInstance } from 'fastify';
import { applyTrade, covers } from '@rpg-chains/battle-engine';
import {
  ProposeTradeInputSchema,
  type CampaignSnapshot,
  type MemberInventory,
  type TradeOfferView,
  type TradeSide,
} from '@rpg-chains/shared-types';
import { gearOf } from '../mappers/profile-state.js';
import { lockOwnedProfile } from '../services/owned-profile.js';
import { findRoom, type RoomWithRelations } from '../services/room-query.js';
import { syncRoomVersion } from '../services/room-version.js';
import type { TradeOffer } from '../services/trade-offers.js';

/** Item ids (one per unit) stacked with their names from the snapshot. */
function stack(snapshot: CampaignSnapshot, itemIds: readonly string[]): MemberInventory {
  const counts = new Map<string, number>();
  for (const id of itemIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([itemId, quantity]) => ({
    itemId,
    name: snapshot.items.find((i) => i.id === itemId)?.name ?? itemId,
    quantity,
  }));
}

function toOfferView(
  offer: TradeOffer,
  room: RoomWithRelations,
  snapshot: CampaignSnapshot,
): TradeOfferView {
  const party = (profileId: string) => ({
    profileId,
    name: room.profiles.find((p) => p.id === profileId)?.user.name ?? '?',
  });
  const side = ({ gold, items }: TradeSide) => ({ gold, items: stack(snapshot, items) });
  return {
    id: offer.id,
    from: party(offer.fromProfileId),
    to: party(offer.toProfileId),
    give: side(offer.give),
    ask: side(offer.ask),
    expiresAt: new Date(offer.expiresAt).toISOString(),
  };
}

/**
 * Trades between players (spec §6, Fase 4 plan decision 9): propose, accept, decline, cancel.
 * Offers live in memory; accepting re-reads both profiles under the room lock and moves
 * everything in one transaction, or nothing. Both players must be out of battle.
 */
export default async function tradesRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];
  type Params = { roomId: string; tradeId: string };

  /** The caller's pending offers, sent and received. */
  app.get<{ Params: { roomId: string } }>('/trades', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const room = await findRoom(app.prisma, request.params.roomId);
    const profile = room?.profiles.find((p) => p.userId === userId);
    if (!room || !profile) return reply.code(404).send({ error: 'not_a_player' });
    const { snapshot } = await syncRoomVersion(app.prisma, room, app.battles);
    return app.trades.involving(profile.id).map((o) => toOfferView(o, room, snapshot));
  });

  /** Another member's inventory, so an offer can ask for their items; gold stays private. */
  app.get<{ Params: { roomId: string; profileId: string } }>(
    '/members/:profileId/inventory',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const room = await findRoom(app.prisma, request.params.roomId);
      const target = room?.profiles.find((p) => p.id === request.params.profileId);
      if (!room || !target || !room.profiles.some((p) => p.userId === userId)) {
        return reply.code(404).send({ error: 'not_a_player' });
      }
      const { snapshot } = await syncRoomVersion(app.prisma, room, app.battles);
      return stack(snapshot, gearOf(target).inventory);
    },
  );

  app.post<{ Params: { roomId: string } }>('/trades', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { roomId } = request.params;
    const { toProfileId, give, ask } = ProposeTradeInputSchema.parse(request.body);

    const outcome = await app.prisma.$transaction(async (tx) => {
      const owned = await lockOwnedProfile(tx, app.battles, roomId, userId);
      if ('error' in owned) return owned;
      const { room, profile } = owned;
      const target = room.profiles.find((p) => p.id === toProfileId);
      if (!target || target.id === profile.id) return { error: 422, code: 'invalid_target' };
      if (app.battles.battleOf(target.id)) return { error: 409, code: 'target_in_battle' };
      if (app.trades.between(profile.id, target.id)) return { error: 409, code: 'trade_pending' };
      // Only what is in the inventory now: an equipped item has to come off first.
      if (!covers({ gold: profile.gold, ...gearOf(profile) }, give)) {
        return { error: 422, code: 'offer_not_covered' };
      }
      app.trades.propose({ roomId, fromProfileId: profile.id, toProfileId, give, ask });
      return { error: null };
    });

    if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
    app.roomEvents.changed(roomId);
    return reply.code(201).send({ ok: true });
  });

  app.post<{ Params: Params }>(
    '/trades/:tradeId/accept',
    { preHandler },
    async (request, reply) => {
      const userId = request.user!.id;
      const { roomId, tradeId } = request.params;

      const outcome = await app.prisma.$transaction(async (tx) => {
        const owned = await lockOwnedProfile(tx, app.battles, roomId, userId);
        if ('error' in owned) return owned;
        const { room, profile } = owned;
        // Read under the lock: two accepts of one offer, or of two offers sharing an item, queue.
        const offer = app.trades.get(tradeId);
        if (!offer || offer.roomId !== roomId || offer.toProfileId !== profile.id) {
          return { error: 404, code: 'trade_not_found' };
        }
        const from = room.profiles.find((p) => p.id === offer.fromProfileId);
        if (!from) return { error: 404, code: 'trade_not_found' };
        if (app.battles.battleOf(from.id)) return { error: 409, code: 'target_in_battle' };

        const traded = applyTrade(
          { gold: from.gold, inventory: gearOf(from).inventory },
          { gold: profile.gold, inventory: gearOf(profile).inventory },
          offer,
        );
        if ('ok' in traded) return { error: 409, code: traded.reason };
        await tx.campaignProfile.update({ where: { id: from.id }, data: traded.from });
        await tx.campaignProfile.update({ where: { id: profile.id }, data: traded.to });
        app.trades.remove(offer.id);
        return { error: null };
      });

      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      app.roomEvents.changed(roomId);
      return { ok: true };
    },
  );

  /** The receiver declines, or the author cancels: either party drops the offer. */
  app.delete<{ Params: Params }>('/trades/:tradeId', { preHandler }, async (request, reply) => {
    const userId = request.user!.id;
    const { roomId, tradeId } = request.params;
    const room = await findRoom(app.prisma, roomId);
    const profile = room?.profiles.find((p) => p.userId === userId);
    const offer = app.trades.get(tradeId);
    const party =
      offer &&
      profile &&
      offer.roomId === roomId &&
      app.trades.involving(profile.id).includes(offer);
    if (!party) return reply.code(404).send({ error: 'trade_not_found' });
    app.trades.remove(tradeId);
    app.roomEvents.changed(roomId);
    return reply.code(204).send();
  });
}
