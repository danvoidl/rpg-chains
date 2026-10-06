import type { FastifyInstance } from 'fastify';
import type { Server, Socket } from 'socket.io';
import { toPublicEvent, toPublicState } from '@rpg-chains/battle-engine';
import {
  BATTLE_EVENTS,
  BattleCommandMessageSchema,
  BattleJoinMessageSchema,
  BattleLeaveMessageSchema,
  BattleSyncRequestSchema,
  type BattleClosedMessage,
  type BattleCommandAck,
  type BattleEventsMessage,
  type BattleJoinAck,
  type BattleSync,
  type BattleSyncAck,
  type ClientIntent,
  type Command,
  type PublicBattleEvent,
} from '@rpg-chains/shared-types';
import type { RunningBattle } from '../services/battle-registry.js';
import { Presence } from './presence.js';
import type { SocketData } from './socket-data.js';

/** Socket.IO channel of a running battle. */
export function battleChannel(battleId: string): string {
  return `battle:${battleId}`;
}

type BattleSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

const MASTER_INTENTS: ReadonlySet<ClientIntent['type']> = new Set([
  'PresentQuestion',
  'JudgeOpenAnswer',
]);

function syncOf(battle: RunningBattle): BattleSync {
  return {
    battleId: battle.battleId,
    seq: battle.log.length,
    state: toPublicState(battle.state),
  };
}

/** No-op ack for clients that did not ask for one. */
function replier<T>(ack: unknown): (result: T) => void {
  return typeof ack === 'function' ? (ack as (result: T) => void) : () => undefined;
}

/**
 * The running battle over Socket.IO (Fase 3 plan M3). Unlike the lobby, commands travel here: an
 * intent is parsed, its actor bound from the session — never trusted from the payload — and handed
 * to the registry, whose verdict is the ack. Every accepted batch goes to the channel projected
 * through `toPublicEvent`, so no seed, deck or answer key ever leaves the server. A player whose
 * last socket leaves the battle is out of it (`PlayerLeft`, spec §7).
 */
export function registerBattleChannel(io: Server, app: FastifyInstance): void {
  const presence = new Presence();

  app.battles.subscribe({
    appended(battle, { fromSeq, events }) {
      const message: BattleEventsMessage = {
        battleId: battle.battleId,
        fromSeq,
        toSeq: fromSeq + events.length - 1,
        events: events.map(toPublicEvent).filter((e): e is PublicBattleEvent => e !== null),
      };
      io.to(battleChannel(battle.battleId)).emit(BATTLE_EVENTS.events, message);
    },
    removed(battle) {
      const closed: BattleClosedMessage = {
        battleId: battle.battleId,
        reason:
          battle.status === 'running' && battle.state.result !== null ? 'resolved' : 'cancelled',
      };
      io.to(battleChannel(battle.battleId)).emit(BATTLE_EVENTS.closed, closed);
      presence.drop(battle.battleId);
      io.in(battleChannel(battle.battleId)).socketsLeave(battleChannel(battle.battleId));
    },
  });

  /** The running battle, if the user may watch it: room members, and anyone for a public room. */
  async function watchable(battleId: string, userId: string): Promise<RunningBattle | null> {
    const battle = app.battles.get(battleId);
    if (battle?.status !== 'running') return null;
    const room = await app.prisma.room.findUnique({
      where: { id: battle.roomId },
      select: {
        isPublic: true,
        masterId: true,
        profiles: { where: { userId }, select: { id: true } },
      },
    });
    const allowed = room && (room.isPublic || room.masterId === userId || room.profiles.length > 0);
    return allowed ? battle : null;
  }

  /** The command an intent stands for, with the actor bound from the session. */
  async function toCommand(
    battle: RunningBattle,
    userId: string,
    intent: ClientIntent,
  ): Promise<Command | string> {
    if (MASTER_INTENTS.has(intent.type)) {
      const room = await app.prisma.room.findUnique({
        where: { id: battle.roomId },
        select: { masterId: true },
      });
      return room?.masterId === userId ? (intent as Command) : 'not_master';
    }
    const combatant = battle.state.combatants.find((c) => c.userId === userId);
    if (!combatant) return 'not_a_participant';
    return { ...intent, profileId: combatant.profileId } as Command;
  }

  const leave = (socket: BattleSocket, battleId: string) => {
    if (!socket.data.battleIds.delete(battleId)) return;
    const { userId } = socket.data;
    presence.remove(battleId, userId, socket.id);
    void socket.leave(battleChannel(battleId));
    if (presence.has(battleId, userId)) return;

    const battle = app.battles.get(battleId);
    if (battle?.status !== 'running' || battle.state.result !== null) return;
    const combatant = battle.state.combatants.find((c) => c.userId === userId && !c.left);
    if (combatant)
      app.battles.apply(battleId, { type: 'PlayerLeft', profileId: combatant.profileId });
  };

  io.on('connection', (raw) => {
    const socket = raw as unknown as BattleSocket;

    socket.on(BATTLE_EVENTS.join, async (payload: unknown, ack?: unknown) => {
      const reply = replier<BattleJoinAck>(ack);
      const parsed = BattleJoinMessageSchema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'invalid_message' });
      const { battleId } = parsed.data;
      const { userId } = socket.data;
      if (!app.battles.get(battleId)) return reply({ ok: false, error: 'battle_not_found' });
      const battle = await watchable(battleId, userId);
      if (!battle) return reply({ ok: false, error: 'not_allowed' });

      // No await from here to the reply: the sync's seq is exactly where the channel picks up.
      socket.data.battleIds.add(battleId);
      presence.add(battleId, userId, socket.id);
      void socket.join(battleChannel(battleId));
      reply({ ok: true, sync: syncOf(battle) });
    });

    socket.on(BATTLE_EVENTS.sync, (payload: unknown, ack?: unknown) => {
      const reply = replier<BattleSyncAck>(ack);
      const parsed = BattleSyncRequestSchema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'invalid_message' });
      const { battleId } = parsed.data;
      const battle = app.battles.get(battleId);
      if (battle?.status !== 'running') return reply({ ok: false, error: 'battle_not_found' });
      if (!socket.data.battleIds.has(battleId)) return reply({ ok: false, error: 'not_allowed' });
      reply({ ok: true, sync: syncOf(battle) });
    });

    socket.on(BATTLE_EVENTS.command, async (payload: unknown, ack?: unknown) => {
      const reply = replier<BattleCommandAck>(ack);
      const parsed = BattleCommandMessageSchema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, reason: 'invalid_message' });
      const { battleId, intent } = parsed.data;
      const battle = app.battles.get(battleId);
      if (battle?.status !== 'running') return reply({ ok: false, reason: 'battle_not_found' });

      const command = await toCommand(battle, socket.data.userId, intent);
      if (typeof command === 'string') return reply({ ok: false, reason: command });
      reply(app.battles.apply(battleId, command));
    });

    socket.on(BATTLE_EVENTS.leave, (payload: unknown) => {
      const parsed = BattleLeaveMessageSchema.safeParse(payload);
      if (parsed.success) leave(socket, parsed.data.battleId);
    });

    socket.on('disconnect', () => {
      for (const battleId of [...socket.data.battleIds]) leave(socket, battleId);
    });
  });
}
