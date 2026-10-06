import type { FastifyInstance } from 'fastify';
import type { Server, Socket } from 'socket.io';
import {
  ROOM_EVENTS,
  RoomJoinMessageSchema,
  RoomLeaveMessageSchema,
  type RoomJoinAck,
  type RoomPresenceMessage,
} from '@rpg-chains/shared-types';
import { Presence } from './presence.js';

/** Socket.IO channel of a room lobby. */
export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

/** Data the auth middleware attaches to every socket. */
export interface LobbySocketData {
  userId: string;
  /** Lobbies this socket joined, so a disconnect can leave all of them. */
  roomIds: Set<string>;
}

type LobbySocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  LobbySocketData
>;

/**
 * Lobby presence handlers (Fase 2 plan M3): a socket joins a room's channel (members of any room,
 * anyone for a public one), everyone in it receives the updated online list, and a disconnect
 * leaves every joined lobby. Mutations never travel here — they are REST.
 */
export function registerLobby(io: Server, app: FastifyInstance): void {
  const presence = new Presence();

  const broadcast = (roomId: string) => {
    const message: RoomPresenceMessage = { roomId, onlineUserIds: presence.online(roomId) };
    io.to(roomChannel(roomId)).emit(ROOM_EVENTS.presence, message);
  };

  const leave = (socket: LobbySocket, roomId: string) => {
    if (!socket.data.roomIds.delete(roomId)) return;
    presence.remove(roomId, socket.data.userId, socket.id);
    void socket.leave(roomChannel(roomId));
    broadcast(roomId);
  };

  io.on('connection', (raw) => {
    const socket = raw as unknown as LobbySocket;

    socket.on(ROOM_EVENTS.join, async (payload: unknown, ack?: (result: RoomJoinAck) => void) => {
      const reply = typeof ack === 'function' ? ack : () => undefined;
      const parsed = RoomJoinMessageSchema.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'invalid_message' });
      const { roomId } = parsed.data;
      const { userId } = socket.data;

      const room = await app.prisma.room.findUnique({
        where: { id: roomId },
        select: {
          isPublic: true,
          masterId: true,
          profiles: { where: { userId }, select: { id: true } },
        },
      });
      const allowed =
        room && (room.isPublic || room.masterId === userId || room.profiles.length > 0);
      if (!allowed) return reply({ ok: false, error: 'not_a_member' });

      socket.data.roomIds.add(roomId);
      presence.add(roomId, userId, socket.id);
      await socket.join(roomChannel(roomId));
      broadcast(roomId);
      reply({ ok: true });
    });

    socket.on(ROOM_EVENTS.leave, (payload: unknown) => {
      const parsed = RoomLeaveMessageSchema.safeParse(payload);
      if (parsed.success) leave(socket, parsed.data.roomId);
    });

    socket.on('disconnect', () => {
      for (const roomId of [...socket.data.roomIds]) leave(socket, roomId);
    });
  });
}
