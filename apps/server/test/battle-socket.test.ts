import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { eligibleForSignal } from '@rpg-chains/battle-engine';
import {
  BATTLE_EVENTS,
  type BattleCommandAck,
  type BattleEventsMessage,
  type BattleJoinAck,
  type BattleState,
  type BattleSummary,
  type ClientIntent,
  type RoomDetail,
} from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import {
  battleAction,
  battleCampaign,
  clearGate,
  correctIndex,
  openBattle,
  publishBattleVersion,
} from './battle-fixtures.js';
import { chooseClass, createRoom } from './room-fixtures.js';
import { next, SocketPool } from './socket-client.js';

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

interface Fight {
  battleId: string;
  roomId: string;
  campaignId: string;
  master: TestUser;
  ana: TestUser;
  bia: TestUser;
}

/** A started battle on `n-rat` with Ana and Bia; the master watches from outside. */
async function fight(): Promise<Fight> {
  const master = await signUp(app, 'Master');
  const ana = await signUp(app, 'Ana');
  const bia = await signUp(app, 'Bia');
  const campaignId = await battleCampaign(app, master);
  const { id: roomId } = await createRoom(app, master, campaignId);
  await clearGate(app, roomId);
  await chooseClass(app, master, roomId, 'cl-duo');
  await chooseClass(app, ana, roomId, 'cl-duo');
  await chooseClass(app, bia, roomId, 'cl-solo');
  const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
  await battleAction(app, bia, battleId, 'participants');
  expect((await battleAction(app, ana, battleId, 'start')).statusCode).toBe(200);
  return { battleId, roomId, campaignId, master, ana, bia };
}

async function joinBattle(socket: Socket, battleId: string): Promise<BattleJoinAck> {
  return (await socket.emitWithAck(BATTLE_EVENTS.join, { battleId })) as BattleJoinAck;
}

/** A socket of `user`, subscribed to the battle. */
async function watcher(user: TestUser, battleId: string): Promise<Socket> {
  const socket = await pool.connect(user);
  expect((await joinBattle(socket, battleId)).ok).toBe(true);
  return socket;
}

function send(socket: Socket, battleId: string, intent: unknown): Promise<BattleCommandAck> {
  return socket.emitWithAck(BATTLE_EVENTS.command, {
    battleId,
    intent,
  }) as Promise<BattleCommandAck>;
}

/** The authoritative state, straight from the registry. */
function stateOf(battleId: string): BattleState | null {
  const battle = app.battles.get(battleId);
  return battle?.status === 'running' ? battle.state : null;
}

/** The next intent a perfect group would send, and which user sends it. */
function nextMove(state: BattleState): { userId: string; intent: ClientIntent } {
  const { turn, turnToken } = state;
  const userOf = (profileId: string) =>
    state.combatants.find((c) => c.profileId === profileId)!.userId;
  switch (turn.stage) {
    case 'awaiting_signal':
      return {
        userId: userOf([...eligibleForSignal(state)][0]!),
        intent: { type: 'TapSignal', turnToken },
      };
    case 'awaiting_answer': {
      if (turn.question.type !== 'objective') throw new Error('open question');
      const index = correctIndex(turn.question.questionId);
      return {
        userId: userOf(turn.profileId),
        intent: { type: 'SubmitObjectiveAnswer', turnToken, index },
      };
    }
    case 'awaiting_action': {
      // A combatant holding a potion drinks it before attacking.
      const actor = state.combatants.find((c) => c.profileId === turn.profileId)!;
      const potion = actor.consumables.find((slot) => slot.itemId === 'it-potion');
      if (potion) {
        return {
          userId: userOf(turn.profileId),
          intent: {
            type: 'ChooseAction',
            turnToken,
            action: { type: 'consumable', itemId: potion.itemId },
          },
        };
      }
      const target = state.enemies.find((e) => e.currentHp > 0)!.instanceId;
      return {
        userId: userOf(turn.profileId),
        intent: {
          type: 'ChooseAction',
          turnToken,
          action: { type: 'attack', targetInstanceId: target },
        },
      };
    }
    default:
      throw new Error(`no move in stage ${turn.stage}`);
  }
}

/** Plays every turn correctly until the battle resolves; returns the final state. */
async function playToEnd(battleId: string, sockets: Record<string, Socket>): Promise<BattleState> {
  for (let step = 0; step < 100; step++) {
    const state = stateOf(battleId)!;
    if (state.result !== null) return state;
    const { userId, intent } = nextMove(state);
    expect(await send(sockets[userId]!, battleId, intent)).toEqual({ ok: true });
  }
  throw new Error('battle did not end');
}

async function roomOf(f: Fight): Promise<RoomDetail> {
  const res = await requestAs(app, f.master, { method: 'GET', url: `/api/rooms/${f.roomId}` });
  return res.json<RoomDetail>();
}

describe('a battle over the socket', () => {
  it('two players win an objective battle; the channel stays gapless and the profiles keep the result', async () => {
    const f = await fight();
    const anaSocket = await pool.connect(f.ana);
    const joined = await joinBattle(anaSocket, f.battleId);
    if (!joined.ok) throw new Error(joined.error);
    const messages: BattleEventsMessage[] = [];
    anaSocket.on(BATTLE_EVENTS.events, (m: BattleEventsMessage) => messages.push(m));
    const biaSocket = await watcher(f.bia, f.battleId);

    const final = await playToEnd(f.battleId, { [f.ana.id]: anaSocket, [f.bia.id]: biaSocket });
    expect(final.result).toBe('victory');
    // The server emits a batch before acking the command that caused it, so all have arrived.

    // Each batch picks up exactly where the previous one (or the join sync) stopped.
    let seq = joined.sync.seq;
    for (const message of messages) {
      expect(message.fromSeq).toBe(seq + 1);
      seq = message.toSeq;
    }
    expect(messages.at(-1)!.events.at(-1)).toEqual({ type: 'BattleResolved', result: 'victory' });

    await app.battleResolution.settled();
    const profiles = await app.prisma.campaignProfile.findMany({
      where: { userId: { in: [f.ana.id, f.bia.id] } },
    });
    for (const c of final.combatants) {
      const profile = profiles.find((p) => p.id === c.profileId)!;
      expect([profile.currentHp, profile.currentEnergy, profile.downed]).toEqual([
        c.currentHp,
        c.currentEnergy,
        false,
      ]);
    }
    // The bite landed at least once and attacking earned energy, so the write-back is visible.
    expect(final.combatants.some((c) => c.currentHp < 100 || c.currentEnergy !== 50)).toBe(true);
    expect((await roomOf(f)).battles).toEqual([]);
  });

  it('takes the consumables used in battle out of the inventory, and only those', async () => {
    const master = await signUp(app, 'Master');
    const ana = await signUp(app, 'Ana');
    const campaignId = await battleCampaign(app, master);
    const { id: roomId } = await createRoom(app, master, campaignId);
    await clearGate(app, roomId);
    await chooseClass(app, ana, roomId, 'cl-duo');
    // Two potions: the perfect group drinks both on its first action turns, then attacks.
    await app.prisma.campaignProfile.updateMany({
      where: { userId: ana.id },
      data: { inventory: ['it-potion', 'it-sword', 'it-potion'] },
    });
    const { battleId } = (await openBattle(app, ana, roomId, 'n-rat')).json<BattleSummary>();
    expect((await battleAction(app, ana, battleId, 'start')).statusCode).toBe(200);
    const socket = await watcher(ana, battleId);

    const final = await playToEnd(battleId, { [ana.id]: socket });
    expect(final.result).toBe('victory');
    const held = final.combatants[0]!.consumables.find((slot) => slot.itemId === 'it-potion');
    const drunk = 2 - (held?.quantity ?? 0);

    await app.battleResolution.settled();
    const profile = await app.prisma.campaignProfile.findFirstOrThrow({
      where: { userId: ana.id },
    });
    const potionsLeft = (profile.inventory as string[]).filter((id) => id === 'it-potion').length;
    expect(drunk).toBeGreaterThan(0);
    expect(potionsLeft).toBe(2 - drunk);
    // Items not used in battle stay.
    expect(profile.inventory).toContain('it-sword');
  });

  it('never sends a seed, the question deck or an answer key', async () => {
    const f = await fight();
    const anaSocket = await pool.connect(f.ana);
    const payloads: unknown[] = [await joinBattle(anaSocket, f.battleId)];
    anaSocket.on(BATTLE_EVENTS.events, (m: unknown) => payloads.push(m));
    const biaSocket = await watcher(f.bia, f.battleId);
    await playToEnd(f.battleId, { [f.ana.id]: anaSocket, [f.bia.id]: biaSocket });
    await app.battleResolution.settled();

    const wire = JSON.stringify(payloads);
    for (const secret of [
      'correctIndex',
      '"seed"',
      'questionDeck',
      '"secret"',
      'prng',
      'PrngAdvanced',
    ]) {
      expect(wire).not.toContain(secret);
    }
    // Questions did cross the wire — projected, without their key.
    expect(wire).toContain('"options"');
  });

  it('binds the actor from the session: forged ids, stale tokens and outsiders are refused', async () => {
    const f = await fight();
    const anaSocket = await watcher(f.ana, f.battleId);
    const masterSocket = await watcher(f.master, f.battleId);
    const state = stateOf(f.battleId)!;
    expect(state.turn.stage).toBe('awaiting_signal');
    const biaProfile = state.combatants.find((c) => c.userId === f.bia.id)!.profileId;
    const anaProfile = state.combatants.find((c) => c.userId === f.ana.id)!.profileId;
    const { turnToken } = state;

    expect(await send(masterSocket, f.battleId, { type: 'TapSignal', turnToken })).toEqual({
      ok: false,
      reason: 'not_a_participant',
    });
    expect(
      await send(anaSocket, f.battleId, { type: 'TapSignal', turnToken: turnToken - 1 }),
    ).toEqual({
      ok: false,
      reason: 'stale_turn_token',
    });
    expect(
      await send(anaSocket, f.battleId, { type: 'JudgeOpenAnswer', turnToken, approved: true }),
    ).toEqual({ ok: false, reason: 'not_master' });
    expect(await send(anaSocket, f.battleId, { type: 'Nonsense' })).toEqual({
      ok: false,
      reason: 'invalid_message',
    });

    // A profileId in the payload is stripped; the signal goes to the sender.
    const forged = { type: 'TapSignal', turnToken, profileId: biaProfile };
    expect(await send(anaSocket, f.battleId, forged)).toEqual({ ok: true });
    expect(stateOf(f.battleId)!.turn).toMatchObject({
      stage: 'awaiting_answer',
      profileId: anaProfile,
    });
  });

  it('tells clients how long the stage has left, from the join and with every batch', async () => {
    const f = await fight();
    const anaSocket = await pool.connect(f.ana);
    const joined = await joinBattle(anaSocket, f.battleId);
    if (!joined.ok) throw new Error(joined.error);
    const { turnToken } = stateOf(f.battleId)!;
    // The signal waits 20 s (game-config BATTLE_TIMERS).
    expect(joined.sync.clock).toMatchObject({ turnToken, durationMs: 20_000 });
    expect(joined.sync.clock!.remainingMs).toBeLessThanOrEqual(20_000);

    const answering = next(anaSocket, BATTLE_EVENTS.events, () => true);
    await send(anaSocket, f.battleId, { type: 'TapSignal', turnToken });
    expect((await answering).clock).toMatchObject({ turnToken: turnToken + 1, durationMs: 30_000 });
  });

  it('keeps strangers to a private room out of its battles', async () => {
    const f = await fight();
    await requestAs(app, f.master, {
      method: 'PATCH',
      url: `/api/rooms/${f.roomId}`,
      payload: { isPublic: false },
    });
    const stranger = await pool.connect(await signUp(app, 'Stranger'));
    expect(await joinBattle(stranger, f.battleId)).toEqual({ ok: false, error: 'not_allowed' });
    expect(await joinBattle(stranger, 'no-such-battle')).toEqual({
      ok: false,
      error: 'battle_not_found',
    });
  });

  it('takes out a player whose last socket leaves; the last one out loses, and everyone is back at the campfire', async () => {
    const f = await fight();
    const anaTabs = [await watcher(f.ana, f.battleId), await watcher(f.ana, f.battleId)];
    const biaSocket = await watcher(f.bia, f.battleId);
    const anaProfile = stateOf(f.battleId)!.combatants.find((c) => c.userId === f.ana.id)!;

    anaTabs[0]!.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(stateOf(f.battleId)!.combatants.find((c) => c.userId === f.ana.id)!.left).toBe(false);

    const anaLeft = next(biaSocket, BATTLE_EVENTS.events, (m: BattleEventsMessage) =>
      m.events.some((e) => e.type === 'PlayerLeft' && e.profileId === anaProfile.profileId),
    );
    anaTabs[1]!.emit(BATTLE_EVENTS.leave, { battleId: f.battleId });
    await anaLeft;

    const changed = next(await roomWatcher(f), 'room:changed', () => true);
    biaSocket.disconnect();
    await changed;
    await app.battleResolution.settled();
    const profiles = await app.prisma.campaignProfile.findMany({
      where: { userId: { in: [f.ana.id, f.bia.id] } },
    });
    // A defeat returns the group to the campfire, revived and refilled (spec §3.7).
    expect(profiles.map((p) => [p.downed, p.currentHp > 0])).toEqual([
      [false, true],
      [false, true],
    ]);
  });

  it('tells watchers when the battle leaves the server: resolved or cancelled', async () => {
    const won = await fight();
    const anaSocket = await watcher(won.ana, won.battleId);
    const resolved = next(anaSocket, BATTLE_EVENTS.closed, () => true);
    await playToEnd(won.battleId, {
      [won.ana.id]: anaSocket,
      [won.bia.id]: await watcher(won.bia, won.battleId),
    });
    expect(await resolved).toEqual({ battleId: won.battleId, reason: 'resolved' });

    const f = await fight();
    const biaSocket = await watcher(f.bia, f.battleId);
    const cancelled = next(biaSocket, BATTLE_EVENTS.closed, () => true);
    expect((await battleAction(app, f.master, f.battleId, 'cancel')).statusCode).toBe(204);
    expect(await cancelled).toEqual({ battleId: f.battleId, reason: 'cancelled' });
  });

  it('keeps the room on its version until the battle ends, then rolls it forward', async () => {
    const f = await fight();
    await publishBattleVersion(app, f.campaignId, 2);
    expect((await roomOf(f)).version).toBe(1);

    const sockets = {
      [f.ana.id]: await watcher(f.ana, f.battleId),
      [f.bia.id]: await watcher(f.bia, f.battleId),
    };
    await playToEnd(f.battleId, sockets);
    await app.battleResolution.settled();
    expect((await roomOf(f)).version).toBe(2);
  });
});

/** The master's socket in the room lobby, to hear `room:changed`. */
async function roomWatcher(f: Fight): Promise<Socket> {
  const socket = await pool.connect(f.master);
  await socket.emitWithAck('room:join', { roomId: f.roomId });
  return socket;
}
