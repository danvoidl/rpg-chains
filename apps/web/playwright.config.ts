import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// E2E topology: a dedicated server + web pair on their own ports, against a dedicated database
// (E2E_DATABASE_URL), so a running dev stack and the contract-test database are never touched.
// The server's secrets and storage settings come from its own `.env`.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverEnv = loadEnv({ path: path.join(repoRoot, 'apps/server/.env'), processEnv: {} }).parsed;
if (!serverEnv) throw new Error('apps/server/.env is required to run the e2e suite');
const e2eDatabaseUrl = serverEnv.E2E_DATABASE_URL;
if (!e2eDatabaseUrl) throw new Error('E2E_DATABASE_URL is required in apps/server/.env');

const API_PORT = 3101;
const WEB_PORT = 3100;
const apiUrl = `http://localhost:${API_PORT}`;
const webUrl = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'pnpm --filter @rpg-chains/server exec prisma migrate deploy && pnpm --filter @rpg-chains/server exec tsx src/server.ts',
      cwd: repoRoot,
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...serverEnv,
        DATABASE_URL: e2eDatabaseUrl,
        PORT: String(API_PORT),
        BETTER_AUTH_URL: apiUrl,
        WEB_ORIGIN: webUrl,
        // Same rolls every run: initiative, enemy targets and the question order are fixed.
        BATTLE_SEED: '1',
      },
    },
    {
      command: `pnpm --filter @rpg-chains/web exec next dev -p ${WEB_PORT}`,
      cwd: repoRoot,
      url: webUrl,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: apiUrl },
    },
  ],
});
