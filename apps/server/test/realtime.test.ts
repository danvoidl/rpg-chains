import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import {
  ROOM_EVENTS,
  type RoomChangedMessage,
  type RoomJoinAck,
  type RoomPresenceMessage,
} from '@rpg-chains/shared-types';
import { createTestApp, requestAs, resetDatabase, signUp, type TestUser } from './helpers.js';
import { chooseClass, createRoom, publishedCampaign } from './room-fixtures.js';
import { connected, next, SocketPool } from './socket-client.js';

let app: FastifyInstance;
const pool = new SocketPool();

beforeAll(async () => {
  app = await createTestApp();
  await pool.listen(app);
});
beforeEach(async () => {
  pool.closeAll();
  await resetDatabase(app);
});
afterAll(async () => {
  pool.closeAll();
  await app.close();
});

const open = (user: TestUser | null): Socket => pool.open(user);

function join(socket: Socket, roomId: string): Promise<RoomJoinAck> {
  return socket.emitWithAck(ROOM_EVENTS.join, { roomId }) as Promise<RoomJoinAck>;
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

  it('refuses the lobby of a closed room, even to its members', async () => {
    const master = await signUp(app, 'Master');
    const campaignId = await publishedCampaign(app, master);
    const room = await createRoom(app, master, campaignId);
    const closed = await requestAs(app, master, {
      method: 'POST',
      url: `/api/rooms/${room.id}/close`,
    });
    expect(closed.statusCode).toBe(200);

    const socket = open(master);
    await connected(socket);
    expect(await join(socket, room.id)).toEqual({ ok: false, error: 'room_closed' });
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
