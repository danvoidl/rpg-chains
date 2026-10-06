import { buildApp } from './app.js';
import { config } from './config.js';

// Entrypoint only: build the app (REST + Socket.IO), listen, and shut down gracefully.
const fixedSeed = config.BATTLE_SEED;
const app = await buildApp({
  logger: true,
  battles: fixedSeed === undefined ? {} : { seed: () => fixedSeed },
});

await app.listen({ port: config.PORT, host: '0.0.0.0' });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
