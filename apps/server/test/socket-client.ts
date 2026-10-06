import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import type { TestUser } from './helpers.js';

/**
 * Socket.IO clients against an app listening on an ephemeral port (spec §6). Tracks every socket
 * it opens so tests can drop them all between cases.
 */
export class SocketPool {
  private readonly sockets: Socket[] = [];
  private url = '';

  async listen(app: FastifyInstance): Promise<void> {
    await app.listen({ port: 0, host: '127.0.0.1' });
    this.url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  /** Opens a socket carrying the user's session cookie (or none). */
  open(user: TestUser | null): Socket {
    const socket = connect(this.url, {
      transports: ['websocket'],
      extraHeaders: user ? { cookie: user.cookie } : {},
      reconnection: false,
    });
    this.sockets.push(socket);
    return socket;
  }

  /** Opens a socket and waits for the handshake. */
  async connect(user: TestUser): Promise<Socket> {
    const socket = this.open(user);
    await connected(socket);
    return socket;
  }

  closeAll(): void {
    for (const socket of this.sockets.splice(0)) socket.disconnect();
  }
}

export function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

/** Resolves with the first `event` message that satisfies `match`. */
export function next<T>(socket: Socket, event: string, match: (message: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const handler = (message: T) => {
      if (!match(message)) return;
      socket.off(event, handler);
      resolve(message);
    };
    socket.on(event, handler);
  });
}
