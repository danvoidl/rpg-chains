import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-database-url.js';

/** Brings the test database schema up to date once per run (non-destructive `migrate deploy`). */
export default function setup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
