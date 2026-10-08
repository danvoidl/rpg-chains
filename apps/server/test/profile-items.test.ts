import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import type { BattleSummary, ProfileSheet } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp();
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

interface Table {
  roomId: string;
  ana: TestUser;
  bia: TestUser;
  anaId: string;
  biaId: string;
}

/** Ana and Bia in a room of the battle fixture (knights: 100 HP, 50 energy at level 1). */
async function table(): Promise<Table> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const bia = await signUp(app, 'Bia');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  await chooseClass(app, bia, roomId, 'cl-duo');
  const profiles = await app.prisma.campaignProfile.findMany({ include: { user: true } });
  const idOf = (user: TestUser) => profiles.find((p) => p.userId === user.id)!.id;
  return { roomId, ana, bia, anaId: idOf(ana), biaId: idOf(bia) };
}

function setProfile(id: string, data: Prisma.CampaignProfileUpdateInput) {
  return app.prisma.campaignProfile.update({ where: { id }, data });
}

function act(user: TestUser, roomId: string, action: string, payload: object) {
  return requestAs(app, user, {
    method: 'POST',
    url: `/api/rooms/${roomId}/profile/${action}`,
    payload,
  });
}

describe('equipment (Fase 4 plan decision 12)', () => {
  it('equips from the inventory when the requirements are met, and unequips back', async () => {
    const { roomId, ana, anaId } = await table();
    await setProfile(anaId, { inventory: ['it-helmet'] });

    const weak = await act(ana, roomId, 'equip', { itemId: 'it-helmet' });
    expect(weak.statusCode).toBe(422);
    expect(weak.json()).toEqual({ error: 'requirements_not_met' });

    await setProfile(anaId, { strength: 1 });
    const worn = await act(ana, roomId, 'equip', { itemId: 'it-helmet' });
    expect(worn.statusCode, worn.body).toBe(200);
    const sheet = worn.json<ProfileSheet>();
    // Helmet 4 + strength 1 × 2.
    expect(sheet.defense).toBe(6);
    expect(sheet.equipment.map((i) => i.itemId).sort()).toEqual(['it-helmet', 'it-sword']);
    expect(sheet.inventory).toEqual([]);

    const off = await act(ana, roomId, 'unequip', { slot: 'helmet' });
    expect(off.json<ProfileSheet>().inventory.map((i) => i.itemId)).toEqual(['it-helmet']);
    const weapon = await act(ana, roomId, 'unequip', { slot: 'weapon' });
    expect(weapon.json()).toEqual({ error: 'weapon_required' });
  });

  it('the helmet counts in the next battle, and nothing changes during one', async () => {
    const { roomId, ana, anaId } = await table();
    await setProfile(anaId, { strength: 1, inventory: ['it-helmet'] });
    const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();

    // In a formation already: the battle reads the profile when it starts.
    const refused = await act(ana, roomId, 'equip', { itemId: 'it-helmet' });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({ error: 'in_battle' });

    await battleAction(app, ana, battleId, 'cancel');
    expect((await act(ana, roomId, 'equip', { itemId: 'it-helmet' })).statusCode).toBe(200);
    const next = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
    await battleAction(app, ana, next.battleId, 'start');
    const battle = app.battles.get(next.battleId);
    if (battle?.status !== 'running') throw new Error('not running');
    expect(battle.state.combatants[0]!.equipmentDefense).toBe(4);
  });
});

describe('consumables out of battle (Fase 4 plan decision 13)', () => {
  it('a potion heals its owner and leaves the inventory; at full HP it is kept', async () => {
    const { roomId, ana, anaId } = await table();
    await setProfile(anaId, { currentHp: 50, inventory: ['it-potion', 'it-potion'] });

    const used = await act(ana, roomId, 'use', { itemId: 'it-potion' });
    expect(used.statusCode, used.body).toBe(200);
    expect(used.json<ProfileSheet>()).toMatchObject({
      currentHp: 55,
      inventory: [expect.objectContaining({ itemId: 'it-potion', quantity: 1 })],
    });

    await setProfile(anaId, { currentHp: 100 });
    const wasted = await act(ana, roomId, 'use', { itemId: 'it-potion' });
    expect(wasted.json()).toEqual({ error: 'nothing_to_restore' });
  });

  it('a phoenix feather lifts a downed member of the room', async () => {
    const { roomId, ana, anaId, biaId } = await table();
    await setProfile(anaId, { inventory: ['it-phoenix'] });
    await setProfile(biaId, { currentHp: 0, downed: true });

    const noTarget = await act(ana, roomId, 'use', { itemId: 'it-phoenix' });
    expect(noTarget.json()).toEqual({ error: 'invalid_target' });

    const lifted = await act(ana, roomId, 'use', { itemId: 'it-phoenix', targetProfileId: biaId });
    expect(lifted.statusCode, lifted.body).toBe(200);
    expect(lifted.json<ProfileSheet>().inventory).toEqual([]);
    const bia = await app.prisma.campaignProfile.findUniqueOrThrow({ where: { id: biaId } });
    expect([bia.downed, bia.currentHp]).toEqual([false, 50]);
  });

  it('refuses what only works in battle, and items not held', async () => {
    const { roomId, ana, anaId } = await table();
    expect((await act(ana, roomId, 'use', { itemId: 'it-potion' })).json()).toEqual({
      error: 'not_in_inventory',
    });
    await setProfile(anaId, { inventory: ['it-sword'] });
    expect((await act(ana, roomId, 'use', { itemId: 'it-sword' })).json()).toEqual({
      error: 'not_consumable',
    });
  });
});
