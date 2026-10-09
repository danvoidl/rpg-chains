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
  /** Ceiling of a video upload (chapter openings and narratives, Fase 5). */
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().positive(),
  /** Upload quotas (`services/media-quota.ts`): bytes per user, uploads per user per 24 h, and
   * the bytes of every user together — the ceiling that bounds the bucket's cost. */
  MEDIA_USER_QUOTA_BYTES: z.coerce.number().int().positive(),
  MEDIA_USER_DAILY_UPLOADS: z.coerce.number().int().positive(),
  MEDIA_TOTAL_QUOTA_BYTES: z.coerce.number().int().positive(),
  /**
   * Test-only (the e2e stack): every battle uses this seed, so a run replays the same rolls.
   * Unset everywhere else, where each battle draws its own.
   */
  BATTLE_SEED: z.coerce.number().int().optional(),
  /**
   * How auth emails (verification, password reset) leave (`email/transports.ts`): `resend` in
   * production, `log` in dev (the link lands in the server log), `outbox` for the tests (one
   * JSON line per email appended to EMAIL_OUTBOX_FILE).
   */
  EMAIL_TRANSPORT: z.enum(['resend', 'log', 'outbox']),
  EMAIL_FROM: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_OUTBOX_FILE: z.string().min(1).optional(),
  /** Bot challenge on sign-up, sign-in and password reset: Cloudflare Turnstile, or off. */
  CAPTCHA_PROVIDER: z.enum(['turnstile', 'off']),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
});

/** The env, with each choice's own settings required once that choice is made. */
export const ServerEnvSchema = EnvSchema.superRefine((env, ctx) => {
  const requireWhen = (when: boolean, key: keyof typeof env) => {
    if (when && !env[key]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required` });
    }
  };
  requireWhen(env.EMAIL_TRANSPORT === 'resend', 'RESEND_API_KEY');
  requireWhen(env.EMAIL_TRANSPORT === 'outbox', 'EMAIL_OUTBOX_FILE');
  requireWhen(env.CAPTCHA_PROVIDER === 'turnstile', 'TURNSTILE_SECRET_KEY');
});

export type Env = z.infer<typeof EnvSchema>;
