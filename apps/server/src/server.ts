import { Server as IOServer } from 'socket.io';
import { buildApp } from './app.js';
import { config } from './config.js';
import { registerRealtime } from './realtime/index.js';

// Entrypoint only: build the app, attach Socket.IO, listen, and shut down gracefully.
const app = await buildApp({ logger: true });
await app.ready();

const io = new IOServer(app.server, {
  cors: { origin: config.WEB_ORIGIN, credentials: true },
});
registerRealtime(io, app);

await app.listen({ port: config.PORT, host: '0.0.0.0' });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
