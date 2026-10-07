import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import {
  BATTLE_EVENTS,
  ROOM_EVENTS,
  type BattleCommandAck,
  type BattleEventsMessage,
  type BattleState,
  type BattleSummary,
  type PublicQuestion,
} from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { battleAction, battleCampaign, openBattle } from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';
import { next, SocketPool } from './socket-client.js';

/** The master and open questions over the wire (Fase 3 plan M7), on the fixture's `n-open`. */

let app: FastifyInstance;
const pool = new SocketPool();

beforeAll(async () => {
  app = await createTestApp({ battles: { seed: () => 7 } });
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

interface Table {
  roomId: string;
  master: TestUser;
  ana: TestUser;
}

async function table(): Promise<Table> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await chooseClass(app, master, roomId, 'cl-duo');
  await chooseClass(app, ana, roomId, 'cl-duo');
  return { roomId, master, ana };
}

/** The master's socket in the room lobby: that is what makes him "online". */
async function masterInLobby(t: Table): Promise<Socket> {
  const socket = await pool.connect(t.master);
  await socket.emitWithAck(ROOM_EVENTS.join, { roomId: t.roomId });
  return socket;
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

function stateOf(battleId: string): BattleState {
  const battle = app.battles.get(battleId);
  if (battle?.status !== 'running') throw new Error('not running');
  return battle.state;
}

/** Ana opens `n-open` and starts it with the master in the lobby. */
async function openBattleRunning(t: Table): Promise<{ battleId: string; lobby: Socket }> {
  const lobby = await masterInLobby(t);
  const { battleId } = (await openBattle(app, t.ana, t.roomId, 'n-open')).json<BattleSummary>();
  expect((await battleAction(app, t.ana, battleId, 'start')).statusCode).toBe(200);
  return { battleId, lobby };
}

describe('forming a battle with open questions (spec §3.2)', () => {
  it('the master cannot fight in it, must be online to start it, and cannot hand over the role', async () => {
    const t = await table();
    const masterOpens = await openBattle(app, t.master, t.roomId, 'n-open');
    expect([masterOpens.statusCode, masterOpens.json().error]).toEqual([
      409,
      'master_cannot_fight',
    ]);

    const opened = await openBattle(app, t.ana, t.roomId, 'n-open');
    const { battleId, needsMaster } = opened.json<BattleSummary>();
    expect(needsMaster).toBe(true);
    const masterJoins = await battleAction(app, t.master, battleId, 'participants');
    expect(masterJoins.json().error).toBe('master_cannot_fight');

    const offline = await battleAction(app, t.ana, battleId, 'start');
    expect([offline.statusCode, offline.json().error]).toEqual([409, 'master_offline']);
    await masterInLobby(t);
    expect((await battleAction(app, t.ana, battleId, 'start')).statusCode).toBe(200);

    const transfer = await requestAs(app, t.master, {
      method: 'POST',
      url: `/api/rooms/${t.roomId}/transfer`,
      payload: { userId: t.ana.id },
    });
    expect([transfer.statusCode, transfer.json().error]).toEqual([409, 'battle_needs_master']);
  });
});

describe('the master runs the questions', () => {
  it('shows a node question, a player answers in writing, the master judges', async () => {
    const t = await table();
    const { battleId } = await openBattleRunning(t);
    const masterSocket = await watch(t.master, battleId);
    const anaSocket = await watch(t.ana, battleId);
    expect(stateOf(battleId).turn.stage).toBe('awaiting_question');

    // The bank is the master's, and never carries an answer key.
    const bank = await requestAs(app, t.master, {
      method: 'GET',
      url: `/api/battles/${battleId}/questions`,
    });
    const questions = bank.json<PublicQuestion[]>();
    expect(questions.map((q) => q.questionId)).toEqual(['q-1', 'q-open']);
    expect(bank.body).not.toContain('correctIndex');
    const peek = await requestAs(app, t.ana, {
      method: 'GET',
      url: `/api/battles/${battleId}/questions`,
    });
    expect(peek.statusCode).toBe(403);

    const present = (turnToken: number) => ({
      type: 'PresentQuestion',
      turnToken,
      question: { questionId: 'q-open' },
    });
    expect(await send(anaSocket, battleId, present(stateOf(battleId).turnToken))).toEqual({
      ok: false,
      reason: 'not_master',
    });
    expect(await send(masterSocket, battleId, present(stateOf(battleId).turnToken))).toEqual({
      ok: true,
    });
    expect(
      await send(anaSocket, battleId, {
        type: 'TapSignal',
        turnToken: stateOf(battleId).turnToken,
      }),
    ).toEqual({ ok: true });

    const submitted = next(masterSocket, BATTLE_EVENTS.events, (m: BattleEventsMessage) =>
      m.events.some((e) => e.type === 'OpenAnswerSubmitted'),
    );
    expect(
      await send(anaSocket, battleId, {
        type: 'SubmitOpenAnswer',
        turnToken: stateOf(battleId).turnToken,
        text: 'Porque a corrente range.',
      }),
    ).toEqual({ ok: true });
    expect((await submitted).events).toContainEqual(
      expect.objectContaining({ type: 'OpenAnswerSubmitted', text: 'Porque a corrente range.' }),
    );

    expect(
      await send(anaSocket, battleId, {
        type: 'JudgeOpenAnswer',
        turnToken: stateOf(battleId).turnToken,
        approved: true,
      }),
    ).toEqual({ ok: false, reason: 'not_master' });
    expect(
      await send(masterSocket, battleId, {
        type: 'JudgeOpenAnswer',
        turnToken: stateOf(battleId).turnToken,
        approved: true,
      }),
    ).toEqual({ ok: true });
    expect(stateOf(battleId).turn.stage).toBe('awaiting_action');
  });

  it('when the master leaves the lobby the battle falls back to the objective question', async () => {
    const t = await table();
    const { battleId, lobby } = await openBattleRunning(t);
    const anaSocket = await watch(t.ana, battleId);
    expect(stateOf(battleId).turn.stage).toBe('awaiting_question');

    const fallback = next(anaSocket, BATTLE_EVENTS.events, (m: BattleEventsMessage) =>
      m.events.some((e) => e.type === 'SignalOpened'),
    );
    lobby.disconnect();
    const { events } = await fallback;
    expect(events).toContainEqual({ type: 'MasterPresenceChanged', online: false });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'SignalOpened',
        question: expect.objectContaining({ type: 'objective' }),
      }),
    );
  });
});
