import { defineConfig } from 'vitest/config';

// Contract tests share one Postgres test database (TEST_DATABASE_URL) and truncate it between
// tests, so test files must not run in parallel.
export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
  },
});
