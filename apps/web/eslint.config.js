import config from '@rpg-chains/eslint-config';
import globals from 'globals';

export default [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...config,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
