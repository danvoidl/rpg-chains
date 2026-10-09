import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import {
  BATTLE_EVENTS,
  type BattleCommandAck,
  type BattleState,
  type BattleSummary,
  type ClientIntent,
  type TurnStage,
} from '@rpg-chains/shared-types';
import { createTestApp, resetDatabase, signUp, TEST_GRACE_MS, type TestUser } from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { nextCommand, runningState } from './battle-play.js';
import { chooseClass, createRoom } from './room-fixtures.js';
import { SocketPool } from './socket-client.js';

/**
 * Everything about a fight is the server's (Fase 6 plan decisions 10 and 11): an intent the page
 * would never offer is refused by the engine, a client that floods is cut off, and sockets that
 * drop and come back at any stage leave the battle exactly as playable.
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

interface Fight {
  battleId: string;
  ana: TestUser;
  bia: TestUser;
  sockets: Map<string, Socket>;
}

/** A running battle on `n-rat`; Ana and Bia each watch it from one socket. */
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
  const sockets = new Map<string, Socket>();
  for (const user of [ana, bia]) sockets.set(user.id, await watch(user, battleId));
  return { battleId, ana, bia, sockets };
}

async function watch(user: TestUser, battleId: string): Promise<Socket> {
  const socket = await pool.connect(user);
  await socket.emitWithAck(BATTLE_EVENTS.join, { battleId });
  return socket;
}

function send(socket: Socket, battleId: string, intent: unknown): Promise<BattleCommandAck> {
  return socket.emitWithAck(BATTLE_EVENTS.command, {
    battleId,
    intent,
  }) as Promise<BattleCommandAck>;
}

/** The next perfect move, as the user who would send it and the intent without an actor. */
function nextMove(state: BattleState): { userId: string; intent: ClientIntent } {
  const { profileId, ...intent } = nextCommand(state) as { profileId: string } & ClientIntent;
  const userId = state.combatants.find((c) => c.profileId === profileId)!.userId;
  return { userId, intent };
}

/** Plays through the sockets until the battle reaches `stage` (or ends). */
async function playUntil(f: Fight, stage: TurnStage): Promise<BattleState> {
  for (let i = 0; i < 50; i++) {
    const state = runningState(app, f.battleId);
    if (state.turn.stage === stage || state.result !== null) return state;
    const { userId, intent } = nextMove(state);
    expect(await send(f.sockets.get(userId)!, f.battleId, intent)).toEqual({ ok: true });
  }
  throw new Error(`never reached ${stage}`);
}

describe('the client decides nothing (decision 10)', () => {
  it('intents the page would never offer are refused by the engine', async () => {
    const f = await fight();
    const answering = await playUntil(f, 'awaiting_answer');
    const turn = answering.turn as Extract<BattleState['turn'], { stage: 'awaiting_answer' }>;
    const answerer = answering.combatants.find((c) => c.profileId === turn.profileId)!;
    const other = [f.ana, f.bia].find((u) => u.id !== answerer.userId)!;
    // Someone else answering for the signal winner.
    expect(
      await send(f.sockets.get(other.id)!, f.battleId, {
        type: 'SubmitObjectiveAnswer',
        turnToken: answering.turnToken,
        index: 0,
      }),
    ).toEqual({ ok: false, reason: 'not_your_turn' });

    const acting = await playUntil(f, 'awaiting_action');
    const actor = f.sockets.get(nextMove(acting).userId)!;
    const act = (action: object) =>
      send(actor, f.battleId, { type: 'ChooseAction', turnToken: acting.turnToken, action });
    for (const action of [
      { type: 'attack', targetInstanceId: 'no-such-enemy' },
      { type: 'skill', skillId: 'no-such-skill' },
      { type: 'consumable', itemId: 'it-phoenix' },
    ]) {
      expect((await act(action)).ok, JSON.stringify(action)).toBe(false);
    }
    // None of it changed the battle.
    expect(runningState(app, f.battleId).turnToken).toBe(acting.turnToken);
  });

  it('a socket that floods intents is cut off', async () => {
    const f = await fight();
    const state = runningState(app, f.battleId);
    const acks = await Promise.all(
      Array.from({ length: 30 }, () =>
        send(f.sockets.get(f.ana.id)!, f.battleId, {
          type: 'TapSignal',
          turnToken: state.turnToken - 1,
        }),
      ),
    );
    const limited = acks.filter((a) => !a.ok && a.reason === 'rate_limited').length;
    expect(limited).toBe(10);
  });
});

describe('drops at every stage (decision 11)', () => {
  it.each<[TurnStage, 'actor' | 'other']>([
    ['awaiting_signal', 'actor'],
    ['awaiting_answer', 'actor'],
    ['awaiting_answer', 'other'],
    ['awaiting_action', 'actor'],
    ['awaiting_action', 'other'],
  ])('a drop at %s (%s) and a return in time leave the battle as playable', async (stage, who) => {
    const f = await fight();
    const state = await playUntil(f, stage);
    const mover = nextMove(state).userId;
    const dropper = who === 'actor' ? mover : [f.ana.id, f.bia.id].find((id) => id !== mover)!;
    const user = [f.ana, f.bia].find((u) => u.id === dropper)!;
    f.sockets.get(dropper)!.disconnect();
    await wait(20);
    f.sockets.set(dropper, await watch(user, f.battleId));

    // Play on to the end; nobody ever left.
    for (let i = 0; i < 60; i++) {
      const now = runningState(app, f.battleId);
      if (now.result !== null) break;
      const { userId, intent } = nextMove(now);
      expect(await send(f.sockets.get(userId)!, f.battleId, intent)).toEqual({ ok: true });
    }
    const final = runningState(app, f.battleId);
    expect(final.result).toBe('victory');
    // The drop did happen, and the return undid it.
    const battle = app.battles.get(f.battleId);
    if (battle?.status !== 'running') throw new Error('not running');
    const profileId = final.combatants.find((c) => c.userId === dropper)!.profileId;
    expect(
      battle.log
        .filter(
          (e) =>
            (e.type === 'PlayerDisconnected' || e.type === 'PlayerReconnected') &&
            e.profileId === profileId,
        )
        .map((e) => e.type),
    ).toEqual(['PlayerDisconnected', 'PlayerReconnected']);
    expect(final.combatants.every((c) => !c.left && c.connected)).toBe(true);
    await wait(TEST_GRACE_MS + 20);
    await app.battleResolution.settled();
  });
});
