import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { captcha, twoFactor } from 'better-auth/plugins';
import { prisma } from './db.js';
import { config } from './config.js';
import { sendEmail } from './email/transports.js';
import { resetPasswordEmail, verificationEmail } from './email/auth-emails.js';

const ONE_HOUR_S = 60 * 60;

/**
 * Better Auth instance backed by Prisma (decision 8). Lucia is deprecated — not used.
 * Sign-in needs a confirmed email; the optional second factor is an authenticator app (TOTP)
 * with backup codes; sign-up, sign-in and password-reset requests pass a Turnstile challenge
 * when `CAPTCHA_PROVIDER` is on.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  appName: 'rpg-chains',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: ONE_HOUR_S,
    // A reset logs every other device out: whoever had the old password loses the session too.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(resetPasswordEmail(user, url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Trying to sign in unconfirmed sends a fresh link (the first may have expired).
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * ONE_HOUR_S,
    sendVerificationEmail: async ({ user, url }) => {
      // The link confirms on the API, then lands on the web's page, whichever flow sent it.
      const link = new URL(url);
      link.searchParams.set('callbackURL', `${config.WEB_ORIGIN}/email-verified`);
      await sendEmail(verificationEmail(user, link.toString()));
    },
  },
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  trustedOrigins: [config.WEB_ORIGIN],
  advanced: {
    // Client IP for the rate limit. Behind Render (Cloudflare → Render → Caddy) X-Forwarded-For
    // has several hops, which Better Auth refuses to trust; Cloudflare's CF-Connecting-IP is a
    // single value it overwrites itself. Off Render it is absent and X-Forwarded-For applies.
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
  },
  plugins: [
    twoFactor({ issuer: 'rpg-chains' }),
    ...(config.CAPTCHA_PROVIDER === 'turnstile'
      ? [captcha({ provider: 'cloudflare-turnstile', secretKey: config.TURNSTILE_SECRET_KEY! })]
      : []),
  ],
});
