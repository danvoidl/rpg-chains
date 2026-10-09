import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import {
  BATTLE_EVENTS,
  ROOM_EVENTS,
  type BattleEvent,
  type BattleJoinAck,
  type BattleState,
  type BattleSummary,
} from '@rpg-chains/shared-types';
import {
  createTestApp,
  requestAs,
  resetDatabase,
  signUp,
  TEST_GRACE_MS,
  type TestUser,
} from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';
import { SocketPool } from './socket-client.js';

/**
 * The reconnection grace (Fase 6 plan decisions 1–4, spec §3.2, §7): a dropped socket is a drop,
 * not a departure — coming back in time continues the same battle; the grace running out, or
 * leaving on purpose, takes the player out. The master's presence gets the same grace.
 */

let app: FastifyInstance;
const pool = new SocketPool();

beforeAll(async () => {
  app = await createTestApp({ battles: { seed: () => 7 } });
  await pool.listen(app);
});
beforeEach(async () => {
  pool.closeAll();
  app.battles.clear();
  app.grace.clearAll();
  await resetDatabase(app);
});
afterAll(async () => {
  pool.closeAll();
  await app.close();
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Long enough for a socket close to reach the server, well inside the grace. */
const SETTLE_MS = 40;

interface Fight {
  battleId: string;
  roomId: string;
  master: TestUser;
  ana: TestUser;
  bia: TestUser;
}

/** A running objective battle on `n-rat` with Ana and Bia. */
async function fight(): Promise<Fight> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const bia = await signUp(app, 'Bia');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  await chooseClass(app, bia, roomId, 'cl-solo');
  const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
  await battleAction(app, bia, battleId, 'participants');
  expect((await battleAction(app, ana, battleId, 'start')).statusCode).toBe(200);
  return { battleId, roomId, master, ana, bia };
}

async function join(
  user: TestUser,
  battleId: string,
): Promise<{ socket: Socket; ack: BattleJoinAck }> {
  const socket = await pool.connect(user);
  const ack = (await socket.emitWithAck(BATTLE_EVENTS.join, { battleId })) as BattleJoinAck;
  return { socket, ack };
}

function stateOf(battleId: string): BattleState {
  const battle = app.battles.get(battleId);
  if (battle?.status !== 'running') throw new Error('not running');
  return battle.state;
}

/** The battle's log so far, from the registry. */
function logOf(battleId: string): BattleEvent[] {
  const battle = app.battles.get(battleId);
  if (battle?.status !== 'running') throw new Error('not running');
  return battle.log;
}

const combatantOf = (battleId: string, user: TestUser) =>
  stateOf(battleId).combatants.find((c) => c.userId === user.id)!;

describe('a dropped participant (spec §7)', () => {
  it('comes back within the grace to the same battle, never having left', async () => {
    const f = await fight();
    await join(f.bia, f.battleId);
    const ana = await join(f.ana, f.battleId);
    ana.socket.disconnect();
    await wait(SETTLE_MS);
    expect(combatantOf(f.battleId, f.ana)).toMatchObject({ connected: false, left: false });

    const back = await join(f.ana, f.battleId);
    if (!back.ack.ok) throw new Error(back.ack.error);
    // The sync the client starts from already has them back.
    expect(back.ack.sync.state.combatants.find((c) => c.userId === f.ana.id)!.connected).toBe(true);
    await wait(TEST_GRACE_MS + SETTLE_MS);
    const types = logOf(f.battleId).map((e) => e.type);
    expect(types).toContain('PlayerDisconnected');
    expect(types).toContain('PlayerReconnected');
    expect(types).not.toContain('PlayerLeft');
  });

  it('is out for good once the grace runs out', async () => {
    const f = await fight();
    await join(f.bia, f.battleId);
    const ana = await join(f.ana, f.battleId);
    ana.socket.disconnect();
    await wait(TEST_GRACE_MS + SETTLE_MS);
    expect(combatantOf(f.battleId, f.ana).left).toBe(true);
    // Too late: joining again only watches.
    await join(f.ana, f.battleId);
    expect(combatantOf(f.battleId, f.ana)).toMatchObject({ left: true, connected: false });
  });

  it('with another tab open, closing one is not even a drop; unsubscribing the last one is', async () => {
    const f = await fight();
    await join(f.bia, f.battleId);
    const tabs = [await join(f.ana, f.battleId), await join(f.ana, f.battleId)];
    tabs[0]!.socket.disconnect();
    await wait(SETTLE_MS);
    expect(combatantOf(f.battleId, f.ana).connected).toBe(true);

    // `battle:leave` stops watching; it is not leaving the battle (Fase 6 plan decision 2).
    tabs[1]!.socket.emit(BATTLE_EVENTS.leave, { battleId: f.battleId });
    await wait(SETTLE_MS);
    expect(combatantOf(f.battleId, f.ana)).toMatchObject({ connected: false, left: false });
  });

  it('leaving on purpose takes the player out at once, without a grace', async () => {
    const f = await fight();
    await join(f.bia, f.battleId);
    await join(f.ana, f.battleId);
    const leave = () =>
      requestAs(app, f.ana, { method: 'DELETE', url: `/api/battles/${f.battleId}/participants` });
    expect((await leave()).statusCode).toBe(204);
    expect(combatantOf(f.battleId, f.ana).left).toBe(true);
    expect((await leave()).statusCode).toBe(404);
  });

  it('a stranger cannot take a participant out', async () => {
    const f = await fight();
    const stranger = await signUp(app, 'Stranger');
    const res = await requestAs(app, stranger, {
      method: 'DELETE',
      url: `/api/battles/${f.battleId}/participants`,
    });
    expect([res.statusCode, res.json().error]).toEqual([404, 'not_a_participant']);
  });
});

describe('the whole group dropped (spec §3.7)', () => {
  it('pauses with no enemy acting, and resumes when the first one is back', async () => {
    const f = await fight();
    const ana = await join(f.ana, f.battleId);
    const bia = await join(f.bia, f.battleId);
    expect(stateOf(f.battleId).turn.stage).toBe('awaiting_signal');
    ana.socket.disconnect();
    bia.socket.disconnect();
    await wait(SETTLE_MS);
    expect(stateOf(f.battleId).turn).toEqual({ stage: 'paused', reason: 'all_disconnected' });
    const enemyActs = logOf(f.battleId).filter((e) => e.type === 'EnemyActed').length;

    await join(f.bia, f.battleId);
    expect(stateOf(f.battleId).turn.stage).toBe('awaiting_signal');
    expect(logOf(f.battleId).filter((e) => e.type === 'EnemyActed')).toHaveLength(enemyActs);
    // Ana's grace still runs out on its own.
    await wait(TEST_GRACE_MS + SETTLE_MS);
    expect(combatantOf(f.battleId, f.ana).left).toBe(true);
    expect(combatantOf(f.battleId, f.bia).left).toBe(false);
  });

  it('nobody back in time is an abandonment: the battle is lost and leaves the server', async () => {
    const f = await fight();
    const ana = await join(f.ana, f.battleId);
    const bia = await join(f.bia, f.battleId);
    ana.socket.disconnect();
    bia.socket.disconnect();
    await wait(TEST_GRACE_MS + SETTLE_MS);
    await app.battleResolution.settled();
    expect(app.battles.get(f.battleId)).toBeUndefined();
  });
});

describe("the master's grace (spec §3.2)", () => {
  async function openTable() {
    const master = await signUp(app, 'Master');
    const ana = await signUp(app, 'Ana');
    const campaignId = await battleCampaign(app, master);
    const { id: roomId } = await createRoom(app, master, campaignId);
    await clearGate(app, roomId);
    await chooseClass(app, ana, roomId, 'cl-duo');
    const lobby = async () => {
      const socket = await pool.connect(master);
      await socket.emitWithAck(ROOM_EVENTS.join, { roomId });
      return socket;
    };
    return { master, ana, roomId, lobby };
  }

  it('a master who reloads inside the grace never leaves the battle; past it, it falls back', async () => {
    const t = await openTable();
    const first = await t.lobby();
    const { battleId } = (await openBattle(app, t.ana, t.roomId, 'n-open')).json<BattleSummary>();
    expect((await battleAction(app, t.ana, battleId, 'start')).statusCode).toBe(200);
    await join(t.ana, battleId);
    expect(stateOf(battleId).turn.stage).toBe('awaiting_question');

    first.disconnect();
    await wait(SETTLE_MS);
    const second = await t.lobby();
    await wait(TEST_GRACE_MS + SETTLE_MS);
    expect(logOf(battleId).map((e) => e.type)).not.toContain('MasterPresenceChanged');
    expect(stateOf(battleId).turn.stage).toBe('awaiting_question');

    second.disconnect();
    await wait(SETTLE_MS);
    expect(stateOf(battleId).masterOnline).toBe(true);
    await wait(TEST_GRACE_MS + SETTLE_MS);
    expect(stateOf(battleId).masterOnline).toBe(false);
    expect(stateOf(battleId).turn.stage).toBe('awaiting_signal');

    await t.lobby();
    await wait(SETTLE_MS);
    expect(stateOf(battleId).masterOnline).toBe(true);
  });

  it('a master inside the grace still counts as online to start a battle that needs him', async () => {
    const t = await openTable();
    const { battleId } = (await openBattle(app, t.ana, t.roomId, 'n-open')).json<BattleSummary>();
    const first = await t.lobby();
    first.disconnect();
    await wait(SETTLE_MS);
    // His lobby socket is gone, but he is reloading: the start goes through.
    expect((await battleAction(app, t.ana, battleId, 'start')).statusCode).toBe(200);
    expect(stateOf(battleId).masterOnline).toBe(true);
  });
});
