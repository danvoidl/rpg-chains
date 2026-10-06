import type { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';

/**
 * Wires Socket.IO handlers. Kept separate from REST. Phase 2/3: join a battle room, validate
 * incoming Commands with Zod, run the pure `decide`/`evolve` from `@rpg-chains/battle-engine`, and
 * emit the resulting Events — the server stays dumb transport (decision 1).
 */
export function registerRealtime(io: Server, app: FastifyInstance): void {
  io.on('connection', (socket) => {
    app.log.info({ id: socket.id }, 'socket connected');
    socket.on('disconnect', () => app.log.info({ id: socket.id }, 'socket disconnected'));
  });
}
