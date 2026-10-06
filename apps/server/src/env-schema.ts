import { z } from 'zod';

/**
 * Environment contract for the server (Daniel's config rule: everything env-specific and
 * every secret in env, no hardcoded fallbacks). A missing or malformed value is a .env
 * fix, not a code default. Kept separate from `config.ts` so it can be tested without
 * triggering a parse of the live process env.
 */
export const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  PORT: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof EnvSchema>;
