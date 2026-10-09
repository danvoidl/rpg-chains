import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';
import { config } from './config.js';

/** Better Auth instance backed by Prisma (decision 8). Lucia is deprecated — not used. */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  trustedOrigins: [config.WEB_ORIGIN],
  advanced: {
    // Client IP for the rate limit. Behind Render (Cloudflare → Render → Caddy) X-Forwarded-For
    // has several hops, which Better Auth refuses to trust; Cloudflare's CF-Connecting-IP is a
    // single value it overwrites itself. Off Render it is absent and X-Forwarded-For applies.
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
  },
});
