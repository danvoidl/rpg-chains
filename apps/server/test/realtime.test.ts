import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import {
  ROOM_EVENTS,
  type RoomChangedMessage,
  type RoomJoinAck,
  type RoomPresenceMessage,
} from '@rpg-chains/shared-types';
import { createTestApp, resetDatabase, signUp, type TestUser } from './helpers.js';
import { chooseClass, createRoom, publishedCampaign } from './room-fixtures.js';

let app: FastifyInstance;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  app = await createTestApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
beforeEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await resetDatabase(app);
});
afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await app.close();
});

/** Opens a socket carrying the user's session cookie (or none). */
function open(user: TestUser | null): Socket {
  const socket = connect(url, {
    transports: ['websocket'],
    extraHeaders: user ? { cookie: user.cookie } : {},
    reconnection: false,
  });
  sockets.push(socket);
  return socket;
}

function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function join(socket: Socket, roomId: string): Promise<RoomJoinAck> {
  return socket.emitWithAck(ROOM_EVENTS.join, { roomId }) as Promise<RoomJoinAck>;
}

/** Resolves with the first `event` message that satisfies `match`. */
function next<T>(socket: Socket, event: string, match: (message: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const handler = (message: T) => {
      if (!match(message)) return;
      socket.off(event, handler);
      resolve(message);
    };
    socket.on(event, handler);
  });
}

describe('room lobby over Socket.IO', () => {
  it('rejects a handshake without a session', async () => {
    await expect(connected(open(null))).rejects.toThrow('unauthorized');
  });

  it('shares presence between members and drops users when they disconnect', async () => {
    const master = await signUp(app, 'Master');
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId, false);
    await chooseClass(app, player, room.id, 'cl-duo', room.accessCode!);

    const masterSocket = open(master);
    await connected(masterSocket);
    expect(await join(masterSocket, room.id)).toEqual({ ok: true });

    const bothOnline = next<RoomPresenceMessage>(
      masterSocket,
      ROOM_EVENTS.presence,
      (m) => m.onlineUserIds.length === 2,
    );
    const playerSocket = open(player);
    await connected(playerSocket);
    expect(await join(playerSocket, room.id)).toEqual({ ok: true });
    expect((await bothOnline).onlineUserIds.sort()).toEqual([master.id, player.id].sort());

    const playerLeft = next<RoomPresenceMessage>(
      masterSocket,
      ROOM_EVENTS.presence,
      (m) => m.onlineUserIds.length === 1,
    );
    playerSocket.disconnect();
    expect((await playerLeft).onlineUserIds).toEqual([master.id]);
  });

  it('keeps non-members out of a private room lobby', async () => {
    const master = await signUp(app, 'Master');
    const stranger = await signUp(app, 'Stranger');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId, false);

    const socket = open(stranger);
    await connected(socket);
    expect(await join(socket, room.id)).toEqual({ ok: false, error: 'not_a_member' });
    expect(await join(socket, 'not-a-room')).toEqual({ ok: false, error: 'not_a_member' });
  });

  it('signals room:changed to the lobby after a REST mutation', async () => {
    const master = await signUp(app, 'Master');
    const player = await signUp(app, 'Player');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId);

    const socket = open(master);
    await connected(socket);
    await join(socket, room.id);
    const changed = next<RoomChangedMessage>(socket, ROOM_EVENTS.changed, () => true);
    await chooseClass(app, player, room.id, 'cl-duo');
    expect(await changed).toEqual({ roomId: room.id });
  });
});
