import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { equipItem, unequipSlot, useOutOfBattle } from '@rpg-chains/battle-engine';
import {
  EquipInputSchema,
  UnequipInputSchema,
  UseItemInputSchema,
  type ProfileSheet,
} from '@rpg-chains/shared-types';
import { toProfileSheet } from '../mappers/profile-sheet.js';
import { attributesOf, classOf, gearOf, holderOf } from '../mappers/profile-state.js';
import { lockOwnedProfile, type OwnedProfile } from '../services/owned-profile.js';

type Outcome = { error: number; code: string } | { error: null; sheet: ProfileSheet };

/**
 * What a player does with their own items, out of battle and without a vote (spec §6, Fase 4 plan
 * decisions 12–13): equip, unequip and use a consumable. Each runs under the room lock on the
 * caller's own profile and answers the updated sheet.
 */
export default async function profileItemsRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate];

  /** Runs `change` on the caller's profile in one transaction and replies the result. */
  function ownProfileRoute<T>(
    path: string,
    parse: (body: unknown) => T,
    change: (owned: OwnedProfile, input: T, tx: Prisma.TransactionClient) => Promise<Outcome>,
  ) {
    app.post<{ Params: { roomId: string } }>(path, { preHandler }, async (request, reply) => {
      const userId = request.user!.id;
      const { roomId } = request.params;
      const input = parse(request.body);
      const outcome = await app.prisma.$transaction(async (tx): Promise<Outcome> => {
        const owned = await lockOwnedProfile(tx, app.battles, roomId, userId);
        if ('error' in owned) return owned;
        return change(owned, input, tx);
      });
      if (outcome.error !== null) return reply.code(outcome.error).send({ error: outcome.code });
      app.roomEvents.changed(roomId);
      return outcome.sheet;
    });
  }

  ownProfileRoute(
    '/profile/equip',
    (b) => EquipInputSchema.parse(b),
    async (owned, input, tx) => {
      const { profile, snapshot } = owned;
      const item = snapshot.items.find((i) => i.id === input.itemId);
      if (!item) return { error: 404, code: 'not_in_inventory' };
      const gear = equipItem(gearOf(profile), item, attributesOf(profile));
      if ('ok' in gear) return { error: 422, code: gear.reason };
      const updated = await tx.campaignProfile.update({ where: { id: profile.id }, data: gear });
      return { error: null, sheet: toProfileSheet(updated, snapshot) };
    },
  );

  ownProfileRoute(
    '/profile/unequip',
    (b) => UnequipInputSchema.parse(b),
    async ({ profile, snapshot }, input, tx) => {
      const gear = unequipSlot(gearOf(profile), input.slot);
      if ('ok' in gear) return { error: 422, code: gear.reason };
      const updated = await tx.campaignProfile.update({ where: { id: profile.id }, data: gear });
      return { error: null, sheet: toProfileSheet(updated, snapshot) };
    },
  );

  ownProfileRoute(
    '/profile/use',
    (b) => UseItemInputSchema.parse(b),
    async (owned, input, tx) => {
      const { room, profile, snapshot } = owned;
      const { inventory } = gearOf(profile);
      const index = inventory.indexOf(input.itemId);
      const item = snapshot.items.find((i) => i.id === input.itemId);
      if (index === -1 || !item) return { error: 422, code: 'not_in_inventory' };
      if (item.category !== 'consumable') return { error: 422, code: 'not_consumable' };

      // Heal and energy go to the owner; a revive lifts the profile it names (decision 13).
      const targetId = item.effect.type === 'revive' ? input.targetProfileId : profile.id;
      const target = room.profiles.find((p) => p.id === targetId);
      if (!target) return { error: 422, code: 'invalid_target' };
      if (app.battles.battleOf(target.id)) return { error: 409, code: 'target_in_battle' };

      const resources = useOutOfBattle(
        item.effect,
        holderOf(profile, classOf(snapshot, profile)),
        holderOf(target, classOf(snapshot, target)),
      );
      if ('ok' in resources) return { error: 422, code: resources.reason };
      inventory.splice(index, 1);
      await tx.campaignProfile.update({ where: { id: target.id }, data: resources });
      const updated = await tx.campaignProfile.update({
        where: { id: profile.id },
        data: { inventory },
      });
      return { error: null, sheet: toProfileSheet(updated, snapshot) };
    },
  );
}
