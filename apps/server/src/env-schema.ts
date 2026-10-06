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
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).transform((v) => v === 'true'),
  S3_PUBLIC_BASE_URL: z.string().url(),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce.number().int().positive(),
  /**
   * Test-only (the e2e stack): every battle uses this seed, so a run replays the same rolls.
   * Unset everywhere else, where each battle draws its own.
   */
  BATTLE_SEED: z.coerce.number().int().optional(),
});

export type Env = z.infer<typeof EnvSchema>;
