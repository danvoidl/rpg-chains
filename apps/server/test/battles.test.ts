import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { BattleSummary, RoomDetail } from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  await app.close();
});

interface Table {
  roomId: string;
  master: TestUser;
  players: TestUser[];
}

/** A public room whose master and two players each picked a class. */
async function table(): Promise<Table> {
  const master = await signUp(app, 'Master');
  const players = [await signUp(app, 'Ana'), await signUp(app, 'Bia')];
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, master, roomId, 'cl-duo');
  await chooseClass(app, players[0]!, roomId, 'cl-duo');
  await chooseClass(app, players[1]!, roomId, 'cl-solo');
  return { roomId, master, players };
}

async function formation(t: Table, user: TestUser, nodeId = 'n-rat'): Promise<BattleSummary> {
  const res = await openBattle(app, user, t.roomId, nodeId);
  expect(res.statusCode).toBe(201);
  return res.json<BattleSummary>();
}

async function roomDetail(t: Table, user: TestUser): Promise<RoomDetail> {
  const res = await requestAs(app, user, { method: 'GET', url: `/api/rooms/${t.roomId}` });
  return res.json<RoomDetail>();
}

describe('opening a formation', () => {
  it('lists the formation on the room, with the opener in it', async () => {
    const t = await table();
    const summary = await formation(t, t.players[0]!);
    expect(summary).toMatchObject({
      nodeId: 'n-rat',
      nodeType: 'battle',
      status: 'forming',
      participantLimit: 2,
      needsMaster: false,
      participants: [{ name: 'Ana', userId: t.players[0]!.id }],
    });
    expect((await roomDetail(t, t.master)).battles).toEqual([summary]);
  });

  it('shows every battle and boss node on the trail, flagging open questions', async () => {
    const t = await table();
    const room = await roomDetail(t, t.players[0]!);
    expect(
      room.progress.chapters[0]!.nodes.filter((n) => n.type === 'battle' || n.type === 'boss').map(
        (n) => [n.nodeId, n.type, n.participantLimit, n.needsMaster],
      ),
    ).toEqual([
      ['n-rat', 'battle', 2, false],
      ['n-boss', 'boss', null, false],
      ['n-open', 'battle', 2, true],
      ['n-silent', 'battle', 2, false],
    ]);
    expect(room.members.find((m) => m.name === 'Ana')!.profile).toMatchObject({
      currentHp: 100,
      maxHp: 100,
      currentEnergy: 50,
      maxEnergy: 50,
    });
  });

  it('refuses nodes that cannot be fought and a second battle on the same node', async () => {
    const t = await table();
    const [ana, bia] = t.players as [TestUser, TestUser];
    const refused = async (user: TestUser, nodeId: string) => {
      const res = await openBattle(app, user, t.roomId, nodeId);
      return [res.statusCode, res.json<{ error: string }>().error];
    };
    expect(await refused(ana, 'n-nowhere')).toEqual([422, 'unknown_node']);
    expect(await refused(ana, 'n-camp')).toEqual([422, 'not_a_battle_node']);
    expect(await refused(ana, 'n-silent')).toEqual([422, 'node_without_questions']);
    await formation(t, ana);
    expect(await refused(bia, 'n-rat')).toEqual([409, 'node_busy']);
    expect(await refused(ana, 'n-boss')).toEqual([409, 'already_in_battle']);
  });

  it('refuses a user without a profile and a downed profile', async () => {
    const t = await table();
    const outsider = await signUp(app, 'Outsider');
    expect((await openBattle(app, outsider, t.roomId, 'n-rat')).statusCode).toBe(403);
    await app.prisma.campaignProfile.updateMany({
      where: { userId: t.players[0]!.id },
      data: { downed: true, currentHp: 0 },
    });
    const res = await openBattle(app, t.players[0]!, t.roomId, 'n-rat');
    expect([res.statusCode, res.json().error]).toEqual([409, 'profile_downed']);
  });
});

describe('joining, leaving and cancelling', () => {
  it('fills up to the node limit; the last one out dissolves the formation', async () => {
    const t = await table();
    const [ana, bia] = t.players as [TestUser, TestUser];
    const { battleId } = await formation(t, ana);

    const joined = await battleAction(app, bia, battleId, 'participants');
    expect(joined.json<BattleSummary>().participants.map((p) => p.name)).toEqual(['Ana', 'Bia']);
    const full = await battleAction(app, t.master, battleId, 'participants');
    expect([full.statusCode, full.json().error]).toEqual([409, 'participant_limit']);
    const again = await battleAction(app, bia, battleId, 'participants');
    expect(again.json().error).toBe('already_in_battle');

    expect((await battleAction(app, ana, battleId, 'participants', 'DELETE')).statusCode).toBe(204);
    expect((await battleAction(app, bia, battleId, 'participants', 'DELETE')).statusCode).toBe(204);
    expect((await roomDetail(t, t.master)).battles).toEqual([]);
  });

  it('lets the master cancel, but not a participant while others remain', async () => {
    const t = await table();
    const [ana, bia] = t.players as [TestUser, TestUser];
    const { battleId } = await formation(t, ana);
    await battleAction(app, bia, battleId, 'participants');

    expect((await battleAction(app, ana, battleId, 'cancel')).statusCode).toBe(403);
    expect((await battleAction(app, t.master, battleId, 'cancel')).statusCode).toBe(204);
    expect((await battleAction(app, ana, battleId, 'start')).statusCode).toBe(404);
  });
});

describe('starting', () => {
  it('turns the formation into a running battle that takes no more changes', async () => {
    const t = await table();
    const [ana, bia] = t.players as [TestUser, TestUser];
    const { battleId } = await formation(t, ana);

    expect((await battleAction(app, bia, battleId, 'start')).statusCode).toBe(403);
    const started = await battleAction(app, ana, battleId, 'start');
    expect(started.json<BattleSummary>().status).toBe('running');
    const late = await battleAction(app, bia, battleId, 'participants');
    expect([late.statusCode, late.json().error]).toEqual([409, 'battle_not_forming']);
    expect((await roomDetail(t, bia)).battles[0]!.status).toBe('running');

    // A running battle is not the participants' to cancel: with the master away, they ask
    // together — here Ana is the only one (Fase 6 plan decision 8).
    expect((await battleAction(app, ana, battleId, 'cancel')).statusCode).toBe(403);
    const asked = await requestAs(app, ana, {
      method: 'POST',
      url: `/api/battles/${battleId}/cancel-requests`,
    });
    expect(asked.json()).toEqual({ status: 'cancelled' });
    expect(app.battles.get(battleId)).toBeUndefined();
  });

  it('refuses a participant downed after joining', async () => {
    const t = await table();
    const { battleId } = await formation(t, t.players[0]!);
    await app.prisma.campaignProfile.updateMany({
      where: { userId: t.players[0]!.id },
      data: { downed: true, currentHp: 0 },
    });
    const res = await battleAction(app, t.players[0]!, battleId, 'start');
    expect([res.statusCode, res.json().error]).toEqual([409, 'participant_downed']);
  });
});

describe('room guards while a battle is active', () => {
  it('a participant cannot abandon the room and the master cannot close it', async () => {
    const t = await table();
    await formation(t, t.players[0]!);
    const abandon = await requestAs(app, t.players[0]!, {
      method: 'DELETE',
      url: `/api/rooms/${t.roomId}/profile`,
    });
    expect([abandon.statusCode, abandon.json().error]).toEqual([409, 'in_battle']);
    const close = await requestAs(app, t.master, {
      method: 'POST',
      url: `/api/rooms/${t.roomId}/close`,
    });
    expect([close.statusCode, close.json().error]).toEqual([409, 'battle_in_progress']);
  });
});
