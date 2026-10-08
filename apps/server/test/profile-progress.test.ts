import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import {
  CampaignSnapshotSchema,
  type BattleSummary,
  type ProfileSheet,
} from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { playBattleToEnd, runningState } from './battle-play.js';
import { chooseClass, createRoom } from './room-fixtures.js';

let app: FastifyInstance;

beforeEach(async () => {
  app ??= await createTestApp({ battles: { seed: () => 7 } });
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

/** Makes the fixture rat worth a level-up (120 XP), 9 gold and a common drop. */
async function generousRat(campaignId: string): Promise<void> {
  const row = await app.prisma.campaignVersion.findFirstOrThrow({ where: { campaignId } });
  const snapshot = CampaignSnapshotSchema.parse(row.snapshot);
  snapshot.villains = snapshot.villains.map((v) => ({
    ...v,
    xpReward: 120,
    goldReward: 9,
    drops: [{ itemId: 'it-potion', chance: 0.35 }],
  }));
  await app.prisma.campaignVersion.update({
    where: { id: row.id },
    data: { snapshot: snapshot as unknown as Prisma.InputJsonValue },
  });
}

interface Solo {
  roomId: string;
  battleId: string;
  ana: TestUser;
  profileId: string;
}

/** Ana alone in a started battle on `n-rat`. */
async function soloBattle(): Promise<Solo> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const campaignId = await battleCampaign(app, master);
  await generousRat(campaignId);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
  expect((await battleAction(app, ana, battleId, 'start')).statusCode).toBe(200);
  const profile = await app.prisma.campaignProfile.findFirstOrThrow({ where: { userId: ana.id } });
  return { roomId, battleId, ana, profileId: profile.id };
}

const stateOf = (battleId: string) => runningState(app, battleId);
const playToEnd = (battleId: string) => playBattleToEnd(app, battleId);

async function sheetOf(user: TestUser, roomId: string): Promise<ProfileSheet> {
  const res = await requestAs(app, user, { method: 'GET', url: `/api/rooms/${roomId}/profile` });
  expect(res.statusCode, res.body).toBe(200);
  return res.json<ProfileSheet>();
}

function spend(user: TestUser, roomId: string, points: Record<string, number>) {
  return requestAs(app, user, {
    method: 'POST',
    url: `/api/rooms/${roomId}/profile/points`,
    payload: { strength: 0, dexterity: 0, intelligence: 0, ...points },
  });
}

describe('battle rewards reach the profile (Fase 4 plan M3)', () => {
  it('a victory adds XP with the level-up, gold and the drops the battle rolled', async () => {
    const { roomId, battleId, ana, profileId } = await soloBattle();
    const final = playToEnd(battleId);
    expect(final.result).toBe('victory');
    const reward = final.rewards.find((r) => r.profileId === profileId)!;
    // One rat at its recommended level: the whole 120 XP and 9 gold.
    expect(reward).toMatchObject({ xp: 120, gold: 9 });
    await app.battleResolution.settled();

    const sheet = await sheetOf(ana, roomId);
    const hp = final.combatants[0]!.currentHp;
    expect(sheet).toMatchObject({
      level: 2,
      xp: 20,
      xpToNextLevel: 200,
      availablePoints: 3,
      gold: 9,
      // The knight class gains 8 HP per level: the battle's HP plus the new ceiling's gain.
      currentHp: hp + 8,
    });
    const potions = sheet.inventory.find((i) => i.itemId === 'it-potion')?.quantity ?? 0;
    expect(potions).toBe(reward.items.length);
  });

  it('a defeat costs a fifth of the gold, also to whoever left, and restores them at the campfire', async () => {
    const { battleId, ana, roomId, profileId } = await soloBattle();
    await app.prisma.campaignProfile.update({ where: { id: profileId }, data: { gold: 50 } });
    // The last one out loses the battle (spec §3.7).
    expect(app.battles.apply(battleId, { type: 'PlayerLeft', profileId })).toEqual({ ok: true });
    expect(stateOf(battleId).result).toBe('defeat');
    await app.battleResolution.settled();
    const sheet = await sheetOf(ana, roomId);
    expect(sheet).toMatchObject({ gold: 40, xp: 0, downed: false, currentHp: sheet.maxHp });
  });
});

describe('investing points (Fase 4 plan decision 7)', () => {
  it('spends what a level-up gave, raising the ceilings and the current resources', async () => {
    const { roomId, battleId, ana } = await soloBattle();
    playToEnd(battleId);
    await app.battleResolution.settled();
    const before = await sheetOf(ana, roomId);

    const res = await spend(ana, roomId, { strength: 2, intelligence: 1 });
    expect(res.statusCode, res.body).toBe(200);
    // Strength: +4 HP and +2 defense per point; intelligence: +3 energy (spec §4.1).
    expect(res.json<ProfileSheet>()).toMatchObject({
      availablePoints: 0,
      attributes: { strength: 2, dexterity: 0, intelligence: 1 },
      maxHp: before.maxHp + 8,
      currentHp: before.currentHp + 8,
      maxEnergy: before.maxEnergy + 3,
      defense: before.defense + 4,
    });

    const tooMany = await spend(ana, roomId, { dexterity: 1 });
    expect(tooMany.statusCode).toBe(422);
    expect(tooMany.json()).toEqual({ error: 'not_enough_points' });
  });

  it('refuses while the player is in a battle, and to someone without a profile', async () => {
    const { roomId, ana, profileId } = await soloBattle();
    await app.prisma.campaignProfile.update({
      where: { id: profileId },
      data: { availablePoints: 3 },
    });
    const inBattle = await spend(ana, roomId, { strength: 1 });
    expect(inBattle.statusCode).toBe(409);
    expect(inBattle.json()).toEqual({ error: 'in_battle' });

    const stranger = await signUp(app, 'Stranger');
    expect((await spend(stranger, roomId, { strength: 1 })).statusCode).toBe(404);
    const sheet = await requestAs(app, stranger, {
      method: 'GET',
      url: `/api/rooms/${roomId}/profile`,
    });
    expect(sheet.statusCode).toBe(404);
  });
});
