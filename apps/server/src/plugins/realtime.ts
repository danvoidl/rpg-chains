import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { ROOM_EVENTS, type RoomChangedMessage } from '@rpg-chains/shared-types';
import { auth } from '../auth.js';
import { toHeaders } from '../auth-headers.js';
import { config } from '../config.js';
import { registerLobby, roomChannel, type LobbySocketData } from '../realtime/lobby.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
    /** Push signals to room lobbies; REST routes call these after a committed mutation. */
    roomEvents: { changed: (roomId: string) => void };
  }
}

/**
 * Attaches Socket.IO to the app's HTTP server inside `buildApp()`, so contract tests can drive
 * it by listening on an ephemeral port. Every socket must carry a Better Auth session cookie;
 * the handshake is rejected otherwise.
 */
export default fp(async (app) => {
  const io = new Server(app.server, {
    cors: { origin: config.WEB_ORIGIN, credentials: true },
  });

  io.use(async (socket, next) => {
    const session = await auth.api.getSession({ headers: toHeaders(socket.handshake.headers) });
    if (!session) return next(new Error('unauthorized'));
    const data: LobbySocketData = { userId: session.user.id, roomIds: new Set() };
    socket.data = data;
    next();
  });
  registerLobby(io, app);

  app.decorate('io', io);
  app.decorate('roomEvents', {
    changed: (roomId: string) => {
      const message: RoomChangedMessage = { roomId };
      io.to(roomChannel(roomId)).emit(ROOM_EVENTS.changed, message);
    },
  });

  // Open sockets would keep the HTTP server from closing; drop them first.
  app.addHook('preClose', async () => {
    io.disconnectSockets(true);
    io.engine.close();
  });
});
