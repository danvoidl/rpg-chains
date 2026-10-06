import { configDefaults, defineConfig } from 'vitest/config';

// `e2e/` holds Playwright specs (`pnpm test:e2e`), not vitest suites.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
});
