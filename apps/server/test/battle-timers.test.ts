import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  BATTLE_EVENTS,
  type BattleEventsMessage,
  type BattleSummary,
} from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp } from './helpers.js';
import { battleAction, battleCampaign, clearGate, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';
import { next, SocketPool } from './socket-client.js';

// Long enough for a test to act within one stage, short enough to watch several expire.
const TICK = 150;

let app: FastifyInstance;
const pool = new SocketPool();

beforeAll(async () => {
  app = await createTestApp({
    battles: {
      seed: () => 7,
      timers: { signalMs: TICK, answerMs: TICK, openAnswerMs: TICK, actionMs: TICK },
    },
  });
  await pool.listen(app);
});
beforeEach(async () => {
  pool.closeAll();
  app.battles.clear();
  await resetDatabase(app);
});
afterAll(async () => {
  pool.closeAll();
  await app.close();
});

/** A started solo battle, watched by its player. */
async function soloBattle() {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, ana, roomId, 'cl-duo');
  const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
  const socket = await pool.connect(ana);
  await battleAction(app, ana, battleId, 'start');
  await socket.emitWithAck(BATTLE_EVENTS.join, { battleId });
  return { battleId, socket };
}

const lostTurn = (reason: string) => (m: BattleEventsMessage) =>
  m.events.some((e) => e.type === 'TurnLost' && e.reason === reason);

describe('turn timers (Fase 3 plan decision 8)', () => {
  it('an untouched signal expires and the turn passes', async () => {
    const { socket } = await soloBattle();
    await next(socket, BATTLE_EVENTS.events, lostTurn('signal_expired'));
  });

  it('a command beats the timer of its stage; the late timeout is stale', async () => {
    const { battleId, socket } = await soloBattle();
    const battle = app.battles.get(battleId)!;
    if (battle.status !== 'running') throw new Error('not running');
    const { turnToken } = battle.state;

    const answerTimeout = next(socket, BATTLE_EVENTS.events, lostTurn('answer_timeout'));
    expect(
      await socket.emitWithAck(BATTLE_EVENTS.command, {
        battleId,
        intent: { type: 'TapSignal', turnToken },
      }),
    ).toEqual({ ok: true });
    // The signal's timer lost the race: replaying it now is just a stale command.
    expect(app.battles.apply(battleId, { type: 'SignalExpired', turnToken })).toEqual({
      ok: false,
      reason: 'stale_turn_token',
    });
    // The new stage got its own clock: nobody answers, so the answer times out.
    await answerTimeout;
  });

  it("a battle runs on the room's timers as they were when it started", async () => {
    const master = await signUp(app, 'Master');
    const ana = await signUp(app, 'Ana');
    const campaignId = await battleCampaign(app, master);
    const { id: roomId } = await createRoom(app, master, campaignId);
    await clearGate(app, roomId);
    await chooseClass(app, ana, roomId, 'cl-duo');
    const patch = (signalMs: number) =>
      requestAs(app, master, {
        method: 'PATCH',
        url: `/api/rooms/${roomId}`,
        payload: { turnTimers: { signalMs } },
      });
    expect((await patch(45_000)).statusCode).toBe(200);

    const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
    await battleAction(app, ana, battleId, 'start');
    // The adjusted signal wins over the platform default (TICK here).
    expect(app.battleTimers.clockOf(battleId)?.durationMs).toBe(45_000);

    // A later edit reaches the next battle, not this one.
    expect((await patch(60_000)).statusCode).toBe(200);
    const battle = app.battles.get(battleId)!;
    if (battle.status !== 'running') throw new Error('not running');
    expect(battle.turnTimers).toEqual({ signalMs: 45_000 });
  });
});
