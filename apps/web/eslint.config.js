import config from '@rpg-chains/eslint-config';
import globals from 'globals';

export default [
  // Playwright output is generated (and gitignored); never lint it.
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...config,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
